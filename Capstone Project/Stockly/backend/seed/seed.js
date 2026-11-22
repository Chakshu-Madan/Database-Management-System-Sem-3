// ===================================================================
//  seed.js - fills the Stockly database with realistic sample data.
//
//  Run from the backend folder:   npm run seed
//
//  WARNING: it ERASES all rows in every table first, then inserts:
//    * ~41 products (real-style names, approximate rupee prices)
//    * ~150 customers (fake Indian names/phones; emails use example.com)
//    * ~450 orders over the last 6 months, with order items
//    * a full stock-movement log
//  Stock levels and order totals are calculated step by step, so the
//  numbers always add up (the script checks this at the end).
//
//  Same SEED = same data every time.  Try:  SEED=7 npm run seed
// ===================================================================
import { fakerEN_IN as faker } from "@faker-js/faker";
import { pool } from "../src/db.js";

/* ---------------- settings you can change ---------------- */
const CUSTOMER_COUNT = 150;
const ORDER_COUNT = 450;
const DAYS = 180;                          // orders are spread over this many days
const SEED = Number(process.env.SEED) || 2026;

/* ---------------- tiny seeded random helpers ---------------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
faker.seed(SEED);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
// weighted([["A", 70], ["B", 30]]) -> "A" 70% of the time
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) { if ((r -= w) <= 0) return value; }
  return pairs[pairs.length - 1][0];
}
const HOUR = 3600 * 1000, DAY = 24 * HOUR;

/* ---------------- 1. product catalogue ----------------
   Names are real-style products; prices are APPROXIMATE typical
   Indian retail prices (they change often) - fine for a demo.      */
const CATEGORIES = ["Electronics", "Accessories", "Fashion", "Home", "Fitness", "Stationery"];
const PRODUCTS = [
  // name, category, price, emoji, color
  ["boAt Rockerz 450 Wireless Headphones", "Electronics", 1499, "🎧", "lavender"],
  ["boAt Airdopes 141 Earbuds", "Electronics", 1299, "🎧", "blue"],
  ["Noise ColorFit Pulse Smartwatch", "Electronics", 1999, "⌚", "mint"],
  ["Mi Power Bank 3i 20000mAh", "Electronics", 2099, "🔋", "peach"],
  ["JBL Go 3 Portable Speaker", "Electronics", 2999, "🔊", "pink"],
  ["Logitech M235 Wireless Mouse", "Electronics", 799, "🖱️", "cream"],
  ["Portronics Bluetooth Keyboard", "Electronics", 1299, "⌨️", "blue"],
  ["SanDisk 128GB USB Pen Drive", "Electronics", 899, "💾", "mint"],
  ["TP-Link N300 WiFi Router", "Electronics", 1199, "📶", "lavender"],
  ["Mi 360° Home Security Camera", "Electronics", 2799, "📷", "peach"],
  ["Anker 20W USB-C Fast Charger", "Electronics", 1299, "🔌", "cream"],

  ["Wildcraft Laptop Backpack", "Accessories", 1799, "🎒", "peach"],
  ["Fastrack UV Protected Sunglasses", "Accessories", 1499, "🕶️", "blue"],
  ["Leather Bi-fold Wallet", "Accessories", 699, "👛", "cream"],
  ["Milton Steel Water Bottle 1L", "Accessories", 549, "🧴", "mint"],
  ["Silicone Phone Case", "Accessories", 349, "📱", "pink"],
  ["Laptop Sleeve 15.6 inch", "Accessories", 599, "💼", "lavender"],
  ["3-Fold Automatic Umbrella", "Accessories", 499, "☂️", "blue"],

  ["Puma Running Sneakers", "Fashion", 2999, "👟", "blue"],
  ["Levi's Slim Fit Jeans", "Fashion", 2499, "👖", "lavender"],
  ["Cotton Crew Neck T-Shirt", "Fashion", 599, "👕", "mint"],
  ["Hooded Fleece Sweatshirt", "Fashion", 1299, "🧥", "peach"],
  ["Formal Cotton Shirt", "Fashion", 1199, "👔", "cream"],
  ["Sports Socks (Pack of 3)", "Fashion", 299, "🧦", "pink"],
  ["Cotton Baseball Cap", "Fashion", 399, "🧢", "blue"],

  ["Prestige Induction Cooktop", "Home", 2199, "🍳", "peach"],
  ["Philips LED Bulb 9W (Pack of 4)", "Home", 499, "💡", "cream"],
  ["Ceramic Coffee Mug (Set of 2)", "Home", 449, "☕", "cream"],
  ["Cello Insulated Lunch Box", "Home", 699, "🍱", "mint"],
  ["Cotton Double Bedsheet Set", "Home", 999, "🛏️", "lavender"],
  ["Study Table Lamp", "Home", 999, "🪔", "peach"],
  ["Analog Wall Clock", "Home", 799, "🕰️", "blue"],
  ["Cotton Bath Towel (Set of 2)", "Home", 899, "🛁", "pink"],

  ["Anti-Skid Yoga Mat 6mm", "Fitness", 699, "🧘", "mint"],
  ["Neoprene Dumbbells 5kg (Pair)", "Fitness", 899, "🏋️", "lavender"],
  ["Speed Skipping Rope", "Fitness", 249, "➰", "peach"],
  ["Resistance Bands (Set of 5)", "Fitness", 599, "💪", "blue"],
  ["Protein Shaker Bottle 700ml", "Fitness", 399, "🥤", "pink"],

  ["Classmate Notebooks (Pack of 6)", "Stationery", 399, "📓", "cream"],
  ["Parker Vector Ball Pen", "Stationery", 349, "🖊️", "blue"],
  ["A4 Copier Paper 500 Sheets", "Stationery", 379, "📄", "mint"],
  ["Desk Organiser Stand", "Stationery", 549, "🗂️", "lavender"],
];

