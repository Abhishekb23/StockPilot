import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  LogOut,
  Menu,
  PackagePlus,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
const API =
  import.meta.env.VITE_API_URL || "https://stockpilot.hrms.ssym.co.in";
type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  supplier_name: string;
  low_stock: boolean;
};
type Summary = {
  product_count: number;
  units_in_stock: number;
  inventory_value: number;
  low_stock_count: number;
};
type Movement = {
  id: string;
  name: string;
  sku: string;
  movement_type: string;
  quantity_change: number;
  note: string;
  created_at: string;
  user_name: string;
};
type Dashboard = {
  summary: Summary;
  categories: { category: string; products: number; units: number }[];
  recentMovements: Movement[];
};
async function request(
  path: string,
  token?: string,
  options: RequestInit = {},
) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Request failed");
  return d;
}
export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("stockpilot-token") || "",
  );
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("stockpilot-user") || "null"),
  );
  const [email, setEmail] = useState("manager@stockpilot.app");
  const [password, setPassword] = useState("Demo@123");
  const [data, setData] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"product" | "movement" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reorder, setReorder] = useState("5");
  const [movementType, setMovementType] = useState("purchase");
  const [note, setNote] = useState("");
  const [audit, setAudit] = useState<Movement[] | null>(null);
  async function refresh() {
    const [d, p] = await Promise.all([
      request("/api/dashboard", token),
      request(`/api/products?search=${encodeURIComponent(query)}`, token),
    ]);
    setData(d);
    setProducts(p);
  }
  useEffect(() => {
    if (!token) return;
    refresh().catch((e) => setError(e.message));
  }, [token, query]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const d = await request("/api/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("stockpilot-token", d.token);
      localStorage.setItem("stockpilot-user", JSON.stringify(d.user));
      setToken(d.token);
      setUser(d.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function logout() {
    localStorage.clear();
    setToken("");
    setUser(null);
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await request("/api/products", token, {
        method: "POST",
        body: JSON.stringify({
          sku,
          name,
          category,
          sellingPrice: Number(price),
          quantity: Number(quantity),
          reorderLevel: Number(reorder),
        }),
      });
      await refresh();
      setDialog(null);
      setSku("");
      setName("");
      setCategory("");
      setPrice("");
      setQuantity("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function addMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const entered = Math.abs(Number(quantity));
      const change = movementType === "sale" ? -entered : entered;
      await request(`/api/products/${selected.id}/movements`, token, {
        method: "POST",
        body: JSON.stringify({
          type: movementType,
          quantityChange: change,
          note,
        }),
      });
      await refresh();
      setAudit(null);
      setDialog(null);
      setQuantity("");
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function toggleAudit() {
    if (audit) {
      setAudit(null);
      return;
    }
    try {
      setAudit(await request("/api/movements", token));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function openMovement(product: Product) {
    setSelected(product);
    setDialog("movement");
    setQuantity("");
    setNote("");
  }
  if (!token || !user)
    return (
      <Login
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        submit={login}
        error={error}
        loading={loading}
      />
    );
  const s = data?.summary || {
    product_count: 0,
    units_in_stock: 0,
    inventory_value: 0,
    low_stock_count: 0,
  };
  return (
    <div className="app">
      <aside className={menu ? "side open" : "side"}>
        <div className="brand">
          <span>SP</span>StockPilot
        </div>
        <button className="close" onClick={() => setMenu(false)}>
          <X />
        </button>
        <nav>
          <a
            className="active"
            href="#dashboard"
            onClick={() => setMenu(false)}
          >
            <BarChart3 />
            Dashboard
          </a>
          <a href="#products" onClick={() => setMenu(false)}>
            <Boxes />
            Products <span>{s.product_count}</span>
          </a>
          <a href="#movements" onClick={() => setMenu(false)}>
            <ClipboardList />
            Movements
          </a>
          <a href="#reports" onClick={() => setMenu(false)}>
            <TrendingUp />
            Reports
          </a>
        </nav>
        <div className="side-status">
          <i />
          <div>
            <strong>System online</strong>
            <small>API and database healthy</small>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut />
          Log out
        </button>
      </aside>
      <main className="main">
        <header>
          <button className="menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <small>INVENTORY COMMAND CENTER</small>
            <h1>Good morning, {user.name.split(" ")[0]}.</h1>
          </div>
          <button className="add" onClick={() => setDialog("product")}>
            <PackagePlus />
            Add product
          </button>
        </header>
        {error && <div className="error">{error}</div>}
        <section className="kpis" id="dashboard">
          <article className="featured">
            <small>INVENTORY VALUE</small>
            <strong>
              ₹{Math.round(s.inventory_value).toLocaleString("en-IN")}
            </strong>
            <span>
              <TrendingUp /> Current retail value
            </span>
          </article>
          <article>
            <i>
              <Boxes />
            </i>
            <div>
              <small>UNITS IN STOCK</small>
              <strong>{s.units_in_stock}</strong>
            </div>
          </article>
          <article>
            <i className="warning">
              <AlertTriangle />
            </i>
            <div>
              <small>LOW STOCK</small>
              <strong>{s.low_stock_count}</strong>
            </div>
          </article>
          <article>
            <i>
              <ClipboardList />
            </i>
            <div>
              <small>ACTIVE PRODUCTS</small>
              <strong>{s.product_count}</strong>
            </div>
          </article>
        </section>
        <div className="grid">
          <section className="panel products" id="products">
            <div className="panel-head">
              <div>
                <small>PRODUCT CATALOGUE</small>
                <h2>Stock overview</h2>
              </div>
              <label>
                <Search />
                <input
                  placeholder="Search product or SKU"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="table">
              <div className="tr labels">
                <span>Product</span>
                <span>Category</span>
                <span>Price</span>
                <span>Stock</span>
                <span>Status</span>
                <span />
              </div>
              {products.map((p) => (
                <button
                  className="tr product-row"
                  key={p.id}
                  onClick={() => openMovement(p)}
                >
                  <span>
                    <i>{p.name.slice(0, 2).toUpperCase()}</i>
                    <b>
                      {p.name}
                      <small>{p.sku}</small>
                    </b>
                  </span>
                  <span>{p.category}</span>
                  <span>₹{p.selling_price.toLocaleString("en-IN")}</span>
                  <span>
                    <b>
                      {p.quantity}
                      <small>units</small>
                    </b>
                  </span>
                  <span>
                    <em className={p.low_stock ? "low" : "good"}>
                      {p.low_stock ? "Low stock" : "Healthy"}
                    </em>
                  </span>
                  <span>
                    <ChevronRight />
                  </span>
                </button>
              ))}
            </div>
          </section>
          <aside className="panel activity" id="movements">
            <div className="panel-head">
              <div>
                <small>ACTIVITY LOG</small>
                <h2>{audit ? "Full audit trail" : "Recent movements"}</h2>
              </div>
            </div>
            <div className="movements">
              {(audit || data?.recentMovements || []).map((m) => (
                <div key={m.id}>
                  <span className={m.quantity_change > 0 ? "in" : "out"}>
                    {m.quantity_change > 0 ? "+" : ""}
                    {m.quantity_change}
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>
                      {m.movement_type} · {m.user_name}
                    </small>
                  </div>
                  <time>
                    {new Date(m.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </div>
              ))}
            </div>
            <button className="view" onClick={toggleAudit}>
              {audit ? "Show recent activity" : "View full audit trail"}{" "}
              <ArrowRight />
            </button>
          </aside>
        </div>
        <section className="category-strip" id="reports">
          <div>
            <small>CATEGORY SNAPSHOT</small>
            <h2>Where your inventory sits</h2>
          </div>
          {data?.categories.map((c, i) => (
            <article key={c.category}>
              <span
                style={{ width: `${Math.min(100, (c.units / 30) * 100)}%` }}
              />
              <b>0{i + 1}</b>
              <strong>{c.category}</strong>
              <small>
                {c.units} units · {c.products} products
              </small>
            </article>
          ))}
        </section>
      </main>
      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <button className="modal-close" aria-label="Close" onClick={() => setDialog(null)}>
              <X />
            </button>
            {dialog === "product" ? (
              <form onSubmit={addProduct}>
                <p>NEW PRODUCT</p>
                <h2>Add inventory item</h2>
                <div className="form-grid">
                  <label>
                    SKU
                    <input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    Product name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    Selling price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Opening quantity
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Reorder level
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={reorder}
                      onChange={(e) => setReorder(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <button className="modal-primary" disabled={loading}>
                  {loading ? "Saving…" : "Add product"}
                </button>
              </form>
            ) : (
              <form onSubmit={addMovement}>
                <p>STOCK MOVEMENT</p>
                <h2>{selected?.name}</h2>
                <label>
                  Movement type
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value)}
                  >
                    <option value="purchase">Purchase / stock in</option>
                    <option value="sale">Sale / stock out</option>
                    <option value="adjustment">Positive adjustment</option>
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Note
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    placeholder="Optional reason"
                  />
                </label>
                <button className="modal-primary" disabled={loading}>
                  {loading ? "Updating…" : "Record movement"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Login({
  email,
  password,
  setEmail,
  setPassword,
  submit,
  error,
  loading,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  submit: (e: React.FormEvent) => void;
  error: string;
  loading: boolean;
}) {
  return (
    <main className="login">
      <section>
        <div className="brand light">
          <span>SP</span>StockPilot
        </div>
        <div className="login-copy">
          <p>INVENTORY, WITHOUT THE GUESSWORK</p>
          <h1>
            Know what&apos;s moving.
            <br />
            <em>Before it&apos;s missing.</em>
          </h1>
          <span>
            A focused operations dashboard for small teams that need clear stock
            numbers and a reliable audit trail.
          </span>
        </div>
        <div className="signal">
          <i />
          <span>5 products monitored</span>
          <b>Live database</b>
        </div>
      </section>
      <form onSubmit={submit}>
        <p>MANAGER ACCESS</p>
        <h2>Open your inventory</h2>
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button disabled={loading}>
          {loading ? "Checking inventory…" : "Sign in"}
          <ArrowRight />
        </button>
        <div className="demo">
          <strong>Demo account</strong>
          <span>manager@stockpilot.app · Demo@123</span>
        </div>
      </form>
    </main>
  );
}
