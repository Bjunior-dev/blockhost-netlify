const express = require('express');
const crypto = require('crypto');
const { withReady } = require('../db');

const router = express.Router();

const PLANS = {
  'Survival': { ram: '2 GB', price: 25000 },
  'Survival Plus': { ram: '6 GB', price: 60000 },
  'Server Komunitas': { ram: '12 GB', price: 120000 },
};

router.post('/', async (req, res) => {
  const { planName, serverName, email } = req.body || {};
  const plan = PLANS[planName];

  if (!plan) return res.status(400).json({ error: 'Paket tidak dikenali' });
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email tidak valid' });
  if (!serverName || !serverName.trim()) return res.status(400).json({ error: 'Nama server wajib diisi' });

  const id = 'ORDER-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const db = await withReady();

  await db.execute({
    sql: `INSERT INTO orders (id, email, server_name, plan_name, ram, price, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    args: [id, email, serverName.trim(), planName, plan.ram, plan.price],
  });

  res.status(201).json({ orderId: id, planName, ram: plan.ram, price: plan.price });
});

router.get('/:id', async (req, res) => {
  const db = await withReady();
  const result = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] });
  const order = result.rows[0];
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  res.json(order);
});

module.exports = { router, PLANS };