const CITIES = [["Delhi", 16], ["Mumbai", 14], ["Bengaluru", 12], ["Gurugram", 8], ["Jaipur", 8], ["Pune", 8],
  ["Hyderabad", 8], ["Chennai", 6], ["Kolkata", 6], ["Ahmedabad", 5], ["Lucknow", 4], ["Chandigarh", 3], ["Noida", 4], ["Indore", 3]];

const now = new Date();
const startDate = new Date(now.getTime() - (DAYS + 10) * DAY);   // when the shop "opened"

/* ---------------- 2. products ---------------- */
const products = PRODUCTS.map(([name, category, price, emoji, color], i) => ({
  id: 1001 + i, name, category, categoryId: CATEGORIES.indexOf(category) + 1,
  price, emoji, color,
  // cheaper products are bought more often, plus some randomness
  popularity: Math.pow(rand(), 2) * 8 + 0.5 + Math.pow(1500 / price, 0.5) * 2,
}));
const stock = {};
const txns = [];     // inventory_transactions rows (kept in memory first)
for (const p of products) {
  const opening = p.price > 2500 ? randInt(15, 40) : p.price > 1000 ? randInt(30, 80) : randInt(50, 150);
  stock[p.id] = opening;
  txns.push({ product_id: p.id, change_qty: opening, reason: "INITIAL", order_id: null, at: startDate });
}

/* ---------------- 3. customers ---------------- */
const customers = [];
const usedEmails = new Set();
for (let i = 0; i < CUSTOMER_COUNT; i++) {
  const first = faker.person.firstName(), last = faker.person.lastName();
  const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  let email, n = 0;
  do { email = `${slug(first)}.${slug(last)}${n ? n : ""}@example.com`; n++; } while (usedEmails.has(email));
  usedEmails.add(email);

  let phone;
  do {
    phone = weighted([["9", 35], ["8", 25], ["7", 25], ["6", 15]]) + faker.string.numeric(9);
  } while (/^(\d)\1{9}$/.test(phone));                 // never 9999999999

  customers.push({
    id: 5001 + i, name: `${first} ${last}`, email, phone, city: weighted(CITIES),
    // the first 20 joined at the very start so early orders have customers
    createdAt: i < 20 ? startDate : new Date(startDate.getTime() + rand() * (DAYS * DAY)),
    loyalty: Math.pow(rand(), 3) + 0.05,               // a few customers order a lot
  });
}

