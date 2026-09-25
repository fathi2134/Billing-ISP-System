import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../api'
import { StatCard } from '../components/StatCard'

function IconUsers() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}
function IconSignal() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
}
function IconLock() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}
function IconXCircle() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IconMoney() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

const idr = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0)

export function Dashboard() {
  const [pelanggan, setPelanggan] = useState([])
  const [tagihan, setTagihan]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState(null)

  const load = useCallback(async () => {
    setErr(null); setLoading(true)
    try {
      const [resPel, resTag] = await Promise.all([api.getPelanggan(), api.getTagihan()])
      setPelanggan(resPel.data || [])
      setTagihan(resTag.data || [])
    } catch (e) { setErr(e.message || 'Gagal memuat data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const total      = pelanggan.length
    const aktif      = pelanggan.filter(r => r.internet_status === 'active').length
    const isolir     = pelanggan.filter(r => r.internet_status === 'isolated').length
    const los        = pelanggan.filter(r => r.internet_status === 'disabled').length
    const belumBayar = tagihan.filter(t => t.status_bayar === 'belum').reduce((s, t) => s + Number(t.nominal), 0)
    const sudahBayar = tagihan.filter(t => t.status_bayar === 'lunas').reduce((s, t) => s + Number(t.nominal), 0)
    return { total, aktif, isolir, los, belumBayar, sudahBayar }
  }, [pelanggan, tagihan])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">System Overview & Monitoring</p>
        </div>
        <button onClick={() => load()} disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh Data
        </button>
      </header>

      {err && <div className="rounded-md bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">{err}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Pelanggan"   value={loading ? '…' : stats.total}            hint="Terdaftar di database"      icon={IconUsers} />
        <StatCard title="User Aktif"        value={loading ? '…' : stats.aktif}            hint="Status: active"             icon={IconSignal}  variant="emerald" />
        <StatCard title="User Terisolir"    value={loading ? '…' : stats.isolir}           hint="Status: isolated"           icon={IconLock}    variant="rose" />
        <StatCard title="User LOS / Mati"   value={loading ? '…' : stats.los}              hint="Status: disabled"           icon={IconXCircle} variant="rose" />
        <StatCard title="Tagihan Menunggak" value={loading ? '…' : idr(stats.belumBayar)} hint="Akumulasi belum dibayar"    icon={IconMoney}   variant="amber" />
        <StatCard title="Tagihan Lunas"     value={loading ? '…' : idr(stats.sudahBayar)} hint="Akumulasi pendapatan masuk" icon={IconMoney}   variant="emerald" />
      </section>
    </div>
  )
}
