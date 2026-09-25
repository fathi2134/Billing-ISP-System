/**
 * Tandai tagihan lunas dari payload Midtrans (webhook atau transaction.status) + WA konfirmasi.
 */
const { pool } = require('../config/database');
const { sendText } = require('./whatsapp');
const { buildPembayaranTerimaWaText } = require('./tagihanWaMessage');
const { getSnap } = require('./midtransSnapForTagihan');

function isMidtransTransactionPaid(payload) {
  if (!payload) return false;
  const transactionStatus = payload.transaction_status;
  const fraudStatus = payload.fraud_status;
  if (transactionStatus === 'capture') return fraudStatus === 'accept';
  if (transactionStatus === 'settlement') return true;
  return false;
}

async function logWaDeliveryRow({ customerId, toWa, text, providerMessageId, errorMessage }) {
  if (errorMessage == null) {
    await pool.query(
      `INSERT INTO whatsapp_delivery_log
       (schedule_id, template_id, customer_id, to_wa, message_text, status, provider_message_id, error_message, sent_at)
       VALUES (NULL, NULL, ?, ?, ?, 'sent', ?, NULL, NOW())`,
      [customerId, toWa, text, providerMessageId]
    );
  } else {
    await pool.query(
      `INSERT INTO whatsapp_delivery_log
       (schedule_id, template_id, customer_id, to_wa, message_text, status, error_message, sent_at)
       VALUES (NULL, NULL, ?, ?, ?, 'failed', ?, NOW())`,
      [customerId, toWa, text, errorMessage]
    );
  }
}

async function loadTagihanByMidtransOrderId(orderId) {
  const [[row]] = await pool.query(
    `SELECT t.id, t.customer_id, t.bulan, t.tahun, t.nominal, t.status_bayar,
            c.full_name, c.whatsapp_number AS wa
     FROM tagihan t
     JOIN customer c ON c.id = t.customer_id
     WHERE t.midtrans_order_id = ?`,
    [orderId]
  );
  return row || null;
}

async function commitTagihanLunas(conn, tagihan, paymentType, orderIdRef) {
  await conn.query(
    `UPDATE tagihan SET status_bayar = 'lunas', payment_method = ? WHERE id = ?`,
    [paymentType || 'midtrans', tagihan.id]
  );
  const [[invoice]] = await conn.query(
    `SELECT i.id FROM invoices i
     JOIN subscriptions s ON s.id = i.subscription_id
     WHERE s.customer_id = ?
       AND i.status IN ('unpaid','overdue')
       AND MONTH(i.due_date) = ?
       AND YEAR(i.due_date) = ?
     ORDER BY i.due_date ASC LIMIT 1`,
    [tagihan.customer_id, tagihan.bulan, tagihan.tahun]
  );
  if (invoice) {
    await conn.query("UPDATE invoices SET status = 'paid' WHERE id = ?", [invoice.id]);
    await conn.query(
      `INSERT INTO payments (invoice_id, amount, payment_method, payment_date, reference)
       VALUES (?, ?, ?, NOW(), ?)`,
      [invoice.id, tagihan.nominal, paymentType || 'midtrans', orderIdRef]
    );
  }
}

async function sendKonfirmasiPembayaranWa(tagihan) {
  if (!tagihan.wa) return;
  const text = buildPembayaranTerimaWaText({
    namaCustomer: tagihan.full_name,
    bulan: tagihan.bulan,
    tahun: tagihan.tahun,
    nominal: tagihan.nominal,
  });
  try {
    const msg = await sendText(tagihan.wa, text);
    await logWaDeliveryRow({
      customerId: tagihan.customer_id,
      toWa: tagihan.wa,
      text,
      providerMessageId: msg?.id?._serialized || msg?.id || null,
    });
  } catch (e) {
    console.warn('[Midtrans] Gagal kirim WA konfirmasi pembayaran:', e.message);
    try {
      await logWaDeliveryRow({
        customerId: tagihan.customer_id,
        toWa: tagihan.wa,
        text: '[Konfirmasi pembayaran gagal terkirim]',
        errorMessage: e.message || String(e),
      });
    } catch {}
  }
}

/**
 * @returns {Promise<{ updated: boolean, status_bayar: string|null, notFound?: boolean, alreadyLunas?: boolean }>}
 */
async function processMidtransPaymentResult(orderId, payload) {
  const tagihan = await loadTagihanByMidtransOrderId(orderId);
  if (!tagihan) {
    console.warn(`[Midtrans] Tagihan not found for order_id=${orderId}`);
    return { updated: false, status_bayar: null, notFound: true };
  }
  if (tagihan.status_bayar === 'lunas') {
    return { updated: false, status_bayar: 'lunas', alreadyLunas: true };
  }
  if (!isMidtransTransactionPaid(payload)) {
    return { updated: false, status_bayar: 'belum' };
  }

  const paymentType = payload.payment_type || 'midtrans';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query(
      'SELECT status_bayar FROM tagihan WHERE id = ? FOR UPDATE',
      [tagihan.id]
    );
    if (!current || current.status_bayar === 'lunas') {
      await conn.commit();
      return { updated: false, status_bayar: 'lunas', alreadyLunas: true };
    }
    await commitTagihanLunas(conn, tagihan, paymentType, orderId);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  console.log(`[Midtrans] Tagihan #${tagihan.id} marked as LUNAS via ${paymentType}`);
  await sendKonfirmasiPembayaranWa(tagihan);
  return { updated: true, status_bayar: 'lunas' };
}

/** Sinkron dari API Midtrans (polling admin / setelah Snap). */
async function syncTagihanById(tagihanId) {
  const [[row]] = await pool.query(
    `SELECT t.id, t.midtrans_order_id, t.status_bayar, t.customer_id, t.bulan, t.tahun, t.nominal,
            c.full_name, c.whatsapp_number AS wa
     FROM tagihan t
     JOIN customer c ON c.id = t.customer_id
     WHERE t.id = ?`,
    [tagihanId]
  );
  if (!row) {
    return { ok: false, error: 'Tagihan tidak ditemukan', status_bayar: null };
  }
  if (row.status_bayar === 'lunas') {
    return { ok: true, updated: false, status_bayar: 'lunas', alreadyLunas: true };
  }
  if (!row.midtrans_order_id) {
    return {
      ok: true,
      updated: false,
      status_bayar: 'belum',
      message: 'Belum ada transaksi Midtrans untuk tagihan ini',
    };
  }
  const status = await getSnap().transaction.status(row.midtrans_order_id);
  const result = await processMidtransPaymentResult(row.midtrans_order_id, status);
  return { ok: true, ...result };
}

module.exports = {
  isMidtransTransactionPaid,
  processMidtransPaymentResult,
  syncTagihanById,
};
