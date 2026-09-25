/**
 * Base URL: kosong = pakai proxy Vite ke backend (dev).
 * Produksi: set VITE_API_URL=https://api.domain.com
 */
const base = import.meta.env.VITE_API_URL ?? ''

async function handle(res) {
  if (res.status === 401) {
    localStorage.clear()
    window.location.reload()
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text || 'Respons tidak valid' }
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

function authHeaders(isJson = true) {
  const token = localStorage.getItem('token')
  const h = {}
  if (isJson) h['Content-Type'] = 'application/json'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function login(body) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

export async function getUsers() {
  const res = await fetch(`${base}/api/auth/users`, { headers: authHeaders(false) })
  return handle(res)
}

export async function createUser(body) {
  const res = await fetch(`${base}/api/auth/users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

export async function deleteUser(id) {
  const res = await fetch(`${base}/api/auth/users/${id}`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}

// Alias: getPelanggan === getCustomers (backward compat untuk Dashboard)
export async function getPelanggan() {
  return getCustomers({ limit: 10000 })
}

// Aliases (backward compat)
export async function createPelanggan(body) { return createCustomer(body) }
export async function updatePelanggan(id, body) { return updateCustomer(id, body) }
export async function deletePelanggan(id) { return deleteCustomer(id) }

export async function postIsolir(id) {
  const res = await fetch(`${base}/api/customers/${id}/isolir`, { method: 'POST', headers: authHeaders(false) })
  return handle(res)
}

export async function postBukaIsolir(id) {
  const res = await fetch(`${base}/api/customers/${id}/buka-isolir`, { method: 'POST', headers: authHeaders(false) })
  return handle(res)
}

export async function postKirimWa(id, pesan) {
  const res = await fetch(`${base}/api/customers/${id}/kirim-wa`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ pesan }),
  })
  return handle(res)
}

export async function getTagihan(params = {}) {
  const q = new URLSearchParams()
  if (params.bulan != null) q.set('bulan', params.bulan)
  if (params.tahun != null) q.set('tahun', params.tahun)
  if (params.page != null) q.set('page', params.page)
  if (params.limit != null) q.set('limit', params.limit)
  const qs = q.toString()
  const res = await fetch(`${base}/api/tagihan${qs ? `?${qs}` : ''}`, { headers: authHeaders(false) })
  return handle(res)
}

export async function bayarTagihan(id, payment_method) {
  const res = await fetch(`${base}/api/tagihan/${id}/bayar`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ payment_method }),
  })
  return handle(res)
}

/** Kirim pengingat tagihan via WA + link Midtrans (jika server key ada). */
export async function kirimWaTagihan(tagihanId, body = {}) {
  const res = await fetch(`${base}/api/tagihan/${tagihanId}/kirim-wa`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handle(res)
}

/** Kirim WA untuk banyak tagihan (jeda antar pesan). */
export async function kirimWaTagihanBulk(tagihan_ids, include_payment_link = true) {
  const res = await fetch(`${base}/api/tagihan/bulk-kirim-wa`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagihan_ids, include_payment_link }),
  })
  return handle(res)
}

/** Buat tagihan untuk banyak pelanggan; opsional kirim WA + link Midtrans. */
export async function buatTagihanDanKirim(body) {
  const res = await fetch(`${base}/api/tagihan/buat-dan-kirim`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handle(res)
}

// ── Midtrans Payment ─────────────────────────────────────
export async function createPaymentToken(tagihan_id) {
  const res = await fetch(`${base}/api/payment/create-token`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagihan_id }),
  })
  return handle(res)
}

export async function getPaymentConfigStatus() {
  const res = await fetch(`${base}/api/payment/config-status`, { headers: authHeaders(false) })
  return handle(res)
}

/** Sinkron status Midtrans → tagihan (admin, JWT). */
export async function syncTagihanMidtrans(tagihan_id) {
  const res = await fetch(`${base}/api/payment/sync-tagihan`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tagihan_id }),
  })
  return handle(res)
}

/**
 * Sinkron dari halaman sukses Midtrans (tanpa JWT).
 * Midtrans mengarahkan ke CLIENT_URL/payment/success?order_id=...
 */
export async function syncPaymentPublic(order_id) {
  const res = await fetch(`${base}/api/payment/sync-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id }),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text || 'Respons tidak valid' }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// WhatsApp Admin
export async function getWhatsappTemplates() {
  const res = await fetch(`${base}/api/whatsapp/templates`, { headers: authHeaders(false) })
  return handle(res)
}

export async function createWhatsappTemplate(body) {
  const res = await fetch(`${base}/api/whatsapp/templates`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handle(res)
}

export async function updateWhatsappTemplate(id, body) {
  const res = await fetch(`${base}/api/whatsapp/templates/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handle(res)
}

export async function deleteWhatsappTemplate(id) {
  const res = await fetch(`${base}/api/whatsapp/templates/${id}`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}

export async function scheduleWhatsapp(body) {
  const res = await fetch(`${base}/api/whatsapp/schedule`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handle(res)
}

export async function getWhatsappLogs(limit = 50) {
  const res = await fetch(`${base}/api/whatsapp/logs?limit=${encodeURIComponent(limit)}`, { headers: authHeaders(false) })
  return handle(res)
}

export async function deleteWhatsappSchedules() {
  const res = await fetch(`${base}/api/whatsapp/schedules`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}

export async function deleteWhatsappLogs() {
  const res = await fetch(`${base}/api/whatsapp/logs`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}

export async function getWhatsappSchedules() {
  const res = await fetch(`${base}/api/whatsapp/schedules`, { headers: authHeaders(false) })
  return handle(res)
}

export async function getWaStatus() {
  const res = await fetch(`${base}/api/wa-auth/status`, { headers: authHeaders(false) })
  return handle(res)
}

export async function postWaLogout() {
  const res = await fetch(`${base}/api/wa-auth/logout`, { method: 'POST', headers: authHeaders(false) })
  return handle(res)
}

// ── Customers (modul baru) ──────────────────────────────────
export async function getCustomers(params = {}) {
  const q = new URLSearchParams()
  if (params.page != null) q.set('page', String(params.page))
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.search) q.set('search', String(params.search))
  const qs = q.toString()
  const res = await fetch(`${base}/api/customers${qs ? `?${qs}` : ''}`, { headers: authHeaders(false) })
  return handle(res)
}

export async function getCustomerDetail(id) {
  const res = await fetch(`${base}/api/customers/${id}/detail`, { headers: authHeaders(false) })
  return handle(res)
}

export async function getBillingProfiles() {
  const res = await fetch(`${base}/api/customers/billing-profiles`, { headers: authHeaders(false) })
  return handle(res)
}

export async function createCustomer(body) {
  const res = await fetch(`${base}/api/customers`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  })
  return handle(res)
}

export async function updateCustomer(id, body) {
  const res = await fetch(`${base}/api/customers/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
  })
  return handle(res)
}

export async function deleteCustomer(id) {
  const res = await fetch(`${base}/api/customers/${id}`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}

// ── Tiket gangguan ─────────────────────────────────────────
export async function getTicketStatsSummary() {
  const res = await fetch(`${base}/api/tickets/stats/summary`, { headers: authHeaders(false) })
  return handle(res)
}

export async function getTickets(params = {}) {
  const q = new URLSearchParams()
  if (params.customer_id != null) q.set('customer_id', params.customer_id)
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  const res = await fetch(`${base}/api/tickets${qs ? `?${qs}` : ''}`, { headers: authHeaders(false) })
  return handle(res)
}

export async function getTicketSummaryForCustomer(customerId) {
  const res = await fetch(`${base}/api/tickets/customer/${customerId}/summary`, { headers: authHeaders(false) })
  return handle(res)
}

export async function createTicket(body) {
  const res = await fetch(`${base}/api/tickets`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

export async function updateTicket(id, body) {
  const res = await fetch(`${base}/api/tickets/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

// ── Quality check ─────────────────────────────────────────
export async function getQualityChecks(params = {}) {
  const q = new URLSearchParams()
  if (params.customer_id != null) q.set('customer_id', params.customer_id)
  if (params.ticket_id != null) q.set('ticket_id', params.ticket_id)
  const qs = q.toString()
  const res = await fetch(`${base}/api/quality-checks${qs ? `?${qs}` : ''}`, { headers: authHeaders(false) })
  return handle(res)
}

export async function createQualityCheck(body) {
  const res = await fetch(`${base}/api/quality-checks`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

export async function updateQualityCheck(id, body) {
  const res = await fetch(`${base}/api/quality-checks/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) })
  return handle(res)
}

export async function deleteQualityCheck(id) {
  const res = await fetch(`${base}/api/quality-checks/${id}`, { method: 'DELETE', headers: authHeaders(false) })
  return handle(res)
}
