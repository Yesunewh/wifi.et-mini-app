"use strict";
/**
 * SQLite storage using Node's built-in node:sqlite (Node 22.13+), so there are no
 * native dependencies. For production scale, swap this module for PostgreSQL;
 * the rest of the code only uses the functions exported here.
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  open_id TEXT NOT NULL UNIQUE,
  msisdn TEXT,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merch_order_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  package_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  recipient_msisdn TEXT,
  status TEXT NOT NULL,              -- CREATED, PAYING, PAID, FULFILLED, FAILED, REFUNDED
  prepay_id TEXT,
  payment_order_id TEXT,
  trans_id TEXT,
  voucher_code TEXT,
  voucher_ref TEXT,
  started_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  fulfilled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merch_order_id TEXT,
  source TEXT NOT NULL,               -- notify, query
  signature_valid INTEGER,            -- 1, 0, NULL (no telebirr public key configured)
  body TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Info',
  icon TEXT NOT NULL DEFAULT 'bell',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS hotspots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT,
  lat REAL,
  lng REAL,
  status TEXT NOT NULL DEFAULT 'online'
);
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  legal_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  sector TEXT,
  tin TEXT NOT NULL,
  license_no TEXT NOT NULL,
  city TEXT,
  contact_person TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  documents TEXT NOT NULL,            -- JSON: { license, tin, id } -> stored file names
  status TEXT NOT NULL,               -- review, verified, rejected
  review_note TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  formats TEXT NOT NULL,
  areas TEXT NOT NULL,
  budget TEXT,
  start_date TEXT,
  contact_by TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function openDb(dataDir, { memory = false } = {}) {
  let file = ":memory:";
  if (!memory) {
    fs.mkdirSync(dataDir, { recursive: true });
    file = path.join(dataDir, "wifiet.db");
  }
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction (node:sqlite has no helper for this). */
function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { openDb, tx };
