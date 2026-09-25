/**
 * Satu sumber kebenaran: buat transaksi Snap Midtrans untuk baris tagihan.
 * Dipakai oleh POST /api/payment/create-token dan pengiriman WA tagihan.
 */
const midtransClient = require('midtrans-client');
const { pool } = require('../config/database');

let snap;

function isMidtransConfigured() {
  return Boolean(
    process.env.MIDTRANS_SERVER_KEY &&
      String(process.env.MIDTRANS_SERVER_KEY).trim() &&
      process.env.MIDTRANS_CLIENT_KEY &&
      String(process.env.MIDTRANS_CLIENT_KEY).trim()
  );
}

function getSnap() {
  if (!isMidtransConfigured()) {
    const err = new Error('Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY)');
    err.code = 'MIDTRANS_NOT_CONFIGURED';
    throw err;
  }
  if (!snap) {
    snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }
  return snap;
}

async function loadTagihanWithCustomer(tagihanId) {
  const [[row]] = await pool.query(
    `SELECT t.*, c.full_name, c.whatsapp_number AS phone, c.address
     FROM tagihan t
     JOIN customer c ON c.id = t.customer_id
     WHERE t.id = ?`,
    [tagihanId]
  );
  return row || null;
}

function snapParameterFromTagihan(tagihan) {
  const clientUrl = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  const orderId = `TAGIHAN-${tagihan.id}-${Date.now()}`;
  const amount = Math.round(Number(tagihan.nominal));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal tagihan tidak valid untuk Midtrans');
  }
  const phone = String(tagihan.phone || '').replace(/\D/g, '').slice(0, 20);

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: String(tagihan.full_name || 'Pelanggan').slice(0, 50),
      ...(phone ? { phone } : {}),
    },
    item_details: [
      {
        id: `tagihan-${tagihan.id}`,
        price: amount,
        quantity: 1,
        name: `Tagihan Internet ${tagihan.bulan}/${tagihan.tahun}`,
      },
    ],
  };

  if (clientUrl) {
    parameter.callbacks = {
      finish: `${clientUrl}/payment/success`,
      error: `${clientUrl}/payment/failed`,
      unfinish: `${clientUrl}/payment/pending`,
    };
  }

  return { orderId, parameter };
}

/**
 * Buat transaksi Snap, simpan order_id + token ke tagihan.
 * @returns {Promise<{ token: string, redirect_url: string, order_id: string, tagihan: object }>}
 */
async function createSnapForTagihan(tagihanId) {
  const tagihan = await loadTagihanWithCustomer(tagihanId);
  if (!tagihan) {
    const e = new Error('Tagihan tidak ditemukan');
    e.statusCode = 404;
    throw e;
  }
  if (tagihan.status_bayar === 'lunas') {
    const e = new Error('Tagihan sudah lunas');
    e.statusCode = 409;
    throw e;
  }

  const { orderId, parameter } = snapParameterFromTagihan(tagihan);
  const transaction = await getSnap().createTransaction(parameter);

  await pool.query(
    'UPDATE tagihan SET midtrans_order_id = ?, midtrans_snap_token = ? WHERE id = ?',
    [orderId, transaction.token, tagihanId]
  );

  return {
    token: transaction.token,
    redirect_url: transaction.redirect_url,
    order_id: orderId,
    tagihan,
  };
}

module.exports = {
  getSnap,
  isMidtransConfigured,
  loadTagihanWithCustomer,
  createSnapForTagihan,
};
