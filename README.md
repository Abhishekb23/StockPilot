# StockPilot

StockPilot is an inventory dashboard for a small shop or warehouse. It includes a responsive React web app, an Expo React Native app, a Node.js/Express API, and PostgreSQL.

The project looks professional while remaining believable for an early-career developer: focused inventory workflows, readable SQL, practical security, and a straightforward deployment.

## Live API and demo account

- API: https://stockpilot.hrms.ssym.co.in
- Health check: https://stockpilot.hrms.ssym.co.in/health
- Manager login: `manager@stockpilot.app` / `Demo@123`

Both clients already point to the live API.

## What it demonstrates

- Manager/staff JWT authentication and role checks
- Product catalogue with search and low-stock state
- Purchase, sale, and adjustment movement history
- Transaction-safe stock updates
- Dashboard totals calculated from PostgreSQL
- Responsive web UI and a mobile inventory view

## Structure

```text
stockpilot/
├── api/       Express + TypeScript + PostgreSQL
├── web/       React + TypeScript + Vite
└── mobile/    React Native + Expo
```

Request flow: `React / React Native → HTTPS REST API → Express → PostgreSQL`.

## Database design

- `users`: manager and staff accounts
- `suppliers`: optional supplier details
- `products`: SKU, category, price, quantity, and reorder level
- `stock_movements`: append-only record of purchases, sales, and adjustments

The product stores the current quantity for fast reads, while the movement table preserves an audit trail explaining each change.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | API and database health |
| POST | `/api/auth/login` | Sign in and receive a JWT |
| GET | `/api/dashboard` | Inventory totals and category summary |
| GET | `/api/products` | Search and list products |
| POST | `/api/products` | Create a product (manager only) |
| POST | `/api/products/:id/movements` | Record a stock change |
| GET | `/api/movements` | Recent movement audit trail |

Protected routes expect `Authorization: Bearer <token>`.

## Run locally

Requirements: Node.js 18+, npm, and PostgreSQL.

1. Create a `stockpilot` database and run `api/sql/schema.sql`.
2. In `api`, copy `.env.example` to `.env`, update the database URL, then run:

```bash
npm install
npm run build
npm run seed
npm run dev
```

3. In `web`, optionally copy `.env.example` to `.env`, then run `npm install` and `npm run dev`.
4. In `mobile`, run `npm install` and `npm start`, then use Expo Go or an emulator.

The mobile API URL is near the top of `mobile/App.tsx`.

## Deploy the web app to Vercel

Push this folder to its own GitHub repository, import it into Vercel, and set:

- Root Directory: `web`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable (optional): `VITE_API_URL=https://stockpilot.hrms.ssym.co.in`

`web/vercel.json` already supports SPA routing.

## Interview talking points

**Why keep a stock movement table?**  Updating only the product quantity loses history. A movement row records who changed stock, how much it changed, why, and when, which makes debugging and basic auditing possible.

**How do you avoid inconsistent quantity updates?**  The API starts a database transaction, locks the product row, checks that the new quantity cannot go below zero, inserts the movement, and updates the product before committing.

**Why store current quantity if movements can be summed?**  Product lists and dashboards read quantity often. Storing it makes those reads simple and fast; the movement history remains available to explain the total.

**How is low stock detected?**  SQL compares `quantity` with `reorder_level`, so each product can have its own threshold rather than using one fixed number.

**What does role-based authorization do?**  Any signed-in worker can read inventory and record movement, while product creation requires the manager role. The API enforces this; hiding a button in the UI alone would not be secure.

**How does product search work?**  The endpoint accepts a search query and uses parameterized matching against product name, SKU, and category. Parameterization prevents user input from becoming executable SQL.

**What did you do for responsive design?**  Cards collapse into smaller grids, the sidebar becomes a mobile drawer, and the product table scrolls inside its own panel instead of widening the entire page.

**What would you add next?**  Barcode scanning, supplier purchase orders, CSV import/export, pagination, unit/integration tests, refresh tokens, and low-stock notifications.

## Honest résumé bullets

- Built an inventory management dashboard using React, React Native, Express, and PostgreSQL with product search, low-stock indicators, and stock movement history.
- Implemented role-aware JWT authorization and transaction-safe quantity updates that prevent inventory from becoming negative.
- Created responsive web and mobile interfaces and deployed the backend/database behind an HTTPS reverse proxy.

