import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import pg from "pg";
import { z } from "zod";

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 5103);
const jwtSecret = process.env.JWT_SECRET || "development-only-secret";
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);
type User = { id: string; name: string; email: string; role: "manager" | "staff" };
type AuthRequest = Request & { user?: User };

app.use(helmet()); app.use(cors({ origin: (origin, callback) => callback(null, !origin || !allowedOrigins.length || allowedOrigins.includes(origin)) }));
app.use(express.json({ limit: "200kb" })); app.use(morgan("combined"));
const asyncRoute = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) => (req: AuthRequest, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next);
function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try { req.user = jwt.verify(token, jwtSecret) as User; next(); } catch { return res.status(401).json({ message: "Invalid or expired token" }); }
}
function manager(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "manager") return res.status(403).json({ message: "Manager access required" }); next();
}

app.get("/health", asyncRoute(async (_req,res) => { await pool.query("SELECT 1"); res.json({ status: "ok", service: "stockpilot-api" }); }));
app.post("/api/auth/login", asyncRoute(async (req,res) => {
  const input = z.object({ email: z.email(), password: z.string().min(6) }).parse(req.body);
  const result = await pool.query("SELECT id,name,email,role,password_hash FROM users WHERE LOWER(email)=LOWER($1)", [input.email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password,user.password_hash))) return res.status(401).json({ message: "Incorrect email or password" });
  const payload = { id:user.id,name:user.name,email:user.email,role:user.role };
  res.json({ token:jwt.sign(payload,jwtSecret,{ expiresIn:"8h" }),user:payload });
}));

app.get("/api/dashboard", auth, asyncRoute(async (_req,res) => {
  const [summary,categories,movements] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int product_count,COALESCE(SUM(quantity),0)::int units_in_stock,
      COALESCE(SUM(quantity*selling_price),0)::float inventory_value,
      COUNT(*) FILTER(WHERE quantity<=reorder_level)::int low_stock_count FROM products WHERE is_active=TRUE`),
    pool.query("SELECT category,COUNT(*)::int products,COALESCE(SUM(quantity),0)::int units FROM products WHERE is_active=TRUE GROUP BY category ORDER BY units DESC"),
    pool.query(`SELECT sm.id,p.name,p.sku,sm.movement_type,sm.quantity_change,sm.note,sm.created_at,u.name user_name
      FROM stock_movements sm JOIN products p ON p.id=sm.product_id JOIN users u ON u.id=sm.user_id ORDER BY sm.created_at DESC LIMIT 6`),
  ]);
  res.json({ summary:summary.rows[0],categories:categories.rows,recentMovements:movements.rows });
}));

app.get("/api/products", auth, asyncRoute(async (req,res) => {
  const search = String(req.query.search || ""); const lowStock = req.query.lowStock === "true";
  const result = await pool.query(`SELECT p.id,p.sku,p.name,p.category,p.selling_price::float,p.quantity,p.reorder_level,
      s.name supplier_name,(p.quantity<=p.reorder_level) low_stock
      FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.is_active=TRUE
      AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.sku ILIKE '%'||$1||'%' OR p.category ILIKE '%'||$1||'%')
      AND (NOT $2::boolean OR p.quantity<=p.reorder_level) ORDER BY low_stock DESC,p.name`, [search,lowStock]);
  res.json(result.rows);
}));

app.post("/api/products", auth, manager, asyncRoute(async (req,res) => {
  const input = z.object({ sku:z.string().min(2).max(50),name:z.string().min(2).max(160),category:z.string().min(2).max(80),sellingPrice:z.number().nonnegative(),quantity:z.number().int().nonnegative(),reorderLevel:z.number().int().nonnegative().default(5) }).parse(req.body);
  const result = await pool.query("INSERT INTO products(sku,name,category,selling_price,quantity,reorder_level) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [input.sku,input.name,input.category,input.sellingPrice,input.quantity,input.reorderLevel]);
  res.status(201).json(result.rows[0]);
}));

app.post("/api/products/:id/movements", auth, asyncRoute(async (req,res) => {
  const input = z.object({ type:z.enum(["purchase","sale","adjustment"]),quantityChange:z.number().int().refine((v)=>v!==0),note:z.string().max(300).optional() }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const product = await client.query("SELECT id,quantity FROM products WHERE id=$1 FOR UPDATE", [req.params.id]);
    if (!product.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message:"Product not found" }); }
    const nextQuantity = product.rows[0].quantity + input.quantityChange;
    if (nextQuantity < 0) { await client.query("ROLLBACK"); return res.status(409).json({ message:"Not enough stock for this movement" }); }
    await client.query("UPDATE products SET quantity=$1 WHERE id=$2", [nextQuantity,req.params.id]);
    const movement = await client.query("INSERT INTO stock_movements(product_id,user_id,movement_type,quantity_change,note) VALUES($1,$2,$3,$4,$5) RETURNING *", [req.params.id,req.user?.id,input.type,input.quantityChange,input.note||null]);
    await client.query("COMMIT"); res.status(201).json({ ...movement.rows[0],quantity:nextQuantity });
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}));

app.get("/api/movements", auth, asyncRoute(async (_req,res) => {
  const result = await pool.query(`SELECT sm.id,p.name,p.sku,sm.movement_type,sm.quantity_change,sm.note,sm.created_at,u.name user_name
    FROM stock_movements sm JOIN products p ON p.id=sm.product_id JOIN users u ON u.id=sm.user_id ORDER BY sm.created_at DESC LIMIT 50`);
  res.json(result.rows);
}));

app.use((_req,res)=>res.status(404).json({ message:"Route not found" }));
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(error instanceof z.ZodError) return res.status(400).json({ message:"Invalid request",issues:error.issues });
  if((error as { code?:string }).code === "23505") return res.status(409).json({ message:"A product with that SKU already exists" });
  console.error(error); res.status(500).json({ message:"Unexpected server error" });
});
app.listen(port,"127.0.0.1",()=>console.log(`StockPilot API listening on ${port}`));
