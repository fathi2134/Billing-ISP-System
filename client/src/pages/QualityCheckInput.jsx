import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

const card =
  'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5'
const inp =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
const sel =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
const btnPrimary =
  'rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:opacity-50'

export function QualityCheckInput() {
  const [customers, setCustomers] = useState([])
  const [tickets, setTickets] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [okMsg, setOkMsg] = useState(null)

  const [qcForm, setQcForm] = useState({
    customer_id: '',
    ticket_id: '',
    qc_type: 'maintenance',
    title: '',
    result: 'lulus',
    score_percent: '',
    notes: '',
    external_ref: '',
  })

  const loadRefs = useCallback(async () => {
    const [{ data: pel }, { data: tix }] = await Promise.all([api.getCustomers({ limit: 10000 }), api.getTickets({})])
    setCustomers(pel || [])
    setTickets(tix || [])
  }, [])

  useEffect(() => {
    setErr(null)
    loadRefs().catch((e) => setErr(e.message))
  }, [loadRefs])

  async function onSubmit(e) {
    e.preventDefault()
    if (!qcForm.title.trim()) {
      setErr('Judul QC wajib diisi')
      return
    }
    setBusy(true)
    setErr(null)
    setOkMsg(null)
    try {
      await api.createQualityCheck({
        customer_id: qcForm.customer_id ? Number(qcForm.customer_id) : undefined,
        ticket_id: qcForm.ticket_id ? Number(qcForm.ticket_id) : undefined,
        qc_type: qcForm.qc_type,
        title: qcForm.title.trim(),
        result: qcForm.result,
        score_percent: qcForm.score_percent === '' ? undefined : qcForm.score_percent,
        notes: qcForm.notes.trim() || undefined,
        external_ref: qcForm.external_ref.trim() || undefined,
      })
      setQcForm((f) => ({
        ...f,
        title: '',
        notes: '',
        score_percent: '',
        external_ref: '',
      }))
      setOkMsg('QC berhasil disimpan.')
      setTimeout(() => setOkMsg(null), 4000)
    } catch (e2) {
      setErr(e2.message || 'Gagal simpan QC')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Input quality check
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Form pencatatan QC. Hubungkan ke sistem lama lewat <span className="font-mono text-xs">external_ref</span>. Riwayat per pelanggan ada di Data Pelanggan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/tickets"
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
          >
            Tiket gangguan
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
      {okMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100">
          {okMsg}
        </div>
      )}

      <section className={card}>
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Form QC
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Daftar tiket di bawah memuat semua tiket (untuk opsi “Tiket terkait”). Perbarui dari halaman Tiket jika perlu.
          </p>
        </div>
        <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pelanggan (opsional)</label>
            <select className={sel} value={qcForm.customer_id} onChange={(e) => setQcForm((f) => ({ ...f, customer_id: e.target.value }))}>
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tiket terkait (opsional)</label>
            <select className={sel} value={qcForm.ticket_id} onChange={(e) => setQcForm((f) => ({ ...f, ticket_id: e.target.value }))}>
              <option value="">—</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ticket_no} — {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe QC</label>
            <select className={sel} value={qcForm.qc_type} onChange={(e) => setQcForm((f) => ({ ...f, qc_type: e.target.value }))}>
              <option value="installation">Instalasi</option>
              <option value="maintenance">Maintenance</option>
              <option value="survey">Survey</option>
              <option value="complaint_followup">Tindak lanjut komplain</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hasil</label>
            <select className={sel} value={qcForm.result} onChange={(e) => setQcForm((f) => ({ ...f, result: e.target.value }))}>
              <option value="lulus">Lulus</option>
              <option value="tidak_lulus">Tidak lulus</option>
              <option value="perlu_perbaikan">Perlu perbaikan</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Judul</label>
            <input className={inp} required value={qcForm.title} onChange={(e) => setQcForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Skor % (opsional)</label>
            <input
              className={inp}
              type="number"
              min={0}
              max={100}
              value={qcForm.score_percent}
              onChange={(e) => setQcForm((f) => ({ ...f, score_percent: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">External ref (DB QC lama)</label>
            <input
              className={inp}
              value={qcForm.external_ref}
              onChange={(e) => setQcForm((f) => ({ ...f, external_ref: e.target.value }))}
              placeholder="mis. QC-LEGACY-001"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
            <textarea className={inp} rows={4} value={qcForm.notes} onChange={(e) => setQcForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Menyimpan…' : 'Simpan QC'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-800"
              onClick={() => loadRefs().catch((e) => setErr(e.message))}
            >
              Muat ulang pelanggan & tiket
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