/* ---------------- 4. orders ---------------- */
function orderDate() {
  // more orders in recent weeks (a growing shop), mostly in daytime/evening
  const daysAgo = DAYS * Math.pow(rand(), 1.4);
  const d = new Date(now.getTime() - daysAgo * DAY);
  d.setHours(randInt(8, 23), randInt(0, 59), randInt(0, 59), 0);
  return d > now ? new Date(now.getTime() - 30 * 60 * 1000) : d;
}
function statusFor(ageDays) {
  if (ageDays < 1) return weighted([["Pending", 50], ["Processing", 40], ["Cancelled", 10]]);
  if (ageDays < 3) return weighted([["Pending", 5], ["Processing", 35], ["Shipped", 50], ["Cancelled", 10]]);
  if (ageDays < 7) return weighted([["Shipped", 40], ["Delivered", 50], ["Cancelled", 10]]);
  return weighted([["Delivered", 91], ["Cancelled", 9]]);
}

const orders = Array.from({ length: ORDER_COUNT }, () => ({ date: orderDate() })).sort((a, b) => a.date - b.date);
orders.forEach((o, i) => {
  o.id = 2001 + i;
  const eligible = customers.filter((c) => c.createdAt <= o.date);
  const total = eligible.reduce((s, c) => s + c.loyalty, 0);
  let r = rand() * total;
  o.customer = eligible.find((c) => (r -= c.loyalty) <= 0) || eligible[0];
  o.payment = weighted([["UPI", 55], ["Card", 25], ["COD", 20]]);
  o.status = statusFor((now - o.date) / DAY);

  // 1-4 different products per order
  const wanted = weighted([[1, 45], [2, 30], [3, 15], [4, 10]]);
  const chosen = new Map();
  while (chosen.size < wanted) {
    const wsum = products.reduce((s, p) => s + p.popularity, 0);
    let x = rand() * wsum;
    const p = products.find((p) => (x -= p.popularity) <= 0) || products[0];
    if (chosen.has(p.id)) continue;
    const qty = p.price < 600 ? weighted([[1, 50], [2, 30], [3, 15], [4, 5]]) : weighted([[1, 82], [2, 15], [3, 3]]);
    chosen.set(p.id, { product: p, qty });
  }
  o.items = [...chosen.values()];
  o.total = o.items.reduce((s, it) => s + it.qty * it.product.price, 0);
  if (o.status === "Cancelled") {
    o.cancelAt = new Date(Math.min(o.date.getTime() + randInt(1, 30) * HOUR, now.getTime() - 5 * 60 * 1000));
  }
});

/* ---------------- 5. replay everything in time order to build the stock log ----------------
   A sale reduces stock; a cancellation returns it; if stock runs out
   the shop "restocks" first - exactly like a real inventory.          */
const events = [];
for (const o of orders) {
  events.push({ t: o.date, type: "sale", order: o });
  if (o.cancelAt) events.push({ t: o.cancelAt, type: "cancel", order: o });
}
events.sort((a, b) => a.t - b.t || (a.type === "sale" ? -1 : 1));

for (const ev of events) {
  for (const { product, qty } of ev.order.items) {
    if (ev.type === "sale") {
      if (stock[product.id] < qty) {
        const add = randInt(30, 100);
        stock[product.id] += add;
        txns.push({ product_id: product.id, change_qty: add, reason: "RESTOCK", order_id: null, at: new Date(ev.t.getTime() - randInt(1, 6) * HOUR) });
      }
      stock[product.id] -= qty;
      txns.push({ product_id: product.id, change_qty: -qty, reason: "SALE", order_id: ev.order.id, at: ev.t });
    } else {
      stock[product.id] += qty;
      txns.push({ product_id: product.id, change_qty: qty, reason: "ORDER_CANCELLED", order_id: ev.order.id, at: ev.t });
    }
    if (stock[product.id] < 0) throw new Error("Simulation bug: negative stock");
  }
}

