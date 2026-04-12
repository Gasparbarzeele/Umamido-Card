const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../umamido.db');
const sqlite = new Database(dbPath);

// ─────────────────────────────────────────
// INIT — création des tables au démarrage
// ─────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    phone       TEXT UNIQUE,
    stamps      INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    device_id     TEXT,
    serial_number TEXT,
    push_token    TEXT,
    PRIMARY KEY (device_id, serial_number)
  );

  CREATE TABLE IF NOT EXISTS pass_updates (
    serial_number TEXT PRIMARY KEY,
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT,
    type        TEXT,
    stamps_after INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ─────────────────────────────────────────
// DB METHODS
// ─────────────────────────────────────────
const db = {

  // Créer un nouveau client
  createCustomer({ name, phone, stamps = 0 }) {
    const id = generateId();
    sqlite.prepare(`
      INSERT INTO customers (id, name, phone, stamps)
      VALUES (?, ?, ?, ?)
    `).run(id, name, phone || null, stamps);
    return { id, name, phone, stamps };
  },

  // Récupérer un client par ID
  getCustomer(id) {
    return sqlite.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  },

  // Rechercher par nom ou téléphone
  searchCustomers(query) {
    return sqlite.prepare(`
      SELECT * FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`);
  },

  // Tous les clients
  getAllCustomers() {
    return sqlite.prepare('SELECT * FROM customers ORDER BY updated_at DESC').all();
  },

  // Mettre à jour les tampons
  updateStamps(customerId, newStamps) {
    sqlite.prepare(`
      UPDATE customers
      SET stamps = ?, total_visits = total_visits + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStamps, customerId);

    // Log la transaction
    sqlite.prepare(`
      INSERT INTO transactions (customer_id, type, stamps_after)
      VALUES (?, ?, ?)
    `).run(customerId, newStamps === 0 ? 'reward' : 'stamp', newStamps);

    // Marquer le pass comme "mis à jour" pour Apple
    sqlite.prepare(`
      INSERT OR REPLACE INTO pass_updates (serial_number, updated_at)
      VALUES (?, datetime('now'))
    `).run(customerId);
  },

  // Enregistrer un device Apple Wallet
  registerDevice({ deviceId, serialNumber, pushToken }) {
    sqlite.prepare(`
      INSERT OR REPLACE INTO devices (device_id, serial_number, push_token)
      VALUES (?, ?, ?)
    `).run(deviceId, serialNumber, pushToken);
  },

  // Supprimer un device
  unregisterDevice({ deviceId, serialNumber }) {
    sqlite.prepare(`
      DELETE FROM devices WHERE device_id = ? AND serial_number = ?
    `).run(deviceId, serialNumber);
  },

  // Récupérer les passes mis à jour depuis une date
  getUpdatedPasses(deviceId, since) {
    const devices = sqlite.prepare(`
      SELECT serial_number FROM devices WHERE device_id = ?
    `).all(deviceId);

    if (!devices.length) return [];

    const serials = devices.map(d => d.serial_number);
    const placeholders = serials.map(() => '?').join(',');

    const query = since
      ? `SELECT serial_number FROM pass_updates
         WHERE serial_number IN (${placeholders}) AND updated_at > ?`
      : `SELECT serial_number FROM pass_updates
         WHERE serial_number IN (${placeholders})`;

    const params = since ? [...serials, since] : serials;
    const rows = sqlite.prepare(query).all(...params);
    return rows.map(r => r.serial_number);
  },

  // Récupérer le push token d'un client
  getPushTokens(serialNumber) {
    return sqlite.prepare(`
      SELECT push_token FROM devices WHERE serial_number = ?
    `).all(serialNumber);
  },

  // Stats pour le dashboard
  getStats() {
    return {
      totalCustomers: sqlite.prepare('SELECT COUNT(*) as n FROM customers').get().n,
      totalStamps: sqlite.prepare('SELECT SUM(total_visits) as n FROM customers').get().n,
      totalRewards: sqlite.prepare("SELECT COUNT(*) as n FROM transactions WHERE type = 'reward'").get().n,
    };
  },
};

module.exports = { db };
