import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../api'

const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY

const idr = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const namaBulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

const METODE_BAYAR = [
  { v: 'cash', l: 'Cash' },
  { v: 'virtual_account', l: 'Virtual Account' },
]

const metodeBadge = (m) => {
  if (m === 'cash') return <span className="ml-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">Cash</span>
  if (m === 'virtual_account') return <span className="ml-1 inline-flex rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25">VA</span>
  if ((m && String(m).includes('midtrans')) || ['bank_transfer', 'gopay', 'qris', 'shopeepay', 'echannel'].includes(m))
    return <span className="ml-1 inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25">Online</span>
  return m ? <span className="ml-1 text-[10px] text-slate-500">{m}</span> : null
}

const BULAN_OPTIONS = [
  { v: '', l: 'Semua Bulan' },
  { v: '1', l: 'Januari' }, { v: '2', l: 'Februari' }, { v: '3', l: 'Maret' },
  { v: '4', l: 'April' }, { v: '5', l: 'Mei' }, { v: '6', l: 'Juni' },
  { v: '7', l: 'Juli' }, { v: '8', l: 'Agustus' }, { v: '9', l: 'September' },
  { v: '10', l: 'Oktober' }, { v: '11', l: 'November' }, { v: '12', l: 'Desember' },
]

const BULAN_CREATE_OPTIONS = BULAN_OPTIONS.filter((o) => o.v !== '')

function yearCreateOptions() {
  const now = new Date().getFullYear()
  const opts = []
  for (let y = now + 1; y >= now - 3; y--) opts.push({ v: String(y), l: String(y) })
  return opts
}

function yearOptions() {
  const now = new Date().getFullYear()
  const opts = [{ v: '', l: 'Semua Tahun' }]
  for (let y = now + 1; y >= now - 3; y--) opts.push({ v: String(y), l: String(y) })
  return opts
}

/** Sandbox: SB-Mid-client-… Production: Mid-client-… */
function midtransSnapScriptUrl(clientKey) {
  if (!clientKey) return null
  const isProduction = String(clientKey).startsWith('Mid-client-')
  return isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js'
}

