const midtransClient = require('midtrans-client');
const crypto = require('crypto');

const core = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

/**
 * Buat charge QRIS ke Midtrans. QRIS adalah standar nasional yang interoperable,
 * jadi pelanggan tetap bisa bayar pakai DANA (atau e-wallet lain) dengan scan kodenya,
 * walau acquirer penerbitnya "gopay".
 */
async function createQrisCharge(order) {
  const [firstName, ...rest] = order.email.split('@')[0].split('.');
  const payload = {
    payment_type: 'qris',
    transaction_details: {
      order_id: order.id,
      gross_amount: order.price,
    },
    item_details: [
      {
        id: order.plan_name,
        price: order.price,
        quantity: 1,
        name: `Hosting Minecraft - ${order.plan_name}`,
      },
    ],
    customer_details: {
      first_name: firstName || 'Pelanggan',
      last_name: rest.join(' ') || '',
      email: order.email,
    },
    qris: { acquirer: 'gopay' },
  };

  const response = await core.charge(payload);
  const qrAction = (response.actions || []).find((a) => a.name === 'generate-qr-code');

  return {
    transactionId: response.transaction_id,
    qrString: response.qr_string,
    qrImageUrl: qrAction ? qrAction.url : null,
    rawStatus: response.transaction_status,
  };
}

/** signature_key = SHA512(order_id + status_code + gross_amount + ServerKey) */
function isValidSignature(notification) {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  const expected = crypto
    .createHash('sha512')
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  return expected === signature_key;
}

module.exports = { createQrisCharge, isValidSignature };
