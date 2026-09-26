const { createClient } = require('@libsql/client');

// Tanpa DATABASE_URL (development lokal) -> pakai file SQLite biasa di disk.
// Dengan DATABASE_URL (production di Netlify) -> connect ke database Turso lewat internet,
// karena Netlify Functions tidak punya disk permanen antar-invocation.
const db = createClient({
  url: process.env.DATABASE_URL || 'file:blockhost.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

const ready = (async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      server_name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      ram TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      midtrans_transaction_id TEXT,
      qr_string TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      ram TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'online',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
})();

/** Pastikan tabel sudah siap sebelum query pertama pada tiap cold start. */
async function withReady() {
  await ready;
  return db;
}

module.exports = { withReady };
