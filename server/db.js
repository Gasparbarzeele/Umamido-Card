// server/db.js — Base de données SQLite (sqlite3 async)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './umamido.db';
const db = new sqlite3.Database(path.resolve(DB_PATH));

db.get_ = (sql, params) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => err ? rej(err) : res(row))
);
db.all_ = (sql, params) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))
);
db.run_ = (sql, params) => new Promise((res, rej) =>
  db.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }) })
);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE,
    phone TEXT, push_token TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
    stamps INTEGER DEFAULT 0, total_stamps INTEGER DEFAULT 0,
    rewards_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, card_id TEXT NOT NULL,
    action TEXT NOT NULL, location TEXT DEFAULT 'Umamido',
    staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL,
    role TEXT DEFAULT 'cashier', active INTEGER DEFAULT 1
  )`);
  db.get('SELECT COUNT(*) as count FROM staff', (err, row) => {
    if (!err && row && row.count === 0) {
      db.run(`INSERT INTO staff VALUES ('staff_1','Caisse 1','1234','cashier',1)`);
      db.run(`INSERT INTO staff VALUES ('staff_2','Caisse 2','5678','cashier',1)`);
      db.run(`INSERT INTO staff VALUES ('admin_1','Manager','0000','admin',1)`);
      console.log('✅ Staff créé (PINs: 1234, 5678, 0000)');
    }
  });
});

module.exports = db;
