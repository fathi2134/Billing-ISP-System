/**
 * Input validation helpers for billing-isp.
 * Setiap fungsi mengembalikan string error atau null.
 */

function isValidWaNumber(wa) {
  if (!wa || typeof wa !== 'string') return 'Nomor WhatsApp wajib diisi'
  const cleaned = wa.replace(/\D/g, '')
  if (cleaned.length < 10 || cleaned.length > 15) return 'Nomor WhatsApp harus 10-15 digit'
  if (!cleaned.startsWith('62') && !cleaned.startsWith('0')) return 'Nomor WhatsApp harus diawali 62 atau 0'
  return null
}

function isValidBillingCycle(cycle) {
  const n = Number(cycle)
  if (!Number.isInteger(n) || n < 1 || n > 28) return 'Billing cycle harus angka 1-28'
  return null
}

function isValidDate(str) {
  if (!str || typeof str !== 'string') return 'Tanggal wajib diisi'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return 'Format tanggal harus YYYY-MM-DD'
  const d = new Date(str)
  if (isNaN(d.getTime())) return 'Tanggal tidak valid'
  return null
}

function isValidRole(role) {
  const allowed = ['admin', 'bos']
  if (!role) return null // default to 'bos'
  if (!allowed.includes(role)) return `Role harus salah satu: ${allowed.join(', ')}`
  return null
}

function validateCustomerPayload(body) {
  const errors = []
  if (!body.full_name || typeof body.full_name !== 'string' || !body.full_name.trim()) {
    errors.push('Nama lengkap wajib diisi')
  }
  if (!body.whatsapp_number) {
    errors.push('Nomor WhatsApp wajib diisi')
  } else {
    const waErr = isValidWaNumber(body.whatsapp_number)
    if (waErr) errors.push(waErr)
  }
  if (body.email && typeof body.email === 'string' && body.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      errors.push('Format email tidak valid')
    }
  }
  return errors.length ? errors : null
}

function validateSubscriptionPayload(sub) {
  if (!sub) return null
  const errors = []
  if (sub.billing_cycle) {
    const cycleErr = isValidBillingCycle(sub.billing_cycle)
    if (cycleErr) errors.push(cycleErr)
  }
  if (sub.next_invoice_date) {
    const dateErr = isValidDate(sub.next_invoice_date)
    if (dateErr) errors.push(dateErr)
  }
  if (sub.payment_type && !['prepaid', 'postpaid'].includes(sub.payment_type)) {
    errors.push('Payment type harus prepaid atau postpaid')
  }
  if (sub.billing_profile_id) {
    const n = Number(sub.billing_profile_id)
    if (!Number.isFinite(n) || n <= 0) errors.push('Billing profile ID tidak valid')
  }
  return errors.length ? errors : null
}

/**
 * Express middleware factory: validasi body menggunakan fungsi validator.
 * Validator menerima req.body dan mengembalikan array error atau null.
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body)
    if (errors && errors.length) {
      return res.status(400).json({ error: errors.join('; ') })
    }
    next()
  }
}

module.exports = {
  isValidWaNumber,
  isValidBillingCycle,
  isValidDate,
  isValidRole,
  validateCustomerPayload,
  validateSubscriptionPayload,
  validate,
}
