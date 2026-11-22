import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { asyncHandler, HttpError, toPositiveInt } from "../utils.js";

const router = Router();

const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
const PAYMENTS = ["UPI", "Card", "COD"];

const ORDER_SELECT = `
  SELECT o.order_id AS id, o.customer_id, c.name AS customer,
         o.order_date AS date, o.status, o.payment_method AS method,
         o.total_amount AS total,
         (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.order_id) AS items
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id`;

// GET /api/orders
router.get("/", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${ORDER_SELECT} ORDER BY o.order_id DESC`);
  res.json(rows);
}));

// GET /api/orders/:id  - the order plus its line items
router.get("/:id", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Order id");
  const [[order]] = await pool.query(`${ORDER_SELECT} WHERE o.order_id = ?`, [id]);
  if (!order) throw new HttpError(404, "Order not found.");
  const [items] = await pool.query(
    `SELECT oi.product_id, p.name, p.emoji, oi.quantity, oi.unit_price,
            oi.quantity * oi.unit_price AS line_total
     FROM order_items oi JOIN products p ON p.product_id = oi.product_id
     WHERE oi.order_id = ?`, [id]);
  res.json({ ...order, lines: items });
}));

// POST /api/orders   body: { customer_id, payment_method, items: [{ product_id, quantity }] }
// Everything below happens in ONE transaction:
//   check stock -> create order -> create items -> reduce stock -> log movement
// If any step fails, the whole thing is rolled back and nothing is saved.
router.post("/", asyncHandler(async (req, res) => {
  const customerId = toPositiveInt(req.body.customer_id, "Customer");
  const payment = PAYMENTS.includes(req.body.payment_method) ? req.body.payment_method : "UPI";
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) throw new HttpError(400, "Add at least one item.");

  // Merge duplicate product ids and validate quantities
  const wanted = new Map();
  for (const it of req.body.items) {
    const pid = toPositiveInt(it.product_id, "Product");
    const qty = toPositiveInt(it.quantity, "Quantity");
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }
  const productIds = [...wanted.keys()].sort((a, b) => a - b);

  const orderId = await withTransaction(async (conn) => {
    const [[customer]] = await conn.query("SELECT customer_id FROM customers WHERE customer_id = ?", [customerId]);
    if (!customer) throw new HttpError(400, "Customer does not exist.");

    // FOR UPDATE locks these product rows until we commit, so two orders placed at
    // the same time can't both grab the last unit (this prevents overselling).
    const [products] = await conn.query(
      "SELECT product_id, name, price, stock_qty FROM products WHERE product_id IN (?) AND is_active = 1 ORDER BY product_id FOR UPDATE",
      [productIds]
    );
    if (products.length !== productIds.length) throw new HttpError(400, "One or more products do not exist.");

    for (const p of products) {
      if (p.stock_qty < wanted.get(p.product_id)) {
        throw new HttpError(400, `Not enough stock for ${p.name} (only ${p.stock_qty} left).`);
      }
    }

    const [o] = await conn.query(
      "INSERT INTO orders (customer_id, status, payment_method) VALUES (?, 'Pending', ?)",
      [customerId, payment]
    );
    let total = 0;
    for (const p of products) {
      const qty = wanted.get(p.product_id);
      total += qty * p.price;
      await conn.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        [o.insertId, p.product_id, qty, p.price]
      );
      await conn.query("UPDATE products SET stock_qty = stock_qty - ? WHERE product_id = ?", [qty, p.product_id]);
      await conn.query(
        "INSERT INTO inventory_transactions (product_id, change_qty, reason, order_id) VALUES (?, ?, 'SALE', ?)",
        [p.product_id, -qty, o.insertId]
      );
    }
    await conn.query("UPDATE orders SET total_amount = ? WHERE order_id = ?", [total, o.insertId]);
    return o.insertId;
  });

  const [[order]] = await pool.query(`${ORDER_SELECT} WHERE o.order_id = ?`, [orderId]);
  res.status(201).json(order);
}));

// PATCH /api/orders/:id/status   body: { status }
// Cancelling an order puts the stock back (again inside a transaction).
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Order id");
  const status = req.body.status;
  if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid status.");

  await withTransaction(async (conn) => {
    const [[order]] = await conn.query("SELECT status FROM orders WHERE order_id = ? FOR UPDATE", [id]);
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status === status) return;
    if (order.status === "Cancelled") throw new HttpError(400, "A cancelled order cannot be changed.");
    if (status === "Cancelled" && order.status === "Delivered") throw new HttpError(400, "A delivered order cannot be cancelled.");

    if (status === "Cancelled") {
      const [items] = await conn.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id", [id]);
      for (const it of items) {
        await conn.query("UPDATE products SET stock_qty = stock_qty + ? WHERE product_id = ?", [it.quantity, it.product_id]);
        await conn.query(
          "INSERT INTO inventory_transactions (product_id, change_qty, reason, order_id) VALUES (?, ?, 'ORDER_CANCELLED', ?)",
          [it.product_id, it.quantity, id]
        );
      }
    }
    await conn.query("UPDATE orders SET status = ? WHERE order_id = ?", [status, id]);
  });

  const [[updated]] = await pool.query(`${ORDER_SELECT} WHERE o.order_id = ?`, [id]);
  res.json(updated);
}));

export default router;
