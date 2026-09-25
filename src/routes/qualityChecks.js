const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

const QC_TYPES = new Set(['installation', 'maintenance', 'survey', 'complaint_followup', 'other']);
const QC_RESULTS = new Set(['lulus', 'tidak_lulus', 'perlu_perbaikan']);

router.get('/', async (req, res) => {
  const { customer_id, ticket_id } = req.query;
  const params = [];
  let where = '1=1';
  if (customer_id) {
    where += ' AND q.customer_id = ?';
    params.push(Number(customer_id));
  }
  if (ticket_id) {
    where += ' AND q.ticket_id = ?';
    params.push(Number(ticket_id));
  }
  try {
    const [rows] = await pool.query(
      `SELECT q.*, c.full_name AS customer_name, c.customer_code, t.ticket_no
       FROM quality_check q
       LEFT JOIN customer c ON c.id = q.customer_id
       LEFT JOIN support_ticket t ON t.id = q.ticket_id
       WHERE ${where}
       ORDER BY q.checked_at DESC, q.id DESC
       LIMIT 500`,
      params
    );
    res.json({ data: rows });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel quality_check belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const [rows] = await pool.query(
      `SELECT q.*, c.full_name AS customer_name, c.customer_code, t.ticket_no
       FROM quality_check q
       LEFT JOIN customer c ON c.id = q.customer_id
       LEFT JOIN support_ticket t ON t.id = q.ticket_id
       WHERE q.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'QC tidak ditemukan' });
    res.json({ data: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const {
    customer_id,
    ticket_id,
    qc_type,
    title,
    result,
    score_percent,
    notes,
    external_ref,
  } = req.body;
  if (!title || !result) {
    return res.status(400).json({ error: 'title dan result wajib diisi' });
  }
  if (!QC_RESULTS.has(result)) {
    return res.status(400).json({ error: 'result harus lulus, tidak_lulus, atau perlu_perbaikan' });
  }
  const type = QC_TYPES.has(qc_type) ? qc_type : 'maintenance';
  const checkedBy = req.user?.id || null;
  let score = score_percent;
  if (score != null && score !== '') {
    score = Math.min(100, Math.max(0, Number(score)));
    if (!Number.isFinite(score)) score = null;
  } else {
    score = null;
  }

  // Resolusi FK references — fallback ke null jika tidak ditemukan
  const safeCustomerId = customer_id != null && customer_id !== '' ? Number(customer_id) : null;
  const safeTicketId   = ticket_id   != null && ticket_id   !== '' ? Number(ticket_id)   : null;

  try {
    if (safeCustomerId) {
      const [[c]] = await pool.query('SELECT id FROM customer WHERE id = ? LIMIT 1', [safeCustomerId]);
      if (!c) return res.status(404).json({ error: `customer_id ${safeCustomerId} tidak ditemukan` });
    }
    if (safeTicketId) {
      const [[t]] = await pool.query('SELECT id FROM support_ticket WHERE id = ? LIMIT 1', [safeTicketId]);
      if (!t) return res.status(404).json({ error: `ticket_id ${safeTicketId} tidak ditemukan` });
    }

    // checked_by dari JWT — fallback null jika user sudah terhapus
    let safeCheckedBy = checkedBy;
    if (safeCheckedBy) {
      const [[u]] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [safeCheckedBy]);
      if (!u) safeCheckedBy = null;
    }

    const [r] = await pool.query(
      `INSERT INTO quality_check
       (customer_id, ticket_id, qc_type, title, result, score_percent, notes, external_ref, checked_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeCustomerId,
        safeTicketId,
        type,
        String(title).slice(0, 200),
        result,
        score,
        notes != null ? String(notes) : null,
        external_ref != null ? String(external_ref).slice(0, 120) : null,
        safeCheckedBy,
      ]
    );
    res.status(201).json({ id: r.insertId, message: 'QC tercatat' });
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel quality_check belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id tidak valid' });
  const body = req.body || {};
  const sets = [];
  const vals = [];

  const map = {
    customer_id: (v) => (v === null || v === '' ? null : Number(v)),
    ticket_id: (v) => (v === null || v === '' ? null : Number(v)),
    qc_type: (v) => (QC_TYPES.has(v) ? v : undefined),
    title: (v) => (v != null ? String(v).slice(0, 200) : undefined),
    result: (v) => (QC_RESULTS.has(v) ? v : undefined),
    score_percent: (v) => {
      if (v === null || v === '') return null;
      const n = Math.min(100, Math.max(0, Number(v)));
      return Number.isFinite(n) ? n : null;
    },
    notes: (v) => (v != null ? String(v) : null),
    external_ref: (v) => (v != null ? String(v).slice(0, 120) : null),
  };

  for (const [key, fn] of Object.entries(map)) {
    if (body[key] === undefined) continue;
    const val = fn(body[key]);
    if (val === undefined && key === 'qc_type') continue;
    if (val === undefined && key === 'result') continue;
    sets.push(`${key} = ?`);
    vals.push(val);
  }
  if (!sets.length) return res.status(400).json({ error: 'Tidak ada field yang diperbarui' });
  vals.push(id);
  try {
    const [r] = await pool.query(`UPDATE quality_check SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (!r.affectedRows) return res.status(404).json({ error: 'QC tidak ditemukan' });
    res.json({ message: 'QC diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const [r] = await pool.query('DELETE FROM quality_check WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'QC tidak ditemukan' });
    res.json({ message: 'QC dihapus' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