export function Tagihan() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [busyId] = useState(null)

  const [filterBulan, setFilterBulan] = useState('')
  const [filterTahun, setFilterTahun] = useState('')

  const [bayarModal, setBayarModal] = useState(null)
  const [metode, setMetode] = useState('cash')
  const [bayarBusy, setBayarBusy] = useState(false)
  const [snapBusy, setSnapBusy] = useState(null)
  const [waBusy, setWaBusy] = useState(null)
  const [bulkWaBusy, setBulkWaBusy] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [midtransServerReady, setMidtransServerReady] = useState(null)
  const snapLoaded = useRef(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createCustomers, setCreateCustomers] = useState([])
  const [createCustLoading, setCreateCustLoading] = useState(false)
  const [createCustErr, setCreateCustErr] = useState(null)
  const [createSearch, setCreateSearch] = useState('')
  const [createSel, setCreateSel] = useState(() => new Set())
  const [createBulan, setCreateBulan] = useState(() => String(new Date().getMonth() + 1))
  const [createTahun, setCreateTahun] = useState(() => String(new Date().getFullYear()))
  const [createNominalMode, setCreateNominalMode] = useState('subscription')
  const [createFixedNominal, setCreateFixedNominal] = useState('')
  const [createKirimWa, setCreateKirimWa] = useState(true)
  const [createIncludeLink, setCreateIncludeLink] = useState(true)
  const [createSubmitBusy, setCreateSubmitBusy] = useState(false)

  useEffect(() => {
    api.getPaymentConfigStatus()
      .then((d) => setMidtransServerReady(Boolean(d.midtrans_ready)))
      .catch(() => setMidtransServerReady(false))
  }, [])

  useEffect(() => {
    const url = midtransSnapScriptUrl(MIDTRANS_CLIENT_KEY)
    if (!url || snapLoaded.current) return
    if (document.getElementById('midtrans-snap')) { snapLoaded.current = true; return }
    const s = document.createElement('script')
    s.id = 'midtrans-snap'
    s.src = url
    s.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY)
    s.onload = () => { snapLoaded.current = true }
    document.head.appendChild(s)
  }, [])

  async function refreshTagihanSetelahSnap(tagihanId) {
    for (let i = 0; i < 12; i++) {
      try {
        const r = await api.syncTagihanMidtrans(tagihanId)
        if (r.updated === true || r.status_bayar === 'lunas') {
          await load()
          return
        }
      } catch {
        /* webhook/sync bisa telat — lanjut poll */
      }
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    await load()
  }

  async function bayarOnline(row) {
    if (!MIDTRANS_CLIENT_KEY) return alert('Set VITE_MIDTRANS_CLIENT_KEY di client/.env (sama jenis dengan server: Sandbox atau Production)')
    if (!window.snap) return alert('Snap.js belum termuat. Muat ulang halaman.')
    setSnapBusy(row.id)
    try {
      const { token } = await api.createPaymentToken(row.id)
      window.snap.pay(token, {
        onSuccess: () => { void refreshTagihanSetelahSnap(row.id) },
        onPending: () => { void refreshTagihanSetelahSnap(row.id) },
        onError: () => { void refreshTagihanSetelahSnap(row.id) },
        onClose: () => { setSnapBusy(null) },
      })
    } catch (e) {
      alert(e.message || 'Gagal membuat transaksi')
      setSnapBusy(null)
    }
  }

  const load = useCallback(async () => {
    setErr(null); setLoading(true)
    try {
      const params = { limit: 10000 }
      if (filterBulan) params.bulan = filterBulan
      if (filterTahun) params.tahun = filterTahun
      const { data } = await api.getTagihan(params)
      setRows(data || [])
      setSelected(new Set())
    } catch (e) { setErr(e.message || 'Gagal memuat data tagihan') }
    finally { setLoading(false) }
  }, [filterBulan, filterTahun])

  useEffect(() => { load() }, [load])

  function openBayarModal(r) {
    setMetode('cash')
    setBayarModal(r)
  }

  async function konfirmasiBayar() {
    if (!bayarModal) return
    setBayarBusy(true)
    try {
      await api.bayarTagihan(bayarModal.id, metode)
      setBayarModal(null)
      await load()
    } catch (e) {
      alert(e.message || 'Gagal mengubah status tagihan')
    } finally {
      setBayarBusy(false)
    }
  }

  async function kirimWaSatu(r) {
    if (!window.confirm(`Kirim tagihan ${namaBulan[r.bulan]} ${r.tahun} ke ${r.wa}?`)) return
    setWaBusy(r.id)
    try {
      const res = await api.kirimWaTagihan(r.id, { include_payment_link: true })
      alert(res.message + (res.payment_link_included ? '\n(Link bayar Midtrans disertakan)' : '\n(Tanpa link online — cek server key atau error Midtrans)'))
      await load()
    } catch (e) {
      alert(e.message || 'Gagal kirim WA')
    } finally {
      setWaBusy(null)
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllBelum() {
    const ids = rows.filter((r) => r.status_bayar === 'belum').map((r) => r.id)
    setSelected(new Set(ids))
  }

  async function kirimWaBulk() {
    const ids = rows.filter((r) => selected.has(r.id) && r.status_bayar === 'belum').map((r) => r.id)
    if (!ids.length) return alert('Pilih minimal satu tagihan yang statusnya Belum')
    if (!window.confirm(`Kirim WA ke ${ids.length} pelanggan? Proses bisa beberapa menit (jeda antar pesan).`)) return
    setBulkWaBusy(true)
    try {
      const res = await api.kirimWaTagihanBulk(ids, true)
      alert(`Selesai. Berhasil: ${res.ok}, Gagal: ${res.failed}`)
      await load()
    } catch (e) {
      alert(e.message || 'Gagal bulk WA')
    } finally {
      setBulkWaBusy(false)
    }
  }

  async function openBuatTagihanModal() {
    const d = new Date()
    setCreateSearch('')
    setCreateSel(new Set())
    setCreateBulan(String(d.getMonth() + 1))
    setCreateTahun(String(d.getFullYear()))
    setCreateNominalMode('subscription')
    setCreateFixedNominal('')
    setCreateKirimWa(true)
    setCreateIncludeLink(true)
    setCreateCustErr(null)
    setCreateOpen(true)
    setCreateCustLoading(true)
    try {
      const all = []
      let page = 1
      let totalPages = 1
      do {
        const res = await api.getCustomers({ page, limit: 100 })
        all.push(...(res.data || []))
        totalPages = res.meta?.totalPages ?? 1
        page += 1
      } while (page <= totalPages)
      setCreateCustomers(all)
    } catch (e) {
      setCreateCustErr(e.message || 'Gagal memuat pelanggan')
      setCreateCustomers([])
    } finally {
      setCreateCustLoading(false)
    }
  }

  function toggleCreateSel(id) {
    setCreateSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const qCreate = createSearch.trim().toLowerCase()
  const filteredCreateCustomers = createCustomers.filter((c) => {
    if (!qCreate) return true
    const name = (c.full_name || '').toLowerCase()
    const wa = String(c.whatsapp_number || '')
    const code = String(c.customer_code || '').toLowerCase()
    return name.includes(qCreate) || wa.includes(createSearch.trim()) || code.includes(qCreate)
  })

  function selectAllFilteredCreate() {
    setCreateSel((prev) => {
      const next = new Set(prev)
      for (const c of filteredCreateCustomers) next.add(c.id)
      return next
    })
  }

  async function submitBuatTagihan() {
    const ids = [...createSel]
    if (!ids.length) return alert('Pilih minimal satu pelanggan')
    const body = {
      bulan: Number(createBulan),
      tahun: Number(createTahun),
      customer_ids: ids,
      nominal_mode: createNominalMode,
      kirim_wa: createKirimWa,
      include_payment_link: createIncludeLink,
    }
    if (createNominalMode === 'fixed') {
      const n = Number(String(createFixedNominal).replace(/\./g, '').replace(/,/g, '.'))
      if (!Number.isFinite(n) || n <= 0) return alert('Nominal manual harus berupa angka > 0')
      body.nominal = n
    }
    const hint = createKirimWa
      ? `Buat tagihan untuk ${ids.length} pelanggan dan kirim WA? Proses bisa beberapa menit (jeda antar pesan).`
      : `Buat tagihan untuk ${ids.length} pelanggan (tanpa kirim WA)?`
    if (!window.confirm(hint)) return
    setCreateSubmitBusy(true)
    try {
      const res = await api.buatTagihanDanKirim(body)
      alert(
        `Selesai.\nDibuat: ${res.created}\nDuplikat (sudah ada): ${res.skipped_duplicate}\nWA terkirim: ${res.wa_sent}\nWA gagal: ${res.wa_failed}\nTanpa nomor WA: ${res.wa_skipped}`,
      )
      setCreateOpen(false)
      setFilterBulan(createBulan)
      setFilterTahun(createTahun)
      await load()
    } catch (e) {
      alert(e.message || 'Gagal membuat tagihan')
    } finally {
      setCreateSubmitBusy(false)
    }
  }

  const card = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40'
  const thead = 'border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-900/60'
  const tbody = 'divide-y divide-slate-100 dark:divide-slate-800/60'
  const rowCls = 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30'
  const sel = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'

  const showSnapButton = MIDTRANS_CLIENT_KEY && midtransServerReady !== false
  const belumCount = rows.filter((r) => r.status_bayar === 'belum').length

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Daftar Tagihan</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Tandai lunas, bayar online (Midtrans Snap), atau kirim tagihan ke WhatsApp pelanggan dengan link bayar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {belumCount > 0 && selected.size > 0 && (
            <button
              type="button"
              disabled={bulkWaBusy}
              onClick={kirimWaBulk}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {bulkWaBusy ? 'Mengirim…' : `Kirim WA (${selected.size})`}
            </button>
          )}
          <button
            type="button"
            onClick={openBuatTagihanModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
          >
            Buat tagihan
          </button>
          <button onClick={() => load()} disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">
            Muat Ulang
          </button>
        </div>
      </header>

      {midtransServerReady === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Midtrans di server belum dikonfigurasi (MIDTRANS_SERVER_KEY). Tombol &quot;Bayar Online&quot; dan link di WA tidak akan dibuat sampai .env backend dilengkapi.
        </div>
      )}

      {!MIDTRANS_CLIENT_KEY && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Set <span className="font-mono text-xs">VITE_MIDTRANS_CLIENT_KEY</span> di <span className="font-mono text-xs">client/.env</span> agar Snap &quot;Bayar Online&quot; di browser bisa jalan (client key dari dashboard Midtrans, sama mode sandbox/production dengan server).
        </div>
      )}

      {err && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-500/30">{err}</div>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Bulan</label>
          <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
            {BULAN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tahun</label>
          <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
            {yearOptions().map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        {belumCount > 0 && (
          <button type="button" onClick={selectAllBelum}
            className="rounded-lg px-3 py-2 text-xs font-medium text-cyan-700 ring-1 ring-cyan-200 transition hover:bg-cyan-50 dark:text-cyan-300 dark:ring-cyan-500/30 dark:hover:bg-cyan-500/10">
            Pilih semua belum bayar
          </button>
        )}
        {(filterBulan || filterTahun) && (
          <button onClick={() => { setFilterBulan(''); setFilterTahun('') }}
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800">
            Reset Filter
          </button>
        )}
      </div>

      <section className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className={thead}>
                <th className="w-10 px-3 py-4 font-medium">
                  <span className="sr-only">Pilih</span>
                </th>
                <th className="px-3 py-3 font-medium">Periode</th>
                <th className="px-3 py-3 font-medium">Pelanggan</th>
                <th className="px-3 py-3 font-medium">WA</th>
                <th className="px-3 py-3 font-medium text-right">Nominal</th>
                <th className="px-3 py-3 font-medium text-center">Status</th>
                <th className="px-3 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className={tbody}>
              {loading && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">Memuat data...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">Belum ada tagihan.</td></tr>}
              {!loading && rows.map((r) => (
                <tr key={r.id} className={rowCls}>
                  <td className="px-3 py-3.5">
                    {r.status_bayar === 'belum' ? (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
                        aria-label={`Pilih tagihan ${r.id}`}
                      />
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">{namaBulan[r.bulan]} {r.tahun}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                    {r.nama_customer || '-'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{r.wa}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{idr(r.nominal)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.status_bayar === 'lunas'
                      ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">
                          Lunas{metodeBadge(r.payment_method)}
                        </span>
                      )
                      : <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">Belum</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.status_bayar === 'belum'
                      ? (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={waBusy === r.id}
                            onClick={() => kirimWaSatu(r)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {waBusy === r.id ? 'WA…' : 'Kirim WA'}
                          </button>
                          {showSnapButton && (
                            <button
                              disabled={snapBusy === r.id}
                              onClick={() => bayarOnline(r)}
                              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                            >
                              {snapBusy === r.id ? '…' : 'Bayar Online'}
                            </button>
                          )}
                          <button
                            disabled={busyId === r.id}
                            onClick={() => openBayarModal(r)}
                            className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-50"
                          >
                            Lunas
                          </button>
                        </div>
                      )
                      : <span className="px-3 text-xs italic text-slate-400">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Buat tagihan</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pilih satu atau banyak pelanggan. Opsional langsung kirim WA dengan link bayar Midtrans (jika server key aktif).
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Bulan</label>
                <select
                  className={sel}
                  value={createBulan}
                  onChange={(e) => setCreateBulan(e.target.value)}
                >
                  {BULAN_CREATE_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tahun</label>
                <select
                  className={sel}
                  value={createTahun}
                  onChange={(e) => setCreateTahun(e.target.value)}
                >
                  {yearCreateOptions().map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Nominal</label>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-300">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="nomMode"
                    checked={createNominalMode === 'subscription'}
                    onChange={() => setCreateNominalMode('subscription')}
                    className="accent-violet-600"
                  />
                  Dari paket / subscription
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="nomMode"
                    checked={createNominalMode === 'fixed'}
                    onChange={() => setCreateNominalMode('fixed')}
                    className="accent-violet-600"
                  />
                  Manual (sama semua)
                </label>
              </div>
              {createNominalMode === 'fixed' && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 150000"
                  value={createFixedNominal}
                  onChange={(e) => setCreateFixedNominal(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
                />
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={createKirimWa}
                  onChange={(e) => setCreateKirimWa(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                />
                Langsung kirim WhatsApp
              </label>
              <label className={`flex cursor-pointer items-center gap-2 ${!createKirimWa ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  disabled={!createKirimWa}
                  checked={createIncludeLink}
                  onChange={(e) => setCreateIncludeLink(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                />
                Sertakan link bayar Midtrans di pesan (perlu MIDTRANS_SERVER_KEY)
              </label>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Cari pelanggan</label>
              <input
                type="search"
                value={createSearch}
                onChange={(e) => setCreateSearch(e.target.value)}
                placeholder="Nama, kode, atau nomor WA"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
              />
            </div>

            {createCustErr && (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{createCustErr}</div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllFilteredCreate}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-500/30 dark:hover:bg-violet-500/10"
              >
                Pilih semua hasil filter ({filteredCreateCustomers.length})
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">Dipilih: {createSel.size}</span>
            </div>

            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {createCustLoading && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">Memuat pelanggan…</div>
              )}
              {!createCustLoading && filteredCreateCustomers.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada pelanggan.</div>
              )}
              {!createCustLoading
                && filteredCreateCustomers.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={createSel.has(c.id)}
                      onChange={() => toggleCreateSel(c.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 accent-violet-600"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{c.full_name || c.customer_code || `#${c.id}`}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {c.customer_code ? `${c.customer_code} · ` : ''}{c.whatsapp_number || '— tanpa WA'}
                      </span>
                    </span>
                  </label>
                ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={createSubmitBusy}
                onClick={() => setCreateOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={createSubmitBusy || createCustLoading}
                onClick={submitBuatTagihan}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50"
              >
                {createSubmitBusy ? 'Memproses…' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bayarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Konfirmasi Pembayaran</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {bayarModal.nama_customer || '-'} — {namaBulan[bayarModal.bulan]} {bayarModal.tahun}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums text-cyan-700 dark:text-cyan-300">{idr(bayarModal.nominal)}</p>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Metode Pembayaran</label>
              <select className={sel} value={metode} onChange={(e) => setMetode(e.target.value)}>
                {METODE_BAYAR.map((m) => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={bayarBusy}
                onClick={() => setBayarModal(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={bayarBusy}
                onClick={konfirmasiBayar}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {bayarBusy ? 'Menyimpan…' : 'Konfirmasi Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
