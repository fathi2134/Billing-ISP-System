import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard } from '../components/StatCard'
import * as api from '../api'

const card =
  'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5'
const thead =
  'border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60'
const inp =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
const sel =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
const btnPrimary =
  'rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:opacity-50'

const EMPTY_TICKET_FORM = {
  customer_id: '',
  category: 'internet_down',
  title: '',
  description: '',
  priority: 'normal',
}

const TICKET_STATUS = [
  { v: '', l: 'Semua status' },
  { v: 'open', l: 'Buka' },
  { v: 'in_progress', l: 'Diproses' },
  { v: 'resolved', l: 'Selesai' },
  { v: 'closed', l: 'Ditutup' },
]

function IconTicket() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconOpen() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function IconCog() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function statusLabel(s) {
  const m = { open: 'Buka', in_progress: 'Diproses', resolved: 'Selesai', closed: 'Ditutup' }
  return m[s] || s
}

function TicketRowActions({ t, busy, busyRow, onKerjakan, onSelesai }) {
  const canKerjakan = t.status === 'open'
  const canSelesai = t.status === 'open' || t.status === 'in_progress'
  const rowBusy = busyRow === t.id

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        disabled={busy || rowBusy || !canKerjakan}
        onClick={() => onKerjakan(t.id)}
        className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30"
      >
        Kerjakan
      </button>
      <button
        type="button"
        disabled={busy || rowBusy || !canSelesai}
        onClick={() => onSelesai(t.id)}
        className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
      >
        Selesai
      </button>
    </div>
  )
}

export function Tickets() {
  const [customers, setCustomers] = useState([])
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, selesai: 0 })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [filterCust, setFilterCust] = useState('')
  const [filterTicketStatus, setFilterTicketStatus] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET_FORM)

  const loadCustomers = useCallback(async () => {
    const { data } = await api.getCustomers({ limit: 10000 })
    setCustomers(data || [])
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getTicketStatsSummary()
      setStats({
        total: s.total ?? 0,
        open: s.open ?? 0,
        in_progress: s.in_progress ?? 0,
        selesai: s.selesai ?? 0,
      })
    } catch {
      setStats({ total: 0, open: 0, in_progress: 0, selesai: 0 })
    }
  }, [])

  const loadTickets = useCallback(async () => {
    const params = {}
    if (filterCust) params.customer_id = filterCust
    if (filterTicketStatus) params.status = filterTicketStatus
    const { data } = await api.getTickets(params)
    setTickets(data || [])
  }, [filterCust, filterTicketStatus])

  useEffect(() => {
    setErr(null)
    loadCustomers().catch((e) => setErr(e.message))
  }, [loadCustomers])

  useEffect(() => {
    setErr(null)
    setLoading(true)
    Promise.all([loadStats(), loadTickets()])
      .catch((e) => setErr(e.message || 'Gagal memuat data'))
      .finally(() => setLoading(false))
  }, [filterCust, filterTicketStatus, loadStats, loadTickets])

  useEffect(() => {
    if (addOpen) setTicketForm({ ...EMPTY_TICKET_FORM })
  }, [addOpen])

  async function refreshLists() {
    await Promise.all([loadTickets(), loadStats()])
  }

  async function onCreateTicket(e) {
    e.preventDefault()
    if (!ticketForm.customer_id || !ticketForm.title.trim()) {
      setErr('Pilih pelanggan dan isi judul tiket')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await api.createTicket({
        customer_id: Number(ticketForm.customer_id),
        category: ticketForm.category,
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim() || undefined,
        priority: ticketForm.priority,
      })
      setAddOpen(false)
      await refreshLists()
    } catch (e2) {
      setErr(e2.message || 'Gagal buat tiket')
    } finally {
      setBusy(false)
    }
  }

  async function setTicketStatus(id, status) {
    setRowBusyId(id)
    setErr(null)
    try {
      await api.updateTicket(id, { status })
      await refreshLists()
    } catch (e2) {
      setErr(e2.message || 'Gagal memperbarui tiket')
    } finally {
      setRowBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Tiket gangguan
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Ringkasan dan riwayat tiket. Tambah tiket lewat tombol di kanan — tersimpan ke database dan tampil di Data Pelanggan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500"
          >
            + Buat tiket
          </button>
          <Link
            to="/quality-check"
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
          >
            Input QC
          </Link>
          <Link to="/customers" className="text-sm font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-300">
            Data pelanggan
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-100">
          {err}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total tiket" value={loading ? '…' : stats.total} hint="Semua waktu" icon={IconTicket} variant="default" />
        <StatCard title="Buka" value={loading ? '…' : stats.open} hint="Belum ditangani" icon={IconOpen} variant="amber" />
        <StatCard title="Sedang dikerjakan" value={loading ? '…' : stats.in_progress} hint="Status diproses" icon={IconCog} variant="default" />
        <StatCard title="Selesai" value={loading ? '…' : stats.selesai} hint="Resolved + ditutup" icon={IconCheck} variant="emerald" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter pelanggan</label>
          <select className={sel} value={filterCust} onChange={(e) => setFilterCust(e.target.value)}>
            <option value="">Semua</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.customer_code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status tiket</label>
          <select className={sel} value={filterTicketStatus} onChange={(e) => setFilterTicketStatus(e.target.value)}>
            {TICKET_STATUS.map((o) => (
              <option key={o.v || 'all'} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className={card}>
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Riwayat tiket
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gunakan Kerjakan (→ diproses) atau Selesai (→ resolved). Perubahan langsung ke database.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-4 py-3 font-medium">No</th>
                <th className="px-4 py-3 font-medium">Pelanggan</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Judul</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
                <th className="px-4 py-3 font-medium">Akar masalah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Belum ada tiket.
                  </td>
                </tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{t.ticket_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t.customer_name}</div>
                    <div className="text-xs text-slate-500">{t.customer_code}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.category}</td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TicketRowActions
                      t={t}
                      busy={busy}
                      busyRow={rowBusyId}
                      onKerjakan={(id) => setTicketStatus(id, 'in_progress')}
                      onSelesai={(id) => setTicketStatus(id, 'resolved')}
                    />
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-xs text-slate-500" title={t.root_cause || ''}>
                    {t.root_cause || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60">
          <div className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Buat tiket gangguan</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Data akan tersimpan dan muncul di riwayat serta di Data Pelanggan.</p>
            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={onCreateTicket}>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pelanggan</label>
                <select
                  className={sel}
                  required
                  value={ticketForm.customer_id}
                  onChange={(e) => setTicketForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">Pilih…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} — {c.customer_code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
                <input
                  className={inp}
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="internet_down, lambat, tagihan…"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioritas</label>
                <select
                  className={sel}
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="low">Rendah</option>
                  <option value="normal">Normal</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Judul</label>
                <input
                  className={inp}
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ringkasan gangguan"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
                <textarea
                  className={inp}
                  rows={3}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Detail laporan pelanggan / teknisi"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? 'Menyimpan…' : 'Simpan tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
