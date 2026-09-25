import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../api'

const idr = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const EMPTY_FORM = {
  customer_code: '', full_name: '', whatsapp_number: '', email: '',
  id_card_number: '', address: '', map_link: '',
  internet: { type: 'PPPoE', username: '', ip_address: '', nas_name: '', service_name: '', status: 'active' },
  subscription: { billing_profile_id: '', payment_type: 'postpaid', billing_cycle: '15', next_invoice_date: '' },
}

// ── Shared class tokens ─────────────────────────────────────
const card   = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40'
const thead  = 'border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold dark:border-slate-800 dark:bg-slate-900/60'
const divRow = 'divide-y divide-slate-100 dark:divide-slate-800/60'
const inp    = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-600'
const sel    = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'

export function Pelanggan() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState(null)
  const [profiles, setProfiles]   = useState([])
  const [search, setSearch]       = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage]           = useState(1)
  const [limit, setLimit]         = useState(25)
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [addOpen, setAddOpen]     = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [busyId, setBusyId]       = useState(null)
  const [toast, setToast]         = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [detail, setDetail]       = useState({})
  const [detailLoading, setDetailLoading] = useState(null)
  const [editOpen, setEditOpen]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState(EMPTY_FORM)
  const toastRef = useRef(null)

  const [historyModal, setHistoryModal] = useState(null)
  const [historyTickets, setHistoryTickets] = useState([])
  const [historyQcRows, setHistoryQcRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyTicketBusy, setHistoryTicketBusy] = useState(null)

  const [isolirBusyId, setIsolirBusyId] = useState(null)

  // Debounce search input → triggers server-side filtering; reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Billing profiles are independent of pagination — fetch once.
  useEffect(() => {
    api.getBillingProfiles()
      .then(({ data }) => setProfiles(data || []))
      .catch(e => setErr(e.message || 'Gagal memuat billing profiles'))
  }, [])

  const load = useCallback(async () => {
    setErr(null); setLoading(true)
    try {
      const resp = await api.getCustomers({ page, limit, search: debouncedSearch })
      setRows(resp.data || [])
      const meta = resp.meta || {}
      setTotal(meta.total || 0)
      setTotalPages(meta.totalPages || 1)
      // If current page is now past the end (e.g., after deleting the last row on a page), step back.
      if ((meta.totalPages || 1) < page) setPage(meta.totalPages || 1)
    } catch (e) { setErr(e.message || 'Gagal memuat data') }
    finally { setLoading(false) }
  }, [page, limit, debouncedSearch])

  useEffect(() => { load() }, [load])

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok })
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 4000)
  }, [])

  async function toggle(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (detail[id]) return
    setDetailLoading(id)
    try {
      const { data } = await api.getCustomerDetail(id)
      setDetail(prev => ({ ...prev, [id]: data }))
    } catch (e) {
      showToast('Gagal memuat detail: ' + e.message, false)
      setExpanded(null)
    } finally { setDetailLoading(null) }
  }

  function setField(path, value) {
    setForm(prev => {
      if (path.includes('.')) {
        const [s, k] = path.split('.')
        return { ...prev, [s]: { ...prev[s], [k]: value } }
      }
      return { ...prev, [path]: value }
    })
  }

  async function onAdd(e) {
    e.preventDefault(); setBusyId('add')
    try {
      await api.createCustomer(form)
      showToast('Pelanggan berhasil ditambahkan.')
      setAddOpen(false); setForm(EMPTY_FORM); await load()
    } catch (error) { showToast(error.message || 'Gagal menambah', false) }
    finally { setBusyId(null) }
  }

  async function onEditOpen(r, d) {
    // Pastikan detail sudah dimuat sebelum buka edit modal
    let det = d
    if (!det) {
      try {
        const { data } = await api.getCustomerDetail(r.id)
        det = data
        setDetail(prev => ({ ...prev, [r.id]: data }))
      } catch (e) {
        showToast('Gagal memuat detail: ' + e.message, false)
        return
      }
    }
    const unformat = (v) => (!v || v === '-') ? '' : v
    setEditId(r.id)
    setEditForm({
      customer_code: r.customer_code || '',
      full_name: r.full_name || '',
      whatsapp_number: r.whatsapp_number || '',
      email: unformat(det?.customer?.email),
      id_card_number: unformat(det?.customer?.id_card),
      address: unformat(det?.customer?.address),
      map_link: det?.customer?.map_link || '',
      internet: {
        id: det?.internet?.id,
        type: det?.internet?.type || 'PPPoE',
        username: det?.internet?.username || '',
        ip_address: det?.internet?.ip_address === '-' ? '' : (det?.internet?.ip_address || ''),
        nas_name: det?.internet?.nas === '-' ? '' : (det?.internet?.nas || ''),
        service_name: det?.internet?.service_name === '-' ? '' : (det?.internet?.service_name || ''),
        status: r.internet_status || 'active',
      },
      subscription: {
        id: det?.billing?.subscription_id,
        billing_profile_id: det?.billing?.billing_profile_id || '',
        payment_type: det?.billing?.payment_type?.toLowerCase() || 'postpaid',
        billing_cycle: String(det?.billing?.billing_cycle || '15'),
        next_invoice_date: '',
      },
    })
    setEditOpen(true)
  }

  async function onEditSave(e) {
    e.preventDefault(); setBusyId('edit')
    try {
      await api.updateCustomer(editId, editForm)
      showToast('Data pelanggan berhasil diperbarui.')
      setEditOpen(false)
      setDetail(prev => { const n = { ...prev }; delete n[editId]; return n })
      await load()
      setExpanded(editId)
    } catch (error) { showToast(error.message || 'Gagal menyimpan', false) }
    finally { setBusyId(null) }
  }

  function setEditField(path, value) {
    setEditForm(prev => {
      if (path.includes('.')) {
        const [s, k] = path.split('.')
        return { ...prev, [s]: { ...prev[s], [k]: value } }
      }
      return { ...prev, [path]: value }
    })
  }

  const loadHistoryForCustomer = useCallback(async (customerId) => {
    const [{ data: t }, { data: q }] = await Promise.all([
      api.getTickets({ customer_id: customerId }),
      api.getQualityChecks({ customer_id: customerId }),
    ])
    setHistoryTickets(t || [])
    setHistoryQcRows(q || [])
  }, [])

  async function openHistoryModal(customerRow) {
    const customer = {
      id: customerRow.id,
      full_name: customerRow.full_name,
      customer_code: customerRow.customer_code,
    }
    setHistoryModal({ customer })
    setHistoryTickets([])
    setHistoryQcRows([])
    setHistoryLoading(true)
    try {
      await loadHistoryForCustomer(customer.id)
    } catch (error) {
      showToast(error.message || 'Gagal memuat riwayat', false)
      setHistoryModal(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function patchTicketFromHistory(ticketId, status) {
    if (!historyModal?.customer?.id) return
    const cid = historyModal.customer.id
    setHistoryTicketBusy(ticketId)
    try {
      await api.updateTicket(ticketId, { status })
      showToast('Status tiket diperbarui')
      await loadHistoryForCustomer(cid)
    } catch (error) {
      showToast(error.message || 'Gagal memperbarui tiket', false)
    } finally {
      setHistoryTicketBusy(null)
    }
  }

  async function onDelete(id, name) {
    if (!window.confirm(`Hapus "${name}"? Semua data terkait ikut terhapus.`)) return
    setBusyId(id)
    try {
      await api.deleteCustomer(id)
      showToast('Pelanggan berhasil dihapus.')
      if (expanded === id) setExpanded(null)
      setDetail(prev => { const n = { ...prev }; delete n[id]; return n })
      await load()
    } catch (error) { showToast(error.message || 'Gagal menghapus', false) }
    finally { setBusyId(null) }
  }

  async function onIsolir(id, name) {
    if (!window.confirm(`Isolir "${name}"? Akses internet akan diblokir.`)) return
    setIsolirBusyId(id)
    try {
      await api.postIsolir(id)
      showToast(`${name} berhasil diisolir.`)
      setDetail(prev => { const n = { ...prev }; delete n[id]; return n })
      await load()
    } catch (error) { showToast(error.message || 'Gagal isolir', false) }
    finally { setIsolirBusyId(null) }
  }

  async function onBukaIsolir(id, name) {
    if (!window.confirm(`Buka isolir "${name}"? Akses internet akan dipulihkan.`)) return
    setIsolirBusyId(id)
    try {
      await api.postBukaIsolir(id)
      showToast(`Isolir ${name} berhasil dibuka.`)
      setDetail(prev => { const n = { ...prev }; delete n[id]; return n })
      await load()
    } catch (error) { showToast(error.message || 'Gagal buka isolir', false) }
    finally { setIsolirBusyId(null) }
  }

  const statusBadge = (s) => {
    if (s === 'active')   return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25"><span className="h-1.5 w-1.5 rounded-md bg-emerald-500 dark:bg-emerald-400" />Aktif</span>
    if (s === 'isolated') return <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25"><span className="h-1.5 w-1.5 rounded-md bg-rose-500 dark:bg-rose-400" />Isolir</span>
    return <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25"><span className="h-1.5 w-1.5 rounded-md bg-slate-400" />-</span>
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">Daftar Pelanggan</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Klik panah untuk melihat detail pelanggan</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">
            Muat Ulang
          </button>
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-500">
            + Tambah Pelanggan
          </button>
        </div>
      </header>

      <input type="text" placeholder="Cari nama, WA, username, kode..." value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder-slate-500"
      />

      {err && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-500/30">{err}</div>}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${toast.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/95 dark:text-emerald-100 dark:ring-emerald-500/40' : 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/95 dark:text-rose-100 dark:ring-rose-500/40'}`}>
          {toast.msg}
        </div>
      )}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={thead}>
                <th className="w-10 px-3 py-4" />
                <th className="px-3 py-3 font-medium">Nama / WA</th>
                <th className="px-3 py-3 font-medium">Username Internet</th>
                <th className="px-3 py-3 font-medium">Paket</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className={divRow}>
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Memuat data...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Belum ada pelanggan.</td></tr>}

              {!loading && rows.map((r) => {
                const isOpen = expanded === r.id
                const d = detail[r.id]
                const loadingDetail = detailLoading === r.id

                return (
                  <Fragment key={r.id}>
                    <tr className={`transition-colors ${isOpen ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                      <td className="px-3 py-3.5">
                        <button onClick={() => toggle(r.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-400">
                          <svg className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{r.full_name}</div>
                        <div className="text-xs text-slate-500">{r.whatsapp_number} · <span className="font-mono">{r.customer_code}</span></div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-xs text-slate-700 dark:text-slate-300">{r.username || '-'}</div>
                        <div className="text-xs text-slate-400">{r.internet_type || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-slate-700 dark:text-slate-300">{r.profile_name || '-'}</div>
                        <div className="text-xs text-slate-400 tabular-nums">{r.final_price ? idr(r.final_price) : '-'}</div>
                      </td>
                      <td className="px-3 py-2.5">{statusBadge(r.internet_status)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {r.internet_status === 'active' && (
                            <button
                              type="button"
                              disabled={isolirBusyId === r.id || busyId === r.id}
                              onClick={() => onIsolir(r.id, r.full_name)}
                              className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30 dark:hover:bg-amber-500/25"
                            >
                              Isolir
                            </button>
                          )}
                          {r.internet_status === 'isolated' && (
                            <button
                              type="button"
                              disabled={isolirBusyId === r.id || busyId === r.id}
                              onClick={() => onBukaIsolir(r.id, r.full_name)}
                              className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30 dark:hover:bg-emerald-500/25"
                            >
                              Buka Isolir
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => openHistoryModal(r)}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700"
                          >
                            Tiket & QC
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => onDelete(r.id, r.full_name)}
                            className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30 dark:hover:bg-rose-500/25"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={6} className="border-t border-slate-200 bg-slate-50/80 px-6 py-5 dark:border-slate-700/60 dark:bg-slate-800/30">
                          {loadingDetail
                            ? <p className="text-sm text-slate-400">Memuat detail...</p>
                            : d
                              ? (
                                <div>
                                <div className="mb-3 flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openHistoryModal(r)}
                                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700"
                                  >
                                    Riwayat tiket & QC
                                  </button>
                                  <button onClick={() => onEditOpen(r, d)}
                                    className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-200 transition hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/30 dark:hover:bg-cyan-500/25">
                                    Edit Data
                                  </button>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                  <DCard title="Kontak">
                                    <DR label="Nama"    v={d.customer?.name} />
                                    <DR label="WA"      v={d.customer?.whatsapp} />
                                    <DR label="Email"   v={d.customer?.email} />
                                    <DR label="KTP"     v={d.customer?.id_card} mono />
                                    <DR label="Alamat"  v={d.customer?.address} />
                                  </DCard>
                                  <DCard title="Internet">
                                    <DR label="Tipe"     v={d.internet?.type} />
                                    <DR label="Username" v={d.internet?.username} mono />
                                    <DR label="IP"       v={d.internet?.ip_address} mono />
                                    <DR label="NAS"      v={d.internet?.nas} />
                                  </DCard>
                                  <DCard title="Billing">
                                    {d.billing ? (
                                      <>
                                        <DR label="Paket"     v={d.billing.profile} />
                                        <DR label="Tipe"      v={d.billing.payment_type} />
                                        <DR label="Tgl tagih" v={`Tgl ${d.billing.billing_cycle}`} />
                                        <DR label="Next inv." v={fmtDate(d.billing.next_invoice)} />
                                        <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-right dark:bg-slate-900/60">
                                          <span className="text-xs text-slate-500">Tagihan</span>
                                          <p className="text-base font-bold text-cyan-700 tabular-nums dark:text-cyan-300">{idr(d.billing.amount)}</p>
                                        </div>
                                      </>
                                    ) : <p className="text-xs text-slate-400">Belum ada subscription.</p>}
                                  </DCard>
                                  <DCard title={`Invoice (${d.invoices?.length ?? 0})`}>
                                    {d.invoices?.length === 0
                                      ? <p className="text-xs text-slate-400">Belum ada invoice.</p>
                                      : d.invoices.map(inv => (
                                        <div key={inv.id} className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/50">
                                          <div className="flex items-center justify-between">
                                            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">#{inv.invoice_number}</span>
                                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25' : inv.status === 'Overdue' ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25' : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25'}`}>
                                              {inv.status}
                                            </span>
                                          </div>
                                          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                            <span>{fmtDate(inv.due_date)}</span>
                                            <span className="tabular-nums text-slate-700 dark:text-slate-200">{idr(inv.total)}</span>
                                          </div>
                                        </div>
                                      ))
                                    }
                                  </DCard>
                                </div>
                                </div>
                              )
                              : null
                          }
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col items-start gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-300">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {total === 0
                ? 'Tidak ada data'
                : `Menampilkan ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} dari ${total}`}
            </span>
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Per halaman
              <select
                value={limit}
                onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Sebelumnya
            </button>
            <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Selanjutnya →
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tambah Pelanggan */}
      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 dark:bg-black/60">
          <div className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Pelanggan Baru</h3>
            <form onSubmit={onAdd} className="mt-6 space-y-6">

              <Section label="Data Kontak">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kode Pelanggan" placeholder="Otomatis jika kosong" value={form.customer_code} onChange={v => setField('customer_code', v)} />
                  <Field label="Nama Lengkap *" required value={form.full_name} onChange={v => setField('full_name', v)} />
                  <Field label="WhatsApp (62xxx) *" required value={form.whatsapp_number} onChange={v => setField('whatsapp_number', v)} />
                  <Field label="Email" value={form.email} onChange={v => setField('email', v)} />
                  <Field label="No. KTP" value={form.id_card_number} onChange={v => setField('id_card_number', v)} />
                  <Field label="Link Maps" value={form.map_link} onChange={v => setField('map_link', v)} />
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
                    <textarea rows={2} value={form.address} onChange={e => setField('address', e.target.value)} className={`${inp} resize-none`} />
                  </div>
                </div>
              </Section>

              <Section label="Akun Internet">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe</label>
                    <select value={form.internet.type} onChange={e => setField('internet.type', e.target.value)} className={sel}>
                      <option>PPPoE</option><option>DHCP</option><option>Static</option>
                    </select>
                  </div>
                  <Field label="Username *" required value={form.internet.username} onChange={v => setField('internet.username', v)} />
                  <Field label="IP Address" value={form.internet.ip_address} onChange={v => setField('internet.ip_address', v)} />
                  <Field label="NAS Name" value={form.internet.nas_name} onChange={v => setField('internet.nas_name', v)} />
                  <Field label="Service Name" value={form.internet.service_name} onChange={v => setField('internet.service_name', v)} />
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <select value={form.internet.status} onChange={e => setField('internet.status', e.target.value)} className={sel}>
                      <option value="active">Active</option>
                      <option value="isolated">Isolated</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>
              </Section>

              <Section label="Billing & Paket">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Paket *</label>
                    <select required value={form.subscription.billing_profile_id} onChange={e => setField('subscription.billing_profile_id', e.target.value)} className={sel}>
                      <option value="">-- Pilih Paket --</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name} — {idr(p.final_price)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe Pembayaran</label>
                    <select value={form.subscription.payment_type} onChange={e => setField('subscription.payment_type', e.target.value)} className={sel}>
                      <option value="postpaid">Postpaid</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>
                  <Field label="Tanggal Tagih (1-28)" placeholder="15" value={form.subscription.billing_cycle} onChange={v => setField('subscription.billing_cycle', v)} />
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tagihan Pertama *</label>
                    <input required type="date" value={form.subscription.next_invoice_date} onChange={e => setField('subscription.next_invoice_date', e.target.value)} className={inp} />
                  </div>
                </div>
              </Section>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800/80">
                <button type="button" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM) }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={busyId === 'add'}
                  className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
                  {busyId === 'add' ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal riwayat tiket + QC */}
      {historyModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div className="my-6 w-full max-w-5xl rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700/80">
              <div>
                <h3 id="history-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Riwayat tiket & QC
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {historyModal.customer.full_name}{' '}
                  <span className="font-mono text-xs text-slate-400">({historyModal.customer.customer_code})</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Tutup"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[min(75vh,640px)] overflow-auto px-6 py-4 space-y-8">
              {historyLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Memuat…</p>
              ) : (
                <>
                  <section>
                    <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Tiket gangguan</h4>
                    {historyTickets.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada tiket.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                              <th className="px-3 py-2 font-medium">No tiket</th>
                              <th className="px-3 py-2 font-medium">Kategori</th>
                              <th className="px-3 py-2 font-medium">Judul</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                              <th className="px-3 py-2 font-medium">Aksi</th>
                              <th className="px-3 py-2 font-medium">Dibuka</th>
                              <th className="px-3 py-2 font-medium">Akar masalah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {historyTickets.map((t) => {
                              const canKerjakan = t.status === 'open'
                              const canSelesai = t.status === 'open' || t.status === 'in_progress'
                              const rowBusy = historyTicketBusy === t.id
                              return (
                                <tr key={t.id} className="dark:hover:bg-slate-800/40">
                                  <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{t.ticket_no}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{t.category}</td>
                                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{t.title}</td>
                                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                                    {t.status === 'open' ? 'Buka' : t.status === 'in_progress' ? 'Diproses' : t.status === 'resolved' ? 'Selesai' : t.status === 'closed' ? 'Ditutup' : t.status}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        disabled={rowBusy || !canKerjakan}
                                        onClick={() => patchTicketFromHistory(t.id, 'in_progress')}
                                        className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30"
                                      >
                                        Kerjakan
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowBusy || !canSelesai}
                                        onClick={() => patchTicketFromHistory(t.id, 'resolved')}
                                        className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
                                      >
                                        Selesai
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                                    {t.opened_at ? new Date(t.opened_at).toLocaleString('id-ID') : '—'}
                                  </td>
                                  <td className="max-w-[180px] truncate px-3 py-2 text-xs text-slate-500" title={t.root_cause || ''}>
                                    {t.root_cause || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Quality check</h4>
                    {historyQcRows.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada QC.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                              <th className="px-3 py-2 font-medium">Waktu</th>
                              <th className="px-3 py-2 font-medium">Judul</th>
                              <th className="px-3 py-2 font-medium">Hasil</th>
                              <th className="px-3 py-2 font-medium">Tiket</th>
                              <th className="px-3 py-2 font-medium">Ref eksternal</th>
                              <th className="px-3 py-2 font-medium">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {historyQcRows.map((q) => (
                              <tr key={q.id} className="dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                                  {q.checked_at ? new Date(q.checked_at).toLocaleString('id-ID') : '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{q.title}</td>
                                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">{q.result}</td>
                                <td className="px-3 py-2 font-mono text-xs text-slate-500">{q.ticket_no || '—'}</td>
                                <td className="px-3 py-2 font-mono text-xs text-slate-500">{q.external_ref || '—'}</td>
                                <td className="max-w-[220px] truncate px-3 py-2 text-xs text-slate-500" title={q.notes || ''}>
                                  {q.notes || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Pelanggan */}
      {editOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 dark:bg-black/60">
          <div className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Data Pelanggan</h3>
            <form onSubmit={onEditSave} className="mt-6 space-y-6">

              <Section label="Data Kontak">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kode Pelanggan" value={editForm.customer_code} onChange={v => setEditField('customer_code', v)} />
                  <Field label="Nama Lengkap *" required value={editForm.full_name} onChange={v => setEditField('full_name', v)} />
                  <Field label="WhatsApp (62xxx) *" required value={editForm.whatsapp_number} onChange={v => setEditField('whatsapp_number', v)} />
                  <Field label="Email" value={editForm.email} onChange={v => setEditField('email', v)} />
                  <Field label="No. KTP" value={editForm.id_card_number} onChange={v => setEditField('id_card_number', v)} />
                  <Field label="Link Maps" value={editForm.map_link} onChange={v => setEditField('map_link', v)} />
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
                    <textarea rows={2} value={editForm.address} onChange={e => setEditField('address', e.target.value)} className={`${inp} resize-none`} />
                  </div>
                </div>
              </Section>

              <Section label="Akun Internet">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe</label>
                    <select value={editForm.internet.type} onChange={e => setEditField('internet.type', e.target.value)} className={sel}>
                      <option>PPPoE</option><option>DHCP</option><option>Static</option>
                    </select>
                  </div>
                  <Field label="Username *" required value={editForm.internet.username} onChange={v => setEditField('internet.username', v)} />
                  <Field label="IP Address" value={editForm.internet.ip_address} onChange={v => setEditField('internet.ip_address', v)} />
                  <Field label="NAS Name" value={editForm.internet.nas_name} onChange={v => setEditField('internet.nas_name', v)} />
                  <Field label="Service Name" value={editForm.internet.service_name} onChange={v => setEditField('internet.service_name', v)} />
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <select value={editForm.internet.status} onChange={e => setEditField('internet.status', e.target.value)} className={sel}>
                      <option value="active">Active</option>
                      <option value="isolated">Isolated</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>
              </Section>

              <Section label="Billing & Paket">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Paket *</label>
                    <select required value={editForm.subscription.billing_profile_id} onChange={e => setEditField('subscription.billing_profile_id', e.target.value)} className={sel}>
                      <option value="">-- Pilih Paket --</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name} — {idr(p.final_price)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipe Pembayaran</label>
                    <select value={editForm.subscription.payment_type} onChange={e => setEditField('subscription.payment_type', e.target.value)} className={sel}>
                      <option value="postpaid">Postpaid</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>
                  <Field label="Tanggal Tagih (1-28)" placeholder="15" value={editForm.subscription.billing_cycle} onChange={v => setEditField('subscription.billing_cycle', v)} />
                </div>
              </Section>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800/80">
                <button type="button" onClick={() => setEditOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={busyId === 'edit'}
                  className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60">
                  {busyId === 'edit' ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function DCard({ title, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function DR({ label, v, mono }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className={`text-right text-xs text-slate-700 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{v || '-'}</span>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input required={required} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-600" />
    </div>
  )
}
