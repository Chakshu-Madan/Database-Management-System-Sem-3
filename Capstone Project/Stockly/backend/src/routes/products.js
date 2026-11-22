import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { asyncHandler, HttpError, toPositiveInt } from "../utils.js";

const router = Router();

// Base query used by list + single product.
// "sold" is computed live with a JOIN + GROUP BY (never stored twice).
const PRODUCT_SELECT = `
  SELECT p.product_id AS id, p.name, p.category_id, c.name AS category,
         p.price, p.stock_qty AS stock, p.emoji, p.color,
         COALESCE(s.sold, 0) AS sold
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
  LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS sold
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE o.status <> 'Cancelled'
      GROUP BY oi.product_id
  ) s ON s.product_id = p.product_id
  WHERE p.is_active = 1`;

function validateProduct(body) {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  if (name.length < 2) throw new HttpError(400, "Product name must be at least 2 characters.");
  if (!(price > 0)) throw new HttpError(400, "Price must be greater than 0.");
  return { name, price, category_id: toPositiveInt(body.category_id, "Category") };
}

// GET /api/products/categories  -> for dropdowns
router.get("/categories", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query("SELECT category_id AS id, name FROM categories ORDER BY name");
  res.json(rows);
}));

// GET /api/products
router.get("/", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${PRODUCT_SELECT} ORDER BY p.product_id DESC`);
  res.json(rows);
}));

// POST /api/products
router.post("/", asyncHandler(async (req, res) => {
  const { name, price, category_id } = validateProduct(req.body);
  const stock = Number(req.body.stock ?? 0);
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, "Opening stock must be 0 or more.");
  const emoji = String(req.body.emoji || "📦").slice(0, 8);

  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      "INSERT INTO products (name, category_id, price, stock_qty, emoji) VALUES (?, ?, ?, ?, ?)",
      [name, category_id, price, stock, emoji]
    );
    if (stock > 0) {
      await conn.query(
        "INSERT INTO inventory_transactions (product_id, change_qty, reason) VALUES (?, ?, 'INITIAL')",
        [r.insertId, stock]
      );
    }
    return r.insertId;
  });
  const [[product]] = await pool.query(`${PRODUCT_SELECT} AND p.product_id = ?`, [id]);
  res.status(201).json(product);
}));

// PUT /api/products/:id  (edit name / category / price)
router.put("/:id", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Product id");
  const { name, price, category_id } = validateProduct(req.body);
  const [r] = await pool.query(
    "UPDATE products SET name = ?, category_id = ?, price = ? WHERE product_id = ? AND is_active = 1",
    [name, category_id, price, id]
  );
  if (!r.affectedRows) throw new HttpError(404, "Product not found.");
  const [[product]] = await pool.query(`${PRODUCT_SELECT} AND p.product_id = ?`, [id]);
  res.json(product);
}));

// PATCH /api/products/:id/stock   body: { change: +10 | -3 }
router.patch("/:id/stock", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Product id");
  const change = Number(req.body.change);
  if (!Number.isInteger(change) || change === 0) throw new HttpError(400, "Change must be a non-zero whole number.");

  await withTransaction(async (conn) => {
    // The "stock_qty + ? >= 0" condition makes the DATABASE refuse to go negative,
    // even if two people click at exactly the same moment.
    const [r] = await conn.query(
      "UPDATE products SET stock_qty = stock_qty + ? WHERE product_id = ? AND is_active = 1 AND stock_qty + ? >= 0",
      [change, id, change]
    );
    if (!r.affectedRows) {
      const [[exists]] = await conn.query("SELECT product_id FROM products WHERE product_id = ? AND is_active = 1", [id]);
      throw exists ? new HttpError(400, "Stock cannot go below zero.") : new HttpError(404, "Product not found.");
    }
    await conn.query(
      "INSERT INTO inventory_transactions (product_id, change_qty, reason) VALUES (?, ?, ?)",
      [id, change, change > 0 ? "RESTOCK" : "ADJUSTMENT"]
    );
  });
  const [[product]] = await pool.query(`${PRODUCT_SELECT} AND p.product_id = ?`, [id]);
  res.json(product);
}));

// DELETE /api/products/:id
// A product that appears in past orders must stay in the database (order history
// needs it), so we only HIDE it (soft delete). Unused products are really deleted.
router.delete("/:id", asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, "Product id");
  const [[used]] = await pool.query("SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?", [id]);
  if (used.n > 0) {
    const [r] = await pool.query("UPDATE products SET is_active = 0 WHERE product_id = ?", [id]);
    if (!r.affectedRows) throw new HttpError(404, "Product not found.");
    return res.json({ deleted: "soft" });
  }
  const [r] = await pool.query("DELETE FROM products WHERE product_id = ?", [id]);
  if (!r.affectedRows) throw new HttpError(404, "Product not found.");
  res.json({ deleted: "hard" });
}));

export default router;
