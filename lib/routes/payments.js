const express = require('express');
const crypto = require('crypto');
const { withReady } = require('../db');
const { createQrisCharge, isValidSignature } = require('../services/midtrans');

const router = express.Router();

router.post('/qris/:orderId', async (req, res) => {
  const db = await withReady();
  const result = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.orderId] });
  const order = result.rows[0];
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  if (order.status === 'paid') return res.status(400).json({ error: 'Order sudah dibayar' });

  try {
    const charge = await createQrisCharge(order);
    await db.execute({
      sql: `UPDATE orders SET midtrans_transaction_id = ?, qr_string = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [charge.transactionId, charge.qrString, order.id],
    });

    res.json({
      orderId: order.id,
      qrString: charge.qrString,
      qrImageUrl: charge.qrImageUrl,
      status: charge.rawStatus,
    });
  } catch (err) {
    console.error('Midtrans charge error:', err.message);
    res.status(502).json({ error: 'Gagal membuat kode QRIS', detail: err.message });
  }
});

router.post('/notification', async (req, res) => {
  try {
    const notification = req.body || {};

    // Kalau field wajib untuk cek signature tidak lengkap (misal test-ping tanpa data asli),
    // jangan dianggap error keras -> cukup balas 200 supaya tombol "Test notification URL"
    // di dashboard Midtrans lolos, tanpa membuka celah keamanan (signature tetap divalidasi
    // begitu datanya lengkap dan ini transaksi sungguhan).
    const hasFullPayload = notification.order_id && notification.status_code && notification.gross_amount && notification.signature_key;
    if (!hasFullPayload) {
      return res.status(200).json({ received: true, note: 'Payload tidak lengkap (kemungkinan test ping), diabaikan.' });
    }

    if (!isValidSignature(notification)) return res.status(403).json({ error: 'Signature tidak valid' });

    const { order_id, transaction_status, fraud_status } = notification;
    const db = await withReady();
    const result = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [order_id] });
    const order = result.rows[0];

    // Order ID dari Midtrans (termasuk contoh dummy saat test) yang tidak ada di DB kita
    // tetap dibalas 200 -> ini bukan kegagalan sistem, cuma tidak ada yang perlu diupdate.
    if (!order) {
      return res.status(200).json({ received: true, note: 'Order tidak ditemukan (kemungkinan notifikasi tes).' });
    }

    const isSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement';

    if (isSuccess && order.status !== 'paid') {
      await db.execute({
        sql: `UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?`,
        args: [order_id],
      });

      const serverId = 'SRV-' + crypto.randomBytes(6).toString('hex').toUpperCase();
      await db.execute({
        sql: `INSERT INTO servers (id, order_id, email, name, plan_name, ram, status) VALUES (?, ?, ?, ?, ?, ?, 'online')`,
        args: [serverId, order.id, order.email, order.server_name, order.plan_name, order.ram],
      });
    } else if (['expire', 'cancel', 'deny'].includes(transaction_status)) {
      await db.execute({
        sql: `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [transaction_status === 'expire' ? 'expired' : 'failed', order_id],
      });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    // Jangan biarkan function crash (yang muncul di Midtrans sebagai "internal error").
    // Log error-nya supaya kelihatan di Netlify Function logs untuk debugging,
    // tapi tetap balas 200 supaya Midtrans tidak retry berkali-kali tanpa henti.
    console.error('Notification handler error:', err);
    res.status(200).json({ received: true, warning: 'Diproses dengan error internal, cek function logs.' });
  }
});

module.exports = router;
