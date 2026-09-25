/**
 * customerController.js — HTTP layer only.
 */

const svc = require('../services/customerService');
const { pool } = require('../config/database');
const { applyProfile } = require('../services/routeros');

async function getAll(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const { data, total } = await svc.getAllCustomers({ limit, offset, search });
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (err) { next(err); }
}

async function getBillingProfiles(req, res, next) {
  try {
    const data = await svc.getAllBillingProfiles();
    res.json({ data });
  } catch (err) { next(err); }
}

async function getDetail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: 'ID tidak valid' });
    const data = await svc.getCustomerDetail(id);
    res.json({ data });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await svc.createCustomer(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Username atau customer code sudah dipakai' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: 'ID tidak valid' });
    const result = await svc.updateCustomer(id, req.body);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: 'ID tidak valid' });
    const result = await svc.deleteCustomer(id);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function isolir(req, res, next) {
  const isolirProfile = process.env.MIKROTIK_PROFILE_ISOLIR || 'isolir';
  try {
    const [iaRows] = await pool.query(
      `SELECT ia.id, ia.type AS tipe, ia.username AS username_mikrotik
       FROM internet_accounts ia WHERE ia.customer_id = ?
       ORDER BY FIELD(ia.status,'active','isolated','disabled'), ia.id DESC LIMIT 1`,
      [req.params.id]
    );
    if (!iaRows.length) return res.status(404).json({ error: 'Customer atau akun internet tidak ditemukan' });
    const ia = iaRows[0];

    // 1. Update DB terlebih dahulu — selalu berhasil tanpa bergantung MikroTik
    await pool.query("UPDATE internet_accounts SET status = 'isolated' WHERE id = ?", [ia.id]);

    // 2. Coba sinkronisasi ke MikroTik (opsional, gagal tidak membatalkan DB)
    let mikrotikWarning = null;
    try {
      await applyProfile({ tipe: ia.tipe, username_mikrotik: ia.username_mikrotik, profile: isolirProfile });
    } catch (mikrotikErr) {
      mikrotikWarning = mikrotikErr.message;
      console.error('[MikroTik] isolir gagal (DB tetap terupdate):', mikrotikErr.message);
    }

    res.json({
      message: 'Customer diisolir',
      db_updated: true,
      mikrotik_synced: !mikrotikWarning,
      ...(mikrotikWarning && { mikrotik_warning: mikrotikWarning }),
    });
  } catch (err) { next(err); }
}

async function bukaIsolir(req, res, next) {
  try {
    const [iaRows] = await pool.query(
      `SELECT ia.id, ia.type AS tipe, ia.username AS username_mikrotik, ia.service_name AS profile_mikrotik
       FROM internet_accounts ia WHERE ia.customer_id = ?
       ORDER BY FIELD(ia.status,'active','isolated','disabled'), ia.id DESC LIMIT 1`,
      [req.params.id]
    );
    if (!iaRows.length) return res.status(404).json({ error: 'Customer atau akun internet tidak ditemukan' });
    const ia = iaRows[0];

    // 1. Update DB terlebih dahulu
    await pool.query("UPDATE internet_accounts SET status = 'active' WHERE id = ?", [ia.id]);

    // 2. Coba sinkronisasi ke MikroTik (opsional)
    let mikrotikWarning = null;
    try {
      await applyProfile({ tipe: ia.tipe, username_mikrotik: ia.username_mikrotik, profile: ia.profile_mikrotik });
    } catch (mikrotikErr) {
      mikrotikWarning = mikrotikErr.message;
      console.error('[MikroTik] buka-isolir gagal (DB tetap terupdate):', mikrotikErr.message);
    }

    res.json({
      message: 'Isolir dibuka',
      db_updated: true,
      mikrotik_synced: !mikrotikWarning,
      ...(mikrotikWarning && { mikrotik_warning: mikrotikWarning }),
    });
  } catch (err) { next(err); }
}

async function kirimWa(req, res, next) {
  const { pesan } = req.body;
  if (!pesan) return res.status(400).json({ error: 'pesan wajib diisi' });

  const custId = Number(req.params.id);
  if (!Number.isFinite(custId)) return res.status(400).json({ error: 'id customer tidak valid' });

  try {
    const [rows] = await pool.query(
      'SELECT whatsapp_number AS wa FROM customer WHERE id = ?',
      [custId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer tidak ditemukan' });

    const { sendText } = require('../services/whatsapp');
    const toWa = rows[0].wa;
    const msg = await sendText(toWa, pesan);

    await pool.query(
      `INSERT INTO whatsapp_delivery_log
       (schedule_id, template_id, customer_id, to_wa, message_text, status, provider_message_id, error_message, sent_at)
       VALUES (NULL, NULL, ?, ?, ?, 'sent', ?, NULL, NOW())`,
      [custId, toWa, pesan, msg?.id?._serialized || msg?.id || null]
    );
    res.json({ message: 'Pesan terkirim (jika session WA aktif)' });
  } catch (err) {
    try {
      const [rows] = await pool.query('SELECT whatsapp_number AS wa FROM customer WHERE id = ?', [custId]);
      if (rows.length) {
        await pool.query(
          `INSERT INTO whatsapp_delivery_log
           (schedule_id, template_id, customer_id, to_wa, message_text, status, error_message, sent_at)
           VALUES (NULL, NULL, ?, ?, ?, 'failed', ?, NULL)`,
          [custId, rows[0].wa, req.body?.pesan || '', err.message || String(err)]
        );
      }
    } catch {}
    next(err);
  }
}

module.exports = { getAll, getBillingProfiles, getDetail, create, update, remove, isolir, bukaIsolir, kirimWa };
