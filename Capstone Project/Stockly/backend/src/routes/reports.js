import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../utils.js";

const router = Router();

// GET /api/reports/summary - all the numbers for the Reports page, straight from SQL
router.get("/summary", asyncHandler(async (_req, res) => {
  const [[sales]] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue,
           COUNT(*)                       AS active_orders,
           COALESCE(AVG(total_amount), 0) AS avg_order_value
    FROM orders WHERE status <> 'Cancelled'`);
  const [[fulfil]] = await pool.query(
    "SELECT COUNT(*) AS n FROM orders WHERE status IN ('Pending','Processing')");
  const [[stock]] = await pool.query(
    "SELECT COALESCE(SUM(stock_qty), 0) AS units FROM products WHERE is_active = 1");
  const [byCategory] = await pool.query("SELECT * FROM v_revenue_by_category ORDER BY revenue DESC");
  const [topCustomers] = await pool.query(`
    SELECT c.name, COUNT(o.order_id) AS orders, SUM(o.total_amount) AS spent
    FROM customers c JOIN orders o ON o.customer_id = c.customer_id
    WHERE o.status <> 'Cancelled'
    GROUP BY c.customer_id ORDER BY spent DESC LIMIT 5`);

  res.json({
    revenue: sales.revenue,
    activeOrders: sales.active_orders,
    avgOrderValue: Math.round(sales.avg_order_value),
    ordersToFulfil: fulfil.n,
    unitsInStock: Number(stock.units),
    byCategory,
    topCustomers,
  });
}));

// GET /api/reports/stock-movements - latest rows of the inventory audit log
router.get("/stock-movements", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT t.txn_id AS id, t.product_id, p.name AS product, t.change_qty AS change_qty,
           t.reason, t.order_id, t.created_at
    FROM inventory_transactions t JOIN products p ON p.product_id = t.product_id
    ORDER BY t.txn_id DESC LIMIT 15`);
  res.json(rows);
}));

export default router;
