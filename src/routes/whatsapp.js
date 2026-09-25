const express = require('express')
const { pool } = require('../config/database')
const { triggerScheduler } = require('../services/whatsappScheduler')

const router = express.Router()

router.get('/templates', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nama_template, template_text, created_at
       FROM whatsapp_template
       ORDER BY id DESC`
    )
    res.json({ data: rows })
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel WhatsApp belum ada. Import `sql/billing_isp_complete.sql` (atau jalankan ulang skema lengkap).' })
    }
    res.status(500).json({ error: e.message })
  }
})

router.post('/templates', async (req, res) => {
  const { nama_template, template_text } = req.body
  if (!nama_template || !template_text) {
    return res.status(400).json({ error: 'nama_template dan template_text wajib diisi' })
  }

  try {
    const [r] = await pool.query(
      `INSERT INTO whatsapp_template (nama_template, template_text)
       VALUES (?, ?)`,
      [nama_template, template_text]
    )
    res.status(201).json({ id: r.insertId, message: 'Template dibuat' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/templates/:id', async (req, res) => {
  const { nama_template, template_text } = req.body
  if (!nama_template || !template_text) {
    return res.status(400).json({ error: 'nama_template dan template_text wajib diisi' })
  }

  try {
    const [r] = await pool.query(
      `UPDATE whatsapp_template SET nama_template = ?, template_text = ? WHERE id = ?`,
      [nama_template, template_text, req.params.id]
    )
    if (!r.affectedRows) return res.status(404).json({ error: 'Template tidak ditemukan' })
    res.json({ message: 'Template diperbarui' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/templates/:id', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Hapus child records yang reference template ini terlebih dahulu
    await conn.query('DELETE FROM whatsapp_delivery_log WHERE template_id = ?', [req.params.id])
    await conn.query('DELETE r FROM whatsapp_schedule_recipient r JOIN whatsapp_schedule s ON s.id = r.schedule_id WHERE s.template_id = ?', [req.params.id])
    await conn.query('DELETE FROM whatsapp_schedule WHERE template_id = ?', [req.params.id])
    const [r] = await conn.query('DELETE FROM whatsapp_template WHERE id = ?', [req.params.id])
    if (!r.affectedRows) {
      await conn.rollback()
      return res.status(404).json({ error: 'Template tidak ditemukan' })
    }
    await conn.commit()
    res.json({ message: 'Template dihapus' })
  } catch (e) {
    await conn.rollback().catch(() => {})
    res.status(500).json({ error: e.message })
  } finally {
    conn.release()
  }
})

// Jadwalkan pesan WhatsApp (pengiriman otomatis dilakukan oleh whatsappScheduler)
router.post('/schedule', async (req, res) => {
  const { template_id, customer_ids, pelanggan_ids, tanggal, waktu } = req.body
  const resolvedIds = customer_ids || pelanggan_ids  // backward compat

  if (!template_id) return res.status(400).json({ error: 'template_id wajib diisi' })
  if (!Array.isArray(resolvedIds) || resolvedIds.length === 0) {
    return res.status(400).json({ error: 'customer_ids wajib berupa array (minimal 1)' })
  }
  if (!tanggal || !waktu) return res.status(400).json({ error: 'tanggal dan waktu wajib diisi' })

  const tOk = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggal))
  const wOk = /^\d{2}:\d{2}$/.test(String(waktu))
  if (!tOk || !wOk) return res.status(400).json({ error: 'Format tanggal/waktu harus YYYY-MM-DD dan HH:mm' })

  const scheduledAt = `${tanggal} ${waktu}:00`

  const ids = resolvedIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
  if (!ids.length) return res.status(400).json({ error: 'pelanggan_ids tidak valid' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [tplRows] = await conn.query('SELECT id FROM whatsapp_template WHERE id = ?', [template_id])
    if (!tplRows.length) {
      await conn.rollback()
      return res.status(404).json({ error: 'Template tidak ditemukan' })
    }

    const [sched] = await conn.query(
      `INSERT INTO whatsapp_schedule (template_id, scheduled_at, status)
       VALUES (?, ?, 'queued')`,
      [template_id, scheduledAt]
    )
    const scheduleId = sched.insertId

    const [custRows] = await conn.query(
      `SELECT id, full_name AS nama, whatsapp_number AS wa
       FROM customer
       WHERE id IN (?)`,
      [ids]
    )

    if (!custRows.length) {
      await conn.rollback()
      return res.status(400).json({ error: 'Tidak ada customer yang ditemukan dengan ID yang dipilih' })
    }

    for (const p of custRows) {
      await conn.query(
        `INSERT INTO whatsapp_schedule_recipient
         (schedule_id, customer_id, nama_snapshot, wa_snapshot)
         VALUES (?, ?, ?, ?)`,
        [scheduleId, p.id, p.nama, p.wa]
      )
    }

    await conn.commit()
    res.status(201).json({ schedule_id: scheduleId, message: 'Jadwal WhatsApp dibuat' })
    
    // Picu scheduler berjalan langsung di background (instant)
    setTimeout(() => triggerScheduler(), 1000)
  } catch (e) {
    try {
      await conn.rollback()
    } catch {}
    res.status(500).json({ error: e.message })
  } finally {
    conn.release()
  }
})

router.get('/logs', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 10000)
  try {
    const [rows] = await pool.query(
      `SELECT
        l.id,
        l.created_at,
        l.sent_at,
        l.schedule_id,
        l.template_id,
        t.nama_template,
        l.customer_id,
        c.full_name AS nama_customer,
        c.full_name AS nama_pelanggan,
        l.to_wa,
        l.message_text,
        l.status,
        l.error_message,
        l.provider_message_id,
        l.wa_ack_raw,
        l.wa_delivered_at,
        l.wa_read_at
      FROM whatsapp_delivery_log l
      LEFT JOIN whatsapp_template t ON t.id = l.template_id
      LEFT JOIN customer c ON c.id = l.customer_id
      ORDER BY l.id DESC
      LIMIT ?`,
      [limit]
    )
    res.json({ data: rows })
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel WhatsApp belum ada. Import `sql/billing_isp_complete.sql` (atau jalankan ulang skema lengkap).' })
    }
    res.status(500).json({ error: e.message })
  }
})

// Ambil daftar antrean jadwal
router.get('/schedules', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, t.nama_template,
        (SELECT COUNT(*) FROM whatsapp_schedule_recipient WHERE schedule_id = s.id) as total_recipient
       FROM whatsapp_schedule s
       LEFT JOIN whatsapp_template t ON t.id = s.template_id
       ORDER BY s.id DESC LIMIT 10`
    )
    res.json({ data: rows })
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: 'Tabel WhatsApp belum ada.' })
    }
    res.status(500).json({ error: e.message })
  }
})

// Hapus semua riwayat pengiriman
router.delete('/logs', async (req, res) => {
  try {
    await pool.query('DELETE FROM whatsapp_delivery_log')
    res.json({ message: 'Log berhasil dihapus' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Hapus semua antrean jadwal
router.delete('/schedules', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Hapus child records terlebih dahulu (FK-safe)
    await conn.query('DELETE FROM whatsapp_delivery_log WHERE schedule_id IS NOT NULL')
    await conn.query('DELETE FROM whatsapp_schedule_recipient')
    await conn.query('DELETE FROM whatsapp_schedule')
    await conn.commit()
    res.json({ message: 'Antrean berhasil dihapus' })
  } catch (e) {
    await conn.rollback().catch(() => {})
    res.status(500).json({ error: e.message })
  } finally {
    conn.release()
  }
})

module.exports = router
