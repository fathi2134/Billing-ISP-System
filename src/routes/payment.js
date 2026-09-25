const express = require('express');
const { pool } = require('../config/database');
const { getSnap, createSnapForTagihan } = require('../services/midtransSnapForTagihan');

const router = express.Router();

/**
 * POST /api/payment/create-token
 * Buat Snap token untuk tagihan tertentu.
 * Body: { tagihan_id }
 */
router.post('/create-token', async (req, res) => {
  const { tagihan_id } = req.body;
  if (!tagihan_id) return res.status(400).json({ error: 'tagihan_id wajib' });

  try {
    const result = await createSnapForTagihan(Number(tagihan_id));
    res.json({
      token: result.token,
      redirect_url: result.redirect_url,
      order_id: result.order_id,
    });
  } catch (e) {
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    if (e.statusCode === 409) return res.status(409).json({ error: e.message });
    if (e.code === 'MIDTRANS_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Midtrans belum dikonfigurasi di server (.env)' });
    }
    console.error('Midtrans create token error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/payment/notification
 * Webhook handler — dipanggil oleh Midtrans server-to-server.
 */
router.post('/notification', async (req, res) => {
  try {
    const { isMidtransConfigured } = require('../services/midtransSnapForTagihan');
    if (!isMidtransConfigured()) {
      console.warn('[Midtrans] Notification diterima tetapi server key belum dikonfigurasi');
      return res.status(200).json({ message: 'OK' });
    }
    const notification = await getSnap().transaction.notification(req.body);
    const { processMidtransPaymentResult } = require('../services/midtransSettlement');
    console.log(
      `[Midtrans] webhook order_id=${notification.order_id} status=${notification.transaction_status} fraud=${notification.fraud_status}`
    );
    await processMidtransPaymentResult(notification.order_id, notification);
    res.status(200).json({ message: 'OK' });
  } catch (e) {
    console.error('Midtrans notification error:', e.message);
    res.status(200).json({ message: 'OK' });
  }
});

/**
 * POST /api/payment/sync-tagihan
 * JWT — cek status transaksi di Midtrans, update tagihan + WA jika baru lunas.
 */
router.post('/sync-tagihan', async (req, res) => {
  const id = Number(req.body.tagihan_id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'tagihan_id wajib' });
  try {
    const { syncTagihanById } = require('../services/midtransSettlement');
    const out = await syncTagihanById(id);
    if (out.error === 'Tagihan tidak ditemukan') return res.status(404).json(out);
    res.json(out);
  } catch (e) {
    if (e.code === 'MIDTRANS_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Midtrans belum dikonfigurasi di server (.env)' });
    }
    console.error('sync-tagihan:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/payment/sync-public
 * Tanpa JWT — dipanggil dari halaman /payment/success (order_id dari Midtrans redirect).
 */
router.post('/sync-public', async (req, res) => {
  try {
    const raw = req.body?.order_id;
    const order_id = raw != null ? String(raw).trim() : '';
    if (!order_id) return res.status(400).json({ ok: false, error: 'order_id wajib' });

    const { isMidtransConfigured } = require('../services/midtransSnapForTagihan');
    if (!isMidtransConfigured()) {
      return res.status(503).json({ ok: false, error: 'Midtrans belum dikonfigurasi' });
    }

    const status = await getSnap().transaction.status(order_id);
    const oid = status.order_id || order_id;
    const { processMidtransPaymentResult } = require('../services/midtransSettlement');
    const result = await processMidtransPaymentResult(oid, status);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[Midtrans] sync-public:', e.message);
    res.status(200).json({ ok: false, error: e.message });
  }
});

router.get('/status/:order_id', async (req, res) => {
  try {
    const status = await getSnap().transaction.status(req.params.order_id);
    res.json(status);
  } catch (e) {
    if (e.code === 'MIDTRANS_NOT_CONFIGURED') {
      return res.status(503).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

/** Cek apakah server siap untuk Snap (untuk UI admin). */
router.get('/config-status', (req, res) => {
  const { isMidtransConfigured } = require('../services/midtransSnapForTagihan');
  res.json({
    midtrans_ready: isMidtransConfigured(),
    is_production: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  });
});

module.exports = router;
