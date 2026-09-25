const express = require('express');
const { pool } = require('../config/database');
const { generateTagihanForPeriod, listCustomersWithTarif } = require('../services/tagihanGenerator');
const { sendText } = require('../services/whatsapp');
const { createSnapForTagihan, isMidtransConfigured } = require('../services/midtransSnapForTagihan');
const { buildTagihanWaText } = require('../services/tagihanWaMessage');

const router = express.Router();

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function logWaDelivery({ customerId, toWa, text, providerMessageId, errorMessage }) {
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

/**
 * POST /api/tagihan/bulk-kirim-wa
 * Body: { tagihan_ids: number[], include_payment_link?: boolean }
 */
router.post('/bulk-kirim-wa', async (req, res) => {
  const { tagihan_ids, include_payment_link = true } = req.body;
  if (!Array.isArray(tagihan_ids) || tagihan_ids.length === 0) {
    return res.status(400).json({ error: 'tagihan_ids wajib berupa array (minimal 1)' });
  }
  const ids = [...new Set(tagihan_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return res.status(400).json({ error: 'ID tagihan tidak valid' });

  const results = { ok: 0, failed: 0, details: [] };

  for (const tid of ids) {
    try {
      const [[row]] = await pool.query(
        `SELECT t.id, t.bulan, t.tahun, t.nominal, t.status_bayar, t.customer_id,
                c.full_name, c.whatsapp_number AS wa
         FROM tagihan t
         JOIN customer c ON c.id = t.customer_id
         WHERE t.id = ?`,
        [tid]
      );
      if (!row) {
        results.failed += 1;
        results.details.push({ tagihan_id: tid, error: 'Tidak ditemukan' });
        continue;
      }
      if (row.status_bayar === 'lunas') {
        results.failed += 1;
        results.details.push({ tagihan_id: tid, error: 'Sudah lunas' });
        continue;
      }
      if (!row.wa) {
        results.failed += 1;
        results.details.push({ tagihan_id: tid, error: 'Pelanggan tanpa nomor WA' });
        continue;
      }

      let paymentUrl = null;
      if (include_payment_link && isMidtransConfigured()) {
        try {
          const snap = await createSnapForTagihan(tid);
          paymentUrl = snap.redirect_url;
        } catch (e) {
          console.warn(`[Tagihan WA] Midtrans gagal tagihan #${tid}:`, e.message);
        }
      }

      const text = buildTagihanWaText({
        namaCustomer: row.full_name,
        bulan: row.bulan,
        tahun: row.tahun,
        nominal: row.nominal,
        paymentUrl,
      });

      try {
        const msg = await sendText(row.wa, text);
        await logWaDelivery({
          customerId: row.customer_id,
          toWa: row.wa,
          text,
          providerMessageId: msg?.id?._serialized || msg?.id || null,
        });
        results.ok += 1;
        results.details.push({ tagihan_id: tid, sent: true, payment_link: Boolean(paymentUrl) });
      } catch (e) {
        await logWaDelivery({
          customerId: row.customer_id,
          toWa: row.wa,
          text,
          errorMessage: e.message || String(e),
        });
        results.failed += 1;
        results.details.push({ tagihan_id: tid, error: e.message || 'Gagal kirim WA' });
      }

      await delay(2000);
    } catch (e) {
      results.failed += 1;
      results.details.push({ tagihan_id: tid, error: e.message });
    }
  }

  res.json({ message: 'Selesai', ...results });
});

/**
 * POST /api/tagihan/buat-dan-kirim
 * Buat tagihan manual untuk 1+ pelanggan, opsional langsung kirim WA (+ link Midtrans).
 * Body: {
 *   bulan, tahun,
 *   customer_ids: number[],
 *   nominal_mode?: 'subscription' | 'fixed'  (default subscription = dari paket)
 *   nominal?: number  (wajib jika nominal_mode fixed, dipakai untuk semua)
 *   kirim_wa?: boolean (default true)
 *   include_payment_link?: boolean (default true, butuh Midtrans di server)
 * }
 */
router.post('/buat-dan-kirim', async (req, res) => {
  const {
    bulan,
    tahun,
    customer_ids,
    nominal_mode = 'subscription',
    nominal: bodyNominal,
    kirim_wa: kirimWa = true,
    include_payment_link: includePaymentLink = true,
  } = req.body;

  if (bulan == null || tahun == null) {
    return res.status(400).json({ error: 'bulan dan tahun wajib diisi' });
  }
  if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
    return res.status(400).json({ error: 'customer_ids wajib berupa array (minimal 1 pelanggan)' });
  }

  const b = Number(bulan);
  const y = Number(tahun);
  if (b < 1 || b > 12) return res.status(400).json({ error: 'bulan harus 1–12' });
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return res.status(400).json({ error: 'tahun tidak valid' });

  const ids = [...new Set(customer_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return res.status(400).json({ error: 'customer_ids tidak valid' });

  if (nominal_mode === 'fixed') {
    const nom = Number(bodyNominal);
    if (!Number.isFinite(nom) || nom <= 0) {
      return res.status(400).json({ error: 'nominal wajib diisi (> 0) jika nominal_mode = fixed' });
    }
  } else if (nominal_mode !== 'subscription') {
    return res.status(400).json({ error: 'nominal_mode harus subscription atau fixed' });
  }

  const results = {
    created: 0,
    skipped_duplicate: 0,
    wa_sent: 0,
    wa_failed: 0,
    wa_skipped: 0,
    details: [],
  };

  for (const cid of ids) {
    let nominalVal;
    if (nominal_mode === 'fixed') {
      nominalVal = Number(bodyNominal);
    } else {
      try {
        const tar = await listCustomersWithTarif({ customerId: cid });
        if (!tar.length) {
          results.details.push({ customer_id: cid, status: 'error', error: 'Tidak ada paket/subscription untuk tarif' });
          continue;
        }
        nominalVal = tar[0].nominal;
      } catch (e) {
        results.details.push({ customer_id: cid, status: 'error', error: e.message });
        continue;
      }
    }

    let tagihanId;
    const detail = { customer_id: cid, nominal: nominalVal };
    try {
      const [ins] = await pool.query(
        `INSERT INTO tagihan (customer_id, bulan, tahun, nominal, status_bayar)
         VALUES (?, ?, ?, ?, 'belum')`,
        [cid, b, y, nominalVal]
      );
      tagihanId = ins.insertId;
      results.created += 1;
      detail.tagihan_id = tagihanId;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        results.skipped_duplicate += 1;
        detail.status = 'duplicate';
        detail.error = 'Tagihan periode ini sudah ada';
        results.details.push(detail);
        continue;
      }
      detail.status = 'error';
      detail.error = e.message;
      results.details.push(detail);
      continue;
    }

    if (!kirimWa) {
      detail.status = 'created';
      results.details.push(detail);
      continue;
    }

    try {
      const [[row]] = await pool.query(
        `SELECT t.id, t.bulan, t.tahun, t.nominal, t.customer_id,
                c.full_name, c.whatsapp_number AS wa
         FROM tagihan t
         JOIN customer c ON c.id = t.customer_id
         WHERE t.id = ?`,
        [tagihanId]
      );
      if (!row?.wa) {
        results.wa_skipped += 1;
        detail.status = 'wa_skipped';
        detail.error = 'Pelanggan tanpa WA';
        results.details.push(detail);
        continue;
      }

      let paymentUrl = null;
      if (includePaymentLink && isMidtransConfigured()) {
        try {
          const snap = await createSnapForTagihan(tagihanId);
          paymentUrl = snap.redirect_url;
        } catch (e) {
          console.warn(`[buat-dan-kirim] Midtrans tagihan #${tagihanId}:`, e.message);
        }
      }

      const text = buildTagihanWaText({
        namaCustomer: row.full_name,
        bulan: row.bulan,
        tahun: row.tahun,
        nominal: row.nominal,
        paymentUrl,
      });

      const msg = await sendText(row.wa, text);
      await logWaDelivery({
        customerId: row.customer_id,
        toWa: row.wa,
        text,
        providerMessageId: msg?.id?._serialized || msg?.id || null,
      });
      results.wa_sent += 1;
      detail.status = 'wa_sent';
      detail.payment_link = Boolean(paymentUrl);
      results.details.push(detail);
    } catch (e) {
      results.wa_failed += 1;
      try {
        const [[c]] = await pool.query(
          'SELECT whatsapp_number AS wa FROM customer WHERE id = ?',
          [cid]
        );
        if (c?.wa) {
          await logWaDelivery({
            customerId: cid,
            toWa: c.wa,
            text: '[Tagihan gagal terkirim]',
            errorMessage: e.message || String(e),
          });
        }
      } catch {}
      detail.status = 'wa_error';
      detail.error = e.message;
      results.details.push(detail);
    }
    await delay(2000);
  }

  res.status(201).json({ message: 'Proses buat tagihan selesai', ...results });
});

/**
 * POST /api/tagihan/:id/kirim-wa
 * Kirim pengingat tagihan + link bayar Midtrans (jika dikonfigurasi).
 * Body: { include_payment_link?: boolean (default true) }
 */
router.post('/:id/kirim-wa', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID tagihan tidak valid' });
  const include_payment_link = req.body.include_payment_link !== false;

  try {
    const [[row]] = await pool.query(
      `SELECT t.id, t.bulan, t.tahun, t.nominal, t.status_bayar, t.customer_id,
              c.full_name, c.whatsapp_number AS wa
       FROM tagihan t
       JOIN customer c ON c.id = t.customer_id
       WHERE t.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Tagihan tidak ditemukan' });
    if (row.status_bayar === 'lunas') return res.status(409).json({ error: 'Tagihan sudah lunas' });
    if (!row.wa) return res.status(400).json({ error: 'Pelanggan tidak punya nomor WhatsApp' });

    let paymentUrl = null;
    if (include_payment_link && isMidtransConfigured()) {
      try {
        const snap = await createSnapForTagihan(id);
        paymentUrl = snap.redirect_url;
      } catch (e) {
        console.warn('[Tagihan WA] Midtrans:', e.message);
        if (e.statusCode === 409) return res.status(409).json({ error: e.message });
      }
    }

    const text = buildTagihanWaText({
      namaCustomer: row.full_name,
      bulan: row.bulan,
      tahun: row.tahun,
      nominal: row.nominal,
      paymentUrl,
    });

    try {
      const msg = await sendText(row.wa, text);
      await logWaDelivery({
        customerId: row.customer_id,
        toWa: row.wa,
        text,
        providerMessageId: msg?.id?._serialized || msg?.id || null,
      });
      res.json({
        message: 'Pesan tagihan terkirim (jika sesi WA aktif)',
        payment_link_included: Boolean(paymentUrl),
      });
    } catch (e) {
      await logWaDelivery({
        customerId: row.customer_id,
        toWa: row.wa,
        text,
        errorMessage: e.message || String(e),
      });
      res.status(500).json({ error: e.message || 'Gagal mengirim WhatsApp' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const { customer_id, bulan, tahun } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  try {
    let where = ' WHERE 1=1';
    const params = [];
    if (customer_id) { where += ' AND t.customer_id = ?'; params.push(customer_id); }
    if (bulan)       { where += ' AND t.bulan = ?';       params.push(bulan); }
    if (tahun)       { where += ' AND t.tahun = ?';       params.push(tahun); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tagihan t${where}`, params
    );

    const sql = `
      SELECT t.*, c.full_name AS nama_customer, c.whatsapp_number AS wa
      FROM tagihan t
      JOIN customer c ON c.id = t.customer_id
      ${where}
      ORDER BY t.tahun DESC, t.bulan DESC, t.id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...params, limit, offset]);
    res.json({ data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { customer_id, bulan, tahun, nominal, status_bayar } = req.body;
  if (!customer_id || !bulan || !tahun || nominal === null || nominal === undefined) {
    return res.status(400).json({ error: 'customer_id, bulan, tahun, nominal wajib' });
  }
  try {
    const [r] = await pool.query(
      `INSERT INTO tagihan (customer_id, bulan, tahun, nominal, status_bayar)
       VALUES (?, ?, ?, ?, COALESCE(?, 'belum'))`,
      [customer_id, bulan, tahun, nominal, status_bayar]
    );
    res.status(201).json({ id: r.insertId, message: 'Tagihan dibuat' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Tagihan untuk periode ini sudah ada' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/bayar', async (req, res) => {
  const { payment_method, reference } = req.body;
  const allowed = ['cash', 'virtual_account', 'bank_transfer', 'echannel', 'gopay', 'shopeepay', 'qris', 'cstore', 'akulaku', 'kredivo', 'midtrans'];
  if (payment_method && !allowed.includes(payment_method)) {
    return res.status(400).json({ error: `payment_method tidak valid: ${payment_method}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Ambil data tagihan terlebih dahulu
    const [[tagihan]] = await conn.query(
      'SELECT id, customer_id, bulan, tahun, nominal, status_bayar FROM tagihan WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!tagihan) {
      await conn.rollback();
      return res.status(404).json({ error: 'Tagihan tidak ditemukan' });
    }
    if (tagihan.status_bayar === 'lunas') {
      await conn.rollback();
      return res.status(409).json({ error: 'Tagihan sudah berstatus lunas' });
    }

    // 2. Update tagihan → lunas
    await conn.query(
      `UPDATE tagihan SET status_bayar = 'lunas', payment_method = ? WHERE id = ?`,
      [payment_method || null, tagihan.id]
    );

    // 3. Cari invoice yang sesuai (customer + bulan/tahun due_date) yang belum lunas
    const [[invoice]] = await conn.query(
      `SELECT i.id, i.total_amount
       FROM invoices i
       JOIN subscriptions s ON s.id = i.subscription_id
       WHERE s.customer_id = ?
         AND i.status IN ('unpaid', 'overdue')
         AND MONTH(i.due_date) = ?
         AND YEAR(i.due_date)  = ?
       ORDER BY i.due_date ASC
       LIMIT 1`,
      [tagihan.customer_id, tagihan.bulan, tagihan.tahun]
    );

    let invoiceSynced = false;
    if (invoice) {
      // 4a. Update invoice → paid
      await conn.query(
        "UPDATE invoices SET status = 'paid' WHERE id = ?",
        [invoice.id]
      );

      // 4b. Insert record ke tabel payments
      await conn.query(
        `INSERT INTO payments (invoice_id, amount, payment_method, payment_date, reference)
         VALUES (?, ?, ?, NOW(), ?)`,
        [
          invoice.id,
          tagihan.nominal,
          payment_method || 'cash',
          reference || null,
        ]
      );
      invoiceSynced = true;
    }

    await conn.commit();
    res.json({
      message: 'Status pembayaran: lunas',
      tagihan_id: tagihan.id,
      invoice_synced: invoiceSynced,
      ...(invoice && { invoice_id: invoice.id }),
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

/**
 * Generate tagihan periode (sama seperti npm run generate-tagihan).
 * Body: { bulan, tahun, customer_id? } — jika customer_id diisi, hanya customer itu.
 */
router.post('/generate-bulanan', async (req, res) => {
  const { bulan, tahun, customer_id } = req.body;
  if (bulan == null || tahun == null) {
    return res.status(400).json({ error: 'bulan dan tahun wajib diisi' });
  }
  try {
    const result = await generateTagihanForPeriod({
      bulan: Number(bulan),
      tahun: Number(tahun),
      customerId: customer_id != null ? Number(customer_id) : undefined,
    });
    res.status(201).json({
      message: 'Generate tagihan selesai',
      created: result.created,
      skipped: result.skipped,
      details: result.details,
    });
  } catch (e) {
    if (e.message && e.message.includes('bulan')) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