// A few products end up low / out of stock, so the dashboard alerts have something to show
const targets = [0, 3, 5, 8, 9];
[...products].sort(() => rand() - 0.5).slice(0, targets.length).forEach((p, i) => {
  const change = targets[i] - stock[p.id];
  if (change < 0) {
    stock[p.id] += change;
    txns.push({ product_id: p.id, change_qty: change, reason: "ADJUSTMENT", order_id: null, at: now });
  }
});
txns.sort((a, b) => a.at - b.at);

/* ---------------- 6. write to MySQL ---------------- */
async function bulkInsert(conn, table, columns, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    await conn.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ?`, [rows.slice(i, i + chunk)]);
  }
}

async function main() {
  console.log(`Seeding with SEED=${SEED} ...`);
  const conn = await pool.getConnection();
  try {
    // 1) wipe everything (TRUNCATE also restarts the id counters)
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of ["inventory_transactions", "order_items", "orders", "customers", "products", "categories"]) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    // 2) insert it all inside ONE transaction: all or nothing
    await conn.beginTransaction();
    await bulkInsert(conn, "categories", ["category_id", "name"], CATEGORIES.map((n, i) => [i + 1, n]));
    await bulkInsert(conn, "products",
      ["product_id", "name", "category_id", "price", "stock_qty", "emoji", "color", "is_active", "created_at"],
      products.map((p) => [p.id, p.name, p.categoryId, p.price, stock[p.id], p.emoji, p.color, 1, startDate]));
    await bulkInsert(conn, "customers", ["customer_id", "name", "email", "phone", "city", "created_at"],
      customers.map((c) => [c.id, c.name, c.email, c.phone, c.city, c.createdAt]));
    await bulkInsert(conn, "orders", ["order_id", "customer_id", "order_date", "status", "payment_method", "total_amount"],
      orders.map((o) => [o.id, o.customer.id, o.date, o.status, o.payment, o.total]));
    await bulkInsert(conn, "order_items", ["order_id", "product_id", "quantity", "unit_price"],
      orders.flatMap((o) => o.items.map((it) => [o.id, it.product.id, it.qty, it.product.price])));
    await bulkInsert(conn, "inventory_transactions", ["product_id", "change_qty", "reason", "order_id", "created_at"],
      txns.map((t) => [t.product_id, t.change_qty, t.reason, t.order_id, t.at]));
    await conn.commit();

    // 3) self-check: do the numbers add up?
    const [[badTotals]] = await conn.query(`
      SELECT COUNT(*) AS n FROM orders o
      JOIN (SELECT order_id, SUM(quantity * unit_price) AS s FROM order_items GROUP BY order_id) x ON x.order_id = o.order_id
      WHERE o.total_amount <> x.s`);
    const [[badStock]] = await conn.query(`
      SELECT COUNT(*) AS n FROM products p
      LEFT JOIN (SELECT product_id, SUM(change_qty) AS s FROM inventory_transactions GROUP BY product_id) t ON t.product_id = p.product_id
      WHERE p.stock_qty <> COALESCE(t.s, 0) OR p.stock_qty < 0`);
    const [counts] = await conn.query(`
      SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM products) AS products,
             (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM orders) AS orders,
             (SELECT COUNT(*) FROM order_items) AS order_items, (SELECT COUNT(*) FROM inventory_transactions) AS stock_movements,
             (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status <> 'Cancelled') AS revenue`);
    const [byStatus] = await conn.query("SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC");

    console.log("\nRows created:", counts[0]);
    console.log("Orders by status:", byStatus.map((r) => `${r.status}=${r.n}`).join(", "));
    console.log(badTotals.n === 0 ? "CHECK OK: every order total equals the sum of its items" : `CHECK FAILED: ${badTotals.n} orders have wrong totals`);
    console.log(badStock.n === 0 ? "CHECK OK: every product's stock equals the sum of its stock movements" : `CHECK FAILED: ${badStock.n} products have wrong stock`);
    console.log("\nDone. Refresh the app in your browser.");
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    console.error("\nSeeding failed:", err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
