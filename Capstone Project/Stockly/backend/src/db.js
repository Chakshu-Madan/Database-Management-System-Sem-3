// -----------------------------------------------------------------
//  db.js - ONE shared connection pool for the whole backend.
//  A pool keeps several connections open and hands them out per
//  request, which is much faster than reconnecting every time.
// -----------------------------------------------------------------
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Plain connection settings (also reused by seed/setup-db.js).
// Cloud databases (TiDB, Aiven, ...) need an encrypted connection: set DB_SSL=true.
export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stockly",
  decimalNumbers: true, // return DECIMAL columns as numbers instead of strings
  ssl: String(process.env.DB_SSL).toLowerCase() === "true"
    ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
    : undefined,
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
});

// Helper for multi-step work that must succeed or fail AS ONE UNIT.
// If anything inside throws, every change is rolled back.
export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
