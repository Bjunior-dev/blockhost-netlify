require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const { router: ordersRouter } = require('../../lib/routes/orders');
const paymentsRouter = require('../../lib/routes/payments');
const serversRouter = require('../../lib/routes/servers');

const app = express();
app.use(cors());
app.use(express.json());

const api = express.Router();
api.get('/health', (req, res) => res.json({ ok: true }));
api.use('/orders', ordersRouter);
api.use('/payments', paymentsRouter);
api.use('/servers', serversRouter);

// netlify.toml meneruskan /api/* ke fungsi ini sebagai /.netlify/functions/api/*,
// tapi saat development lokal ("netlify dev") path yang diterima kadang masih "/api/*".
// Pasang di dua-duanya supaya jalan di kedua kondisi.
app.use('/.netlify/functions/api', api);
app.use('/api', api);

module.exports.handler = serverless(app);
