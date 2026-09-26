const express = require('express');
const { withReady } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const db = await withReady();
  const { email } = req.query;
  const result = email
    ? await db.execute({ sql: 'SELECT * FROM servers WHERE email = ? ORDER BY created_at DESC', args: [email] })
    : await db.execute('SELECT * FROM servers ORDER BY created_at DESC');
  res.json(result.rows);
});

router.post('/:id/toggle', async (req, res) => {
  const db = await withReady();
  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [req.params.id] });
  const server = result.rows[0];
  if (!server) return res.status(404).json({ error: 'Server tidak ditemukan' });

  const next = server.status === 'online' ? 'offline' : 'online';
  await db.execute({ sql: 'UPDATE servers SET status = ? WHERE id = ?', args: [next, server.id] });
  res.json({ id: server.id, status: next });
});

router.delete('/:id', async (req, res) => {
  const db = await withReady();
  const info = await db.execute({ sql: 'DELETE FROM servers WHERE id = ?', args: [req.params.id] });
  if (info.rowsAffected === 0) return res.status(404).json({ error: 'Server tidak ditemukan' });
  res.json({ deleted: true });
});

module.exports = router;
