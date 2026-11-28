# Stockly — E-Commerce Order & Inventory Management (DBMS Capstone)

**Live Demo:** [https://dbms-capstone-stockly.onrender.com/](https://dbms-capstone-stockly.onrender.com/) _(Free tier instance—may take ~60 seconds to wake up on first visit.)_

Full-stack web application built with a **React (Vite)** frontend, **Node.js/Express** backend, and **MySQL / TiDB Cloud** relational database.

## Folder Structure

```text
Stockly/
├── database/       # schema.sql (tables, constraints, views)
├── backend/        # Express API, seed/ (synthetic sample data generator)
├── frontend/       # React 19 + Vite web interface
├── package.json    # Root build/start scripts for deployment
└── .node-version   # Node.js runtime version
```

## Database Design & Sample Data

- **Schema:** Six tables (`categories`, `products`, `customers`, `orders`, `order_items`, `inventory_transactions`) in Third Normal Form (3NF) and two views (`v_low_stock`, `v_revenue_by_category`).
- **Constraints & Transactions:** Uses primary/foreign keys, `UNIQUE`, `ENUM`, and `CHECK` constraints (`price > 0`, `stock >= 0`). Order placement runs inside a single transaction (`SELECT ... FOR UPDATE` with automatic `ROLLBACK` on error), and past-ordered products use soft-deletes.
- **Synthetic Data (`npm run seed`):** Uses Faker (Indian locale) to generate 42 products, 150 customers, 450 orders, and ~990 inventory transactions, verifying that order totals and stock movements reconcile.

## Run It Locally (Windows)

**Prerequisites:** Node.js 22+ and MySQL installed locally. Open your terminal inside the `Stockly` folder.

### 1. Create the database tables

Run in **Command Prompt (`cmd`)** _(PowerShell does not support `<` input redirection)_:

```cmd
mysql -u root -p < database\schema.sql
```

### 2. Start the backend

```powershell
cd backend
copy .env.example .env
```

Open `.env` and add your local MySQL password, then run:

```powershell
npm install
npm run seed
npm run dev
```

### 3. Start the frontend (in a second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Deploying Online

- Running `npm run build` and `npm start` from the `Stockly` root builds the React frontend and serves both the UI and API through a single Express server.
- Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_SSL=true` in your hosting environment.
- To initialize a cloud database (e.g., TiDB Cloud), add your credentials to `backend/.env.cloud` and run `npm run cloud:setup` followed by `npm run cloud:seed`. _(Note: `.env` and `.env.cloud` are ignored by Git.)_
