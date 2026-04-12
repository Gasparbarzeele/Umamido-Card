// server/db.js — Base de données avec better-sqlite3 pur JS fallback
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './umamido.db';
const Database = require('better-sqlite3');
const db = new Database(path.resolve(DB_PATH));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE,
    phone TEXT, push_token TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
    stamps INTEGER DEFAULT 0, total_stamps INTEGER DEFAULT 0,
    rewards_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, card_id TEXT NOT NULL,
    action TEXT NOT NULL, location TEXT DEFAULT 'Umamido',
    staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL,
    role TEXT DEFAULT 'cashier', active INTEGER DEFAULT 1
  );
`);

const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff').get();
if (staffCount.count === 0) {
  db.prepare(`INSERT INTO staff VALUES ('staff_1','Caisse 1','1234','cashier',1)`).run();
  db.prepare(`INSERT INTO staff VALUES ('staff_2','Caisse 2','5678','cashier',1)`).run();
  db.prepare(`INSERT INTO staff VALUES ('admin_1','Manager','0000','admin',1)`).run();
  console.log('✅ Staff créé (PINs: 1234, 5678, 0000)');
}

// Wrap sync API to match async interface used in index.js
db.get_ = (sql, params) => Promise.resolve(db.prepare(sql).get(params));
db.all_ = (sql, params) => Promise.resolve(db.prepare(sql).all(params));
db.run_ = (sql, params) => Promise.resolve(db.prepare(sql).run(params));

module.exports = db;
