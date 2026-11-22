import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { pool } from "./db.js";
import productsRouter from "./routes/products.js";
import customersRouter from "./routes/customers.js";
import ordersRouter from "./routes/orders.js";
import reportsRouter from "./routes/reports.js";

const app = express();
app.use(cors());          // allow the React app (another port) to call this API
app.use(express.json());  // parse JSON request bodies into req.body

// Health check: proves the server AND the database are reachable
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Database not reachable" });
  }
});

app.use("/api/products", productsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reports", reportsRouter);

app.use("/api", (_req, res) => res.status(404).json({ message: "Route not found" }));

// ---- Serve the React app (production). After "npm run build" the frontend lives in
// frontend/dist; Express hands it out, so ONE server delivers both the site and the API.
// (During local development this folder usually does not exist and Vite serves the site.)
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (fs.existsSync(path.join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

// Central error handler: every thrown error ends up here
app.use((err, _req, res, _next) => {
  if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "That value already exists (duplicate)." });
  if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ message: "Referenced record does not exist." });
  if (["ER_CHECK_CONSTRAINT_VIOLATED", "ER_CONSTRAINT_FAILED"].includes(err.code)) return res.status(400).json({ message: "A value broke a database rule (for example an invalid phone number, price or stock)." });
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Stockly API running on http://localhost:${PORT}`));
