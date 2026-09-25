import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as api from '../api'

const idr = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [editSection, setEditSection] = useState(null) // 'contact' | 'internet' | 'billing'
  const [editForm, setEditForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [profiles, setProfiles] = useState([])

  const load = useCallback(async () => {
    setErr(null); setLoading(true)
    try {
      const [detail, { data: bp }] = await Promise.all([
        api.getCustomerDetail(id),
        api.getBillingProfiles(),
      ])
      setData(detail.data)
      setProfiles(bp || [])
    } catch (e) {
      setErr(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  function openEdit(section) {
    if (section === 'contact') setEditForm({ ...data.customer })
    if (section === 'internet') setEditForm({ ...data.internet })
    if (section === 'billing') setEditForm({ ...data.billing, billing_profile_id: '' })
    setEditSection(section)
  }

  async function onSaveEdit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {}
      if (editSection === 'contact') {
        Object.assign(payload, {
          full_name: editForm.name,
          whatsapp_number: editForm.whatsapp,
          email: editForm.email === '-' ? null : editForm.email,
          id_card_number: editForm.id_card === '-' ? null : editForm.id_card,
          address: editForm.address === '-' ? null : editForm.address,
          map_link: editForm.map_link,
        })
      }
      if (editSection === 'internet') {
        payload.internet = {
          id: data.internet?.id,
          type: editForm.type,
          username: editForm.username,
          ip_address: editForm.ip_address === '-' ? null : editForm.ip_address,
          nas_name: editForm.nas === '-' ? null : editForm.nas,
          service_name: editForm.service_name === '-' ? null : editForm.service_name,
          status: editForm.status,
        }
      }
      if (editSection === 'billing') {
        payload.subscription = {
          id: data.billing?.subscription_id,
          billing_profile_id: editForm.billing_profile_id || undefined,
          payment_type: editForm.payment_type?.toLowerCase(),
          billing_cycle: editForm.billing_cycle,
          next_invoice_date: editForm.next_invoice,
        }
      }
      await api.updateCustomer(id, payload)
      showToast('Data berhasil diperbarui.')
      setEditSection(null)
      await load()
    } catch (error) {
      showToast(error.message || 'Gagal menyimpan', false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400">Memuat data...</div>
  )

  if (err) return (
    <div className="space-y-4">
      <button onClick={() => navigate('/pelanggan')} className="text-sm text-slate-400 hover:text-white">← Kembali</button>
      <div className="rounded-lg bg-rose-900/30 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">{err}</div>
    </div>
  )

  const { customer, internet, billing, invoices } = data

  const statusColor = (s) => {
    if (s === 'active')   return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
    if (s === 'isolated') return 'bg-rose-500/15 text-rose-300 ring-rose-500/25'
    return 'bg-slate-500/15 text-slate-300 ring-slate-500/25'
  }

  const invoiceStatusColor = (s) => {
    if (s === 'Paid')    return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
    if (s === 'Overdue') return 'bg-rose-500/15 text-rose-300 ring-rose-500/25'
    return 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/pelanggan')} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
            <p className="text-sm text-slate-400">{customer.customer_code}</p>
          </div>
        </div>
        {internet && (
          <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium ring-1 ${statusColor(internet.status)}`}>
            <span className={`h-2 w-2 rounded-md ${internet.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {internet.status === 'active' ? 'Aktif' : internet.status === 'isolated' ? 'Isolir' : 'Disabled'}
          </span>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${toast.ok ? 'bg-emerald-950/95 text-emerald-100 ring-emerald-500/40' : 'bg-rose-950/95 text-rose-100 ring-rose-500/40'}`}>
          {toast.msg}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">

        {/* ── 1. Kontak ───────────────────────────────────────── */}
        <Card title="Kontak" onEdit={() => openEdit('contact')}>
          <Row label="Nama"    value={customer.name} />
          <Row label="WhatsApp" value={customer.whatsapp} />
          <Row label="Email"   value={customer.email} />
          <Row label="KTP"     value={customer.id_card} mono />
          <Row label="Alamat"  value={customer.address} />
          {customer.map_link && (
            <div className="mt-2">
              <a href={customer.map_link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 ring-1 ring-cyan-500/20 hover:bg-cyan-500/20">
                Buka di Maps ↗
              </a>
            </div>
          )}
        </Card>

        {/* ── 2. Internet ─────────────────────────────────────── */}
        <Card title="Akun Internet" onEdit={internet ? () => openEdit('internet') : undefined}>
          {internet ? (
            <>
              <Row label="Tipe"     value={internet.type} />
              <Row label="Username" value={internet.username} mono />
              <Row label="IP"       value={internet.ip_address} mono />
              <Row label="NAS"      value={internet.nas} />
              <Row label="Service"  value={internet.service_name} />
            </>
          ) : (
            <p className="text-sm text-slate-500">Belum ada akun internet.</p>
          )}
        </Card>

        {/* ── 3. Billing ──────────────────────────────────────── */}
        <Card title="Billing & Paket" onEdit={billing ? () => openEdit('billing') : undefined}>
          {billing ? (
            <>
              <Row label="Paket"       value={billing.profile} />
              <Row label="Kecepatan"   value={billing.speed} />
              <Row label="Tipe Bayar"  value={billing.payment_type} />
              <Row label="Tgl Tagih"   value={`Tanggal ${billing.billing_cycle}`} />
              <Row label="Next Invoice" value={fmtDate(billing.next_invoice)} />
              <div className="mt-3 flex items-end justify-between rounded-lg bg-slate-800/60 px-4 py-3">
                <span className="text-xs text-slate-400">Total Tagihan</span>
                <span className="text-xl font-bold text-cyan-300 tabular-nums">{idr(billing.amount)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Belum ada subscription aktif.</p>
          )}
        </Card>

        {/* ── 4. Invoice ──────────────────────────────────────── */}
        <Card title={`Invoice (${invoices.length})`}>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada invoice.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-slate-800/80 bg-slate-800/30 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-white">#{inv.invoice_number}</p>
                      <p className="text-xs text-slate-400">Jatuh tempo: {fmtDate(inv.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums text-sm font-semibold text-slate-100">{idr(inv.total)}</p>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${invoiceStatusColor(inv.status)}`}>{inv.status}</span>
                    </div>
                  </div>
                  {/* Payments */}
                  {inv.payments?.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
                      {inv.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-slate-400">
                          <span>{fmtDate(p.payment_date)} · {p.method}</span>
                          <span className="tabular-nums text-emerald-400">{idr(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Modal Edit ──────────────────────────────────────────── */}
      {editSection && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-sm ring-1 ring-white/10">
            <h3 className="text-lg font-semibold text-white">
              Edit {editSection === 'contact' ? 'Data Kontak' : editSection === 'internet' ? 'Akun Internet' : 'Billing & Paket'}
            </h3>
            <form onSubmit={onSaveEdit} className="mt-5 space-y-4">

              {editSection === 'contact' && (
                <>
                  <EF label="Nama Lengkap" k="name" form={editForm} set={setEditForm} required />
                  <EF label="WhatsApp (62xxx)" k="whatsapp" form={editForm} set={setEditForm} required />
                  <EF label="Email" k="email" form={editForm} set={setEditForm} />
                  <EF label="No. KTP" k="id_card" form={editForm} set={setEditForm} />
                  <EF label="Alamat" k="address" form={editForm} set={setEditForm} textarea />
                  <EF label="Link Maps" k="map_link" form={editForm} set={setEditForm} />
                </>
              )}

              {editSection === 'internet' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Tipe Koneksi</label>
                    <select value={editForm.type || ''} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100">
                      <option value="PPPoE">PPPoE</option>
                      <option value="DHCP">DHCP</option>
                      <option value="Static">Static</option>
                    </select>
                  </div>
                  <EF label="Username" k="username" form={editForm} set={setEditForm} required mono />
                  <EF label="IP Address" k="ip_address" form={editForm} set={setEditForm} mono />
                  <EF label="NAS Name" k="nas" form={editForm} set={setEditForm} />
                  <EF label="Service Name" k="service_name" form={editForm} set={setEditForm} />
                  <div>
                    <label className="text-sm font-medium text-slate-300">Status</label>
                    <select value={editForm.status || ''} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100">
                      <option value="active">Active</option>
                      <option value="isolated">Isolated</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </>
              )}

              {editSection === 'billing' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Paket</label>
                    <select value={editForm.billing_profile_id || ''} onChange={e => setEditForm(p => ({ ...p, billing_profile_id: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100">
                      <option value="">-- Tidak diubah --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.profile_name} — {idr(p.final_price)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Tipe Pembayaran</label>
                    <select value={editForm.payment_type?.toLowerCase() || ''} onChange={e => setEditForm(p => ({ ...p, payment_type: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100">
                      <option value="postpaid">Postpaid</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>
                  <EF label="Tanggal Tagih (1-28)" k="billing_cycle" form={editForm} set={setEditForm} />
                  <div>
                    <label className="text-sm font-medium text-slate-300">Next Invoice Date</label>
                    <input type="date" value={editForm.next_invoice || ''} onChange={e => setEditForm(p => ({ ...p, next_invoice: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-800/80 pt-4">
                <button type="button" onClick={() => setEditSection(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper components ────────────────────────────────────────

function Card({ title, onEdit, children }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 shadow-lg ring-1 ring-white/5">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        {onEdit && (
          <button onClick={onEdit} className="rounded-lg px-3 py-1 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/30 hover:bg-cyan-500/10">
            Edit
          </button>
        )}
      </div>
      <div className="p-5 space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="min-w-[90px] shrink-0 text-xs text-slate-500">{label}</span>
      <span className={`text-right text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
    </div>
  )
}

function EF({ label, k, form, set, required, textarea, mono }) {
  const val = form[k] ?? ''
  const cls = `mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none ${mono ? 'font-mono' : ''}`
  return (
    <div>
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {textarea
        ? <textarea rows={2} value={val} onChange={e => set(p => ({ ...p, [k]: e.target.value }))} className={`${cls} resize-none`} />
        : <input required={required} value={val} onChange={e => set(p => ({ ...p, [k]: e.target.value }))} className={cls} />
      }
    </div>
  )
}
