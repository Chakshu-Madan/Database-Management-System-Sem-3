import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler, HttpError, toPositiveInt } from "../utils.js";

const router = Router();

// Indian mobile numbers: exactly 10 digits, first digit 6, 7, 8 or 9.
// Accepts input like "98100 00001", "+91 9810000001" or "09810000001" and stores 10 digits.
function cleanPhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;                                   // phone is optional
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
    throw new HttpError(400, "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
  }
  return digits;
}

function validateCustomer(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const city = String(body.city || "").trim() || null;
  if (name.length < 2) throw new HttpError(400, "Customer name must be at least 2 characters.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  return { name, email, phone: cleanPhone(body.phone), city };
}

const CUSTOMER_SELECT = `
  SELECT c.customer_id AS id, c.name, c.email, c.phone, c.city, c.created_at,
         COUNT(o.order_id) AS orders,
         COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total_amount END), 0) AS total_spent,
         MAX(o.order_date) AS last_order
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.customer_id`;

// GET /api/customers  - each customer with order count + total spent (JOIN + aggregates)
router.get("/", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${CUSTOMER_SELECT} GROUP BY c.customer_id ORDER BY c.customer_id DESC`);
  res.json(rows);
}));

// GET /api/customers/:id  - one customer plus ALL of their orders
router.get("/:id", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Customer id");
  const [[customer]] = await pool.query(`${CUSTOMER_SELECT} WHERE c.customer_id = ? GROUP BY c.customer_id`, [id]);
  if (!customer) throw new HttpError(404, "Customer not found.");
  const [orders] = await pool.query(
    `SELECT o.order_id AS id, o.order_date AS date, o.status, o.payment_method AS method,
            o.total_amount AS total,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.order_id) AS items
     FROM orders o WHERE o.customer_id = ? ORDER BY o.order_id DESC`, [id]);
  res.json({ ...customer, order_list: orders });
}));

// POST /api/customers
router.post("/", asyncHandler(async (req, res) => {
  const { name, email, phone, city } = validateCustomer(req.body);
  const [r] = await pool.query(
    "INSERT INTO customers (name, email, phone, city) VALUES (?, ?, ?, ?)",
    [name, email, phone, city]
  );
  res.status(201).json({ id: r.insertId, name, email, phone, city, orders: 0, total_spent: 0, last_order: null });
}));

// PUT /api/customers/:id  - correct a customer's details
router.put("/:id", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Customer id");
  const { name, email, phone, city } = validateCustomer(req.body);
  const [r] = await pool.query(
    "UPDATE customers SET name = ?, email = ?, phone = ?, city = ? WHERE customer_id = ?",
    [name, email, phone, city, id]
  );
  if (!r.affectedRows) throw new HttpError(404, "Customer not found.");
  res.json({ id, name, email, phone, city });
}));

export default router;