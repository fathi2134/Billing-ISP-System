const { pool } = require('../config/database')
const { sendText } = require('./whatsapp')

let running = false
let timer = null
let disabled = false

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

function renderTemplate(templateText, vars) {
  // Support: {{nama}}, {{wa}}
  return String(templateText).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars?.[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

async function processDueSchedules() {
  if (disabled) return
  if (running) return
  running = true
  try {
    // Gunakan waktu Node.js lokal agar terhindar dari bug zona waktu MySQL (NOW())
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const localNow = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

    const [due] = await pool.query(
      `SELECT * FROM whatsapp_schedule
       WHERE status = 'queued' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 5`,
      [localNow]
    )

    for (const s of due) {
      // Acquire pseudo-lock so multiple intervals don't double-send
      const [lock] = await pool.query(
        `UPDATE whatsapp_schedule
         SET status = 'processing'
         WHERE id = ? AND status = 'queued'`,
        [s.id]
      )
      if (!lock.affectedRows) continue

      try {
        const [tplRows] = await pool.query('SELECT template_text FROM whatsapp_template WHERE id = ?', [s.template_id])
        const templateText = tplRows?.[0]?.template_text
        if (!templateText) throw new Error(`Template tidak ditemukan: ${s.template_id}`)

        const [recipients] = await pool.query(
          `SELECT customer_id, nama_snapshot, wa_snapshot
           FROM whatsapp_schedule_recipient
           WHERE schedule_id = ?`,
          [s.id]
        )

        for (const [i, r] of recipients.entries()) {
          const messageText = renderTemplate(templateText, { nama: r.nama_snapshot, wa: r.wa_snapshot })
          try {
            const msg = await sendText(r.wa_snapshot, messageText)
            await pool.query(
              `INSERT INTO whatsapp_delivery_log
               (schedule_id, template_id, customer_id, to_wa, message_text, status, provider_message_id, sent_at)
               VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)`,
              [s.id, s.template_id, r.customer_id, r.wa_snapshot, messageText, msg?.id?._serialized || msg?.id || null, localNow]
            )
          } catch (e) {
            await pool.query(
              `INSERT INTO whatsapp_delivery_log
               (schedule_id, template_id, customer_id, to_wa, message_text, status, error_message, sent_at)
               VALUES (?, ?, ?, ?, ?, 'failed', ?, NULL)`,
              [s.id, s.template_id, r.customer_id, r.wa_snapshot, messageText, e.message || String(e)]
            )
          }
          
          // Jeda 2 detik antar pesan agar tidak dianggap spam/crash oleh WhatsApp
          await delay(2000)

          // Jeda ekstra 10 detik setiap 5 pesan (Sistem Anti-Spam WA)
          if ((i + 1) % 5 === 0 && i !== recipients.length - 1) {
            console.log(`[WhatsApp Scheduler] Istirahat 10 detik setelah mengirim ${i + 1} pesan...`)
            await delay(10000)
          }
        }

        await pool.query(`UPDATE whatsapp_schedule SET status = 'done' WHERE id = ?`, [s.id])
      } catch (e) {
        await pool.query(
          `UPDATE whatsapp_schedule
           SET status = 'failed'
           WHERE id = ?`,
          [s.id]
        )
      }
    }
  } catch (e) {
    // Saat tabel WhatsApp belum dimigrasikan, query akan gagal berulang.
    // Kita stop scheduler agar tidak spam sampai user import migration.
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      disabled = true
      if (timer) clearInterval(timer)
      timer = null
      console.error('[WhatsApp Scheduler] Disabled: tabel WhatsApp belum ada. Import sql/billing_isp_complete.sql lalu restart backend.')
      return
    }
    console.error('[WhatsApp Scheduler] Error:', e)
  } finally {
    running = false
  }
}

function startWhatsappScheduler(intervalMs = 10000) {
  if (disabled) return
  if (timer) return
  // Jalankan setiap interval untuk kirim schedule yang sudah jatuh tempo
  timer = setInterval(processDueSchedules, intervalMs)
  // Jalankan sekali saat startup
  processDueSchedules().catch(() => {})
}

function triggerScheduler() {
  processDueSchedules().catch(() => {})
}

module.exports = { startWhatsappScheduler, triggerScheduler }
