import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed(){
  const hash=await bcrypt.hash("Demo@123",10);
  const user=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES('Naman Choudhary','manager@stockpilot.app',$1,'manager') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id",[hash]);
  const supplier=await pool.query("INSERT INTO suppliers(name,phone,email) SELECT 'Urban Wholesale','+91 98765 43210','orders@urban.demo' WHERE NOT EXISTS(SELECT 1 FROM suppliers WHERE name='Urban Wholesale') RETURNING id");
  const supplierId=supplier.rows[0]?.id || (await pool.query("SELECT id FROM suppliers WHERE name='Urban Wholesale'")).rows[0].id;
  const products=[
    ["SP-1001","Classic cotton tee","Apparel",799,24,8], ["SP-1002","Canvas everyday tote","Accessories",649,5,6],
    ["SP-1003","Stainless water bottle","Lifestyle",999,13,5], ["SP-1004","Desk planner 2026","Stationery",449,3,5],
    ["SP-1005","Wireless mini speaker","Electronics",1699,9,4]
  ];
  for(const p of products){
    const product=await pool.query("INSERT INTO products(sku,name,category,selling_price,quantity,reorder_level,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(sku) DO UPDATE SET name=EXCLUDED.name RETURNING id",[...p,supplierId]);
    const movement=await pool.query("SELECT 1 FROM stock_movements WHERE product_id=$1",[product.rows[0].id]);
    if(!movement.rowCount) await pool.query("INSERT INTO stock_movements(product_id,user_id,movement_type,quantity_change,note) VALUES($1,$2,'purchase',$3,'Opening stock')",[product.rows[0].id,user.rows[0].id,p[4]]);
  }
  console.log("StockPilot seed complete");
}
seed().finally(()=>pool.end());
