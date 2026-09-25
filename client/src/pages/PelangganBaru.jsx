import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'

const initial = {
  nama: '',
  wa: '',
  tipe: 'PPPoE',
  username_mikrotik: '',
  profile_mikrotik: '',
  tarif_bulanan: '',
  status: 'aktif',
}

export function PelangganBaru() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  function set(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const body = {
        nama: form.nama.trim(),
        wa: form.wa.trim(),
        tipe: form.tipe,
        username_mikrotik: form.username_mikrotik.trim(),
        profile_mikrotik: form.profile_mikrotik.trim(),
        tarif_bulanan: form.tarif_bulanan === '' ? 0 : Number(form.tarif_bulanan),
        status: form.status,
      }
      await api.createPelanggan(body)
      navigate('/', { replace: false, state: { ok: 'Pelanggan berhasil ditambahkan.' } })
    } catch (e) {
      setErr(e.message || 'Gagal menyimpan')
    } finally {
      setLoading(false)
    }
  }

  const input =
    'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Input Pelanggan Baru
        </h1>
        <p className="mt-1 text-slate-400">Data disimpan ke tabel pelanggan dan sinkron dengan MikroTik saat isolir / buka isolir.</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl ring-1 ring-white/5 sm:p-8"
      >
        {err && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">{err}</div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-300">Nama pelanggan *</label>
            <input required className={input} value={form.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Contoh: Budi Santoso" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Nomor WhatsApp *</label>
            <input
              required
              className={input}
              value={form.wa}
              onChange={(e) => set('wa', e.target.value)}
              placeholder="0812xxxx atau 62812xxxx"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Tarif bulanan (Rp)</label>
            <input
              type="number"
              min={0}
              step={1000}
              className={input}
              value={form.tarif_bulanan}
              onChange={(e) => set('tarif_bulanan', e.target.value)}
              placeholder="150000"
            />
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-400/90">MikroTik</h2>
          <p className="mt-1 text-xs text-slate-500">Harus sama dengan user di RouterOS (PPP Secret / Hotspot User).</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-300">Tipe koneksi *</label>
              <select className={input} value={form.tipe} onChange={(e) => set('tipe', e.target.value)}>
                <option value="PPPoE">PPPoE</option>
                <option value="Hotspot">Hotspot</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Status awal</label>
              <select className={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="aktif">aktif</option>
                <option value="isolir">isolir</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Username MikroTik (name) *</label>
              <input
                required
                className={`${input} font-mono`}
                value={form.username_mikrotik}
                onChange={(e) => set('username_mikrotik', e.target.value)}
                placeholder="user-rumah-01"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-300">Profile MikroTik (normal) *</label>
              <input
                required
                className={input}
                value={form.profile_mikrotik}
                onChange={(e) => set('profile_mikrotik', e.target.value)}
                placeholder="profile-10mbps"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800/80 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl px-5 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? 'Menyimpan…' : 'Simpan pelanggan'}
          </button>
        </div>
      </form>
    </div>
  )
}
