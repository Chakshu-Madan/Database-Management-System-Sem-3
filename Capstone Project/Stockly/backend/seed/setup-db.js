// ===================================================================
//  setup-db.js - creates all tables/views in the database named by
//  DB_NAME, using database/schema.sql. Handy for cloud databases where
//  you can't (or don't want to) use the mysql command line.
//
//  The database itself must already exist (cloud providers create one
//  for you). WARNING: it first DROPS the Stockly tables if they exist.
// ===================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { dbConfig } from "../src/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.resolve(here, "../../database/schema.sql");

// schema.sql also does DROP/CREATE DATABASE and USE, which are meant for your own laptop.
// Here we skip those lines and use the database from your settings instead.
const schema = fs.readFileSync(schemaFile, "utf8")
  .replace(/^\s*(DROP DATABASE|CREATE DATABASE|USE)\b.*$/gim, "");

const cleanUp = `
  DROP VIEW IF EXISTS v_low_stock;
  DROP VIEW IF EXISTS v_revenue_by_category;
  DROP TABLE IF EXISTS inventory_transactions;
  DROP TABLE IF EXISTS order_items;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS customers;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS categories;`;

async function main() {
  console.log(`Creating tables in "${dbConfig.database}" on ${dbConfig.host}:${dbConfig.port} ...`);
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    await conn.query(cleanUp);
    await conn.query(schema);
    const [tables] = await conn.query("SHOW FULL TABLES");
    console.log("Done. Objects now in the database:");
    tables.forEach((row) => console.log("  -", Object.values(row).join("  ")));
    console.log("\nNext step: npm run seed   (or  npm run cloud:seed  for the cloud database)");
  } catch (err) {
    console.error("\nSetup failed:", err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
main();
