const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/database');

const router = express.Router();

function genTicketNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `TKT-${y}${m}${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

router.get('/stats/summary', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_cnt,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_cnt,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_cnt,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_cnt
      FROM support_ticket`
    );
    const open = Number(row.open_cnt) || 0;
    const inProgress = Number(row.in_progress_cnt) || 0;
    const resolved = Number(row.resolved_cnt) || 0;
    const closed = Number(row.closed_cnt) || 0;
    res.json({
      total: Number(row.total) || 0,
      open,
      in_progress: inProgress,
      resolved,
      closed,
      selesai: resolved + closed,
    });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel support_ticket belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const { customer_id, status } = req.query;
  const params = [];
  let where = '1=1';
  if (customer_id) {
    where += ' AND t.customer_id = ?';
    params.push(Number(customer_id));
  }
  if (status) {
    where += ' AND t.status = ?';
    params.push(status);
  }
  try {
    const [rows] = await pool.query(
      `SELECT t.*, c.full_name AS customer_name, c.customer_code
       FROM support_ticket t
       JOIN customer c ON c.id = t.customer_id
       WHERE ${where}
       ORDER BY t.opened_at DESC, t.id DESC
       LIMIT 500`,
      params
    );
    res.json({ data: rows });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel support_ticket belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.get('/customer/:customerId/summary', async (req, res) => {
  const customerId = Number(req.params.customerId);
  if (!Number.isFinite(customerId)) return res.status(400).json({ error: 'customerId tidak valid' });
  try {
    const [[cnt]] = await pool.query(
      'SELECT COUNT(*) AS total FROM support_ticket WHERE customer_id = ?',
      [customerId]
    );
    const [byCat] = await pool.query(
      `SELECT category, COUNT(*) AS jumlah
       FROM support_ticket WHERE customer_id = ?
       GROUP BY category ORDER BY jumlah DESC`,
      [customerId]
    );
    res.json({ customer_id: customerId, total_tickets: cnt.total, by_category: byCat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const [rows] = await pool.query(
      `SELECT t.*, c.full_name AS customer_name, c.customer_code, c.whatsapp_number
       FROM support_ticket t
       JOIN customer c ON c.id = t.customer_id
       WHERE t.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    res.json({ data: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const {
    customer_id,
    category,
    title,
    description,
    priority,
    assigned_to,
  } = req.body;

  if (!customer_id || !category || !title) {
    return res.status(400).json({ error: 'customer_id, category, dan title wajib diisi' });
  }

  const custId = Number(customer_id);
  if (!Number.isFinite(custId) || custId <= 0) {
    return res.status(400).json({ error: 'customer_id tidak valid' });
  }

  try {
    // Validasi customer_id ada di DB sebelum insert
    const [[cust]] = await pool.query('SELECT id FROM customer WHERE id = ? LIMIT 1', [custId]);
    if (!cust) return res.status(404).json({ error: 'Customer tidak ditemukan' });

    // Jika assigned_to diisi, pastikan user tersebut ada
    let safeAssignedTo = null;
    if (assigned_to != null && assigned_to !== '') {
      const assignedId = Number(assigned_to);
      if (Number.isFinite(assignedId)) {
        const [[assignedUser]] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [assignedId]);
        safeAssignedTo = assignedUser ? assignedId : null;
      }
    }

    // opened_by dari JWT — fallback null jika user sudah terhapus
    let openedBy = req.user?.id || null;
    if (openedBy) {
      const [[opener]] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [openedBy]);
      if (!opener) openedBy = null;
    }

    let ticketNo = genTicketNo();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [r] = await pool.query(
          `INSERT INTO support_ticket
           (ticket_no, customer_id, category, title, description, priority, opened_by, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ticketNo,
            custId,
            String(category).slice(0, 80),
            String(title).slice(0, 200),
            description != null ? String(description) : null,
            ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
            openedBy,
            safeAssignedTo,
          ]
        );
        return res.status(201).json({ id: r.insertId, ticket_no: ticketNo, message: 'Tiket dibuat' });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          ticketNo = genTicketNo();
          continue;
        }
        if (e.code === 'ER_NO_SUCH_TABLE') {
          return res.status(500).json({ error: 'Tabel support_ticket belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
        }
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(500).json({ error: 'Gagal generate nomor tiket unik' });
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel support_ticket belum ada. Import skema atau jalankan sql/migration_add_tickets_qc_wa_ack.sql' });
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

  for (const key of ['category', 'title', 'description', 'root_cause', 'status', 'priority']) {
    if (body[key] === undefined) continue;
    sets.push(`${key} = ?`);
    vals.push(body[key]);
  }
  if (body.assigned_to !== undefined) {
    sets.push('assigned_to = ?');
    vals.push(body.assigned_to === null || body.assigned_to === '' ? null : Number(body.assigned_to));
  }
  if (body.closed_at !== undefined) {
    sets.push('closed_at = ?');
    vals.push(body.closed_at === null ? null : body.closed_at);
  } else if (body.status === 'closed' || body.status === 'resolved') {
    sets.push('closed_at = IF(closed_at IS NULL, NOW(), closed_at)');
  } else if (body.status === 'open' || body.status === 'in_progress') {
    sets.push('closed_at = NULL');
  }

  if (!sets.length) return res.status(400).json({ error: 'Tidak ada field yang diperbarui' });

  vals.push(id);
  try {
    const [r] = await pool.query(`UPDATE support_ticket SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (!r.affectedRows) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    res.json({ message: 'Tiket diperbarui' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
