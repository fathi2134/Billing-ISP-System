import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'
import { WaQrCode } from '../components/WaQrCode'

function formatPreview(text, max = 120) {
  const s = String(text || '')
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

/** Status baca pesan dari kolom log (whatsapp-web.js ack). */
function waReadStatus(l) {
  if (l.status !== 'sent') return { label: '—', tone: 'muted' }
  if (l.wa_read_at) return { label: 'Dibaca', tone: 'read' }
  if (l.wa_delivered_at) return { label: 'Diterima', tone: 'delivered' }
  if (l.sent_at) return { label: 'Terkirim', tone: 'sent' }
  return { label: 'Terkirim', tone: 'sent' }
}

export function WhatsAppAdmin() {
  const [templates, setTemplates] = useState([])
  const [pelanggan, setPelanggan] = useState([])
  const [logs, setLogs] = useState([])
  const [schedules, setSchedules] = useState([])

  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const [templateName, setTemplateName] = useState('')
  const [templateText, setTemplateText] = useState('Halo {{nama}}, tagihan ISP Anda siap dibayar.')
  const [editingTemplateId, setEditingTemplateId] = useState(null)

  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) || null, [templates, selectedTemplateId])

  const [selectedRecipients, setSelectedRecipients] = useState(new Set())
  const [tanggal, setTanggal] = useState(() => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })
  const [waktu, setWaktu] = useState(() => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
  })

  const [waStatus, setWaStatus] = useState('LOADING')
  const [waQr, setWaQr] = useState(null)

  const selectedCount = selectedRecipients.size
  const isAllSelected = pelanggan.length > 0 && selectedCount === pelanggan.length

  function handleSelectAll() {
    if (isAllSelected) {
      setSelectedRecipients(new Set())
    } else {
      setSelectedRecipients(new Set(pelanggan.map((p) => p.id)))
    }
  }

  async function loadAll() {
    setErr(null)
    try {
      const [{ data: pel }, { data: tpl }] = await Promise.all([api.getCustomers({ limit: 10000 }), api.getWhatsappTemplates()])
      setPelanggan(pel || [])
      setTemplates(tpl || [])

      // Logs bersifat opsional: jangan sampai gagal load logs membuat template terlihat tidak tersimpan
      try {
        const { data: lg } = await api.getWhatsappLogs(20)
        setLogs(lg || [])
      } catch { /* optional, ignore */ }

      try {
        const { data: schedData } = await api.getWhatsappSchedules()
        setSchedules(schedData || [])
      } catch { /* optional, ignore */ }

      if (tpl?.length && selectedTemplateId == null) setSelectedTemplateId(tpl[0].id)
    } catch (e) {
      setErr(e.message || 'Gagal memuat data')
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let interval
    async function checkStatus() {
      try {
        const data = await api.getWaStatus()
        setWaStatus(data.status)
        setWaQr(data.qr || null)
      } catch {
        setWaStatus('ERROR')
        setWaQr(null)
      }

      // Auto-refresh table log dan table antrean (Real-time Feedback)
      try {
        const [logsRes, schedRes] = await Promise.all([
          api.getWhatsappLogs(20),
          api.getWhatsappSchedules()
        ])
        setLogs(logsRes.data || [])
        setSchedules(schedRes.data || [])
      } catch { /* polling, ignore */ }
    }
    checkStatus()
    interval = setInterval(checkStatus, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [])

  function toggleRecipient(id) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onSubmitTemplate(e) {
    e.preventDefault()
    if (!templateName.trim()) return setErr('nama_template wajib diisi')
    if (!templateText.trim()) return setErr('template_text wajib diisi')

    setBusy(true)
    setErr(null)
    try {
      if (editingTemplateId) {
        await api.updateWhatsappTemplate(editingTemplateId, { nama_template: templateName.trim(), template_text: templateText })
        setEditingTemplateId(null)
      } else {
        await api.createWhatsappTemplate({ nama_template: templateName.trim(), template_text: templateText })
      }
      setTemplateName('')
      setTemplateText('Halo {{nama}}, tagihan ISP Anda siap dibayar.')
      await loadAll()
    } catch (e2) {
      setErr(e2.message || 'Gagal menyimpan template')
    } finally {
      setBusy(false)
    }
  }

  function onEditTemplate(t) {
    setEditingTemplateId(t.id)
    setTemplateName(t.nama_template)
    setTemplateText(t.template_text)
  }

  function cancelEdit() {
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateText('Halo {{nama}}, tagihan ISP Anda siap dibayar.')
  }

  async function onDeleteTemplate(id) {
    if (!window.confirm('Yakin hapus template ini? Jadwal antrean yang terlanjur memakai template ini mungkin akan ikut terhapus (Cascade).')) return
    setBusy(true)
    try {
      await api.deleteWhatsappTemplate(id)
      if (selectedTemplateId === id) setSelectedTemplateId(null)
      if (editingTemplateId === id) cancelEdit()
      await loadAll()
    } catch (e) {
      setErr(e.message || 'Gagal menghapus template')
    } finally {
      setBusy(false)
    }
  }

  async function onSchedule(e) {
    e.preventDefault()
    if (!selectedTemplateId) return setErr('Pilih template dulu')
    if (selectedRecipients.size === 0) return setErr('Pilih minimal 1 penerima')
    if (!tanggal || !waktu) return setErr('Tanggal dan waktu wajib diisi')

    setBusy(true)
    setErr(null)
    try {
      await api.scheduleWhatsapp({
        template_id: selectedTemplateId,
        pelanggan_ids: Array.from(selectedRecipients),
        tanggal,
        waktu,
      })
      setSelectedRecipients(new Set())
      alert('Jadwal berhasil ditambahkan ke antrean! Sedang diproses di background.')
      await loadAll()
    } catch (e2) {
      setErr(e2.message || 'Gagal menjadwalkan')
    } finally {
      setBusy(false)
    }
  }

  async function onClearSchedules() {
    if (!window.confirm('Yakin ingin menghapus SEMUA antrean jadwal?')) return
    setBusy(true)
    try {
      await api.deleteWhatsappSchedules()
      setSchedules([])
      await loadAll()
    } catch (e) {
      setErr(e.message || 'Gagal menghapus antrean')
    } finally {
      setBusy(false)
    }
  }

  async function onClearLogs() {
    if (!window.confirm('Yakin ingin menghapus SEMUA riwayat pengiriman?')) return
    setBusy(true)
    try {
      await api.deleteWhatsappLogs()
      setLogs([])
      await loadAll()
    } catch (e) {
      setErr(e.message || 'Gagal menghapus log')
    } finally {
      setBusy(false)
    }
  }

  async function handleWaLogout() {
    if (!window.confirm('Yakin ingin mereset sesi WhatsApp? Anda harus scan QR ulang via terminal.')) return
    setBusy(true)
    try {
      await api.postWaLogout()
      setWaStatus('DISCONNECTED')
    } catch {
      alert('Gagal logout WA')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            WhatsApp Templates & Jadwal
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Buat template, pilih penerima, lalu kirim otomatis sesuai tanggal & waktu.
          </p>
        </div>
        <Link to="/customers" className="text-sm font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">
          Kelola Pelanggan
        </Link>
      </header>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-200 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-500/30">
          {err}
        </div>
      )}

      {/* WhatsApp Connection Status */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm p-6 dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Status Koneksi WhatsApp
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {waStatus === 'READY' || waStatus === 'AUTHENTICATED' ? 'WhatsApp sudah terhubung dan siap mengirim pesan.' :
               waStatus === 'QR_READY' ? 'QR Code siap — buka terminal server dan scan QR yang muncul di sana.' :
               waStatus === 'INITIALIZING' ? 'Sedang memuat client WhatsApp...' :
               'WhatsApp terputus atau backend tidak merespon.'}
            </p>
          </div>
          <div>
            {waStatus === 'READY' || waStatus === 'AUTHENTICATED' ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">
                  <span className="h-1.5 w-1.5 rounded-md bg-emerald-500 dark:bg-emerald-400"></span>
                  Connected
                </span>
                <button
                  type="button"
                  onClick={handleWaLogout}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">
                <span className="h-1.5 w-1.5 rounded-md bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
                {waStatus === 'QR_READY' ? 'Waiting for Scan' : 'Initializing'}
              </span>
            )}
          </div>
        </div>
        {waStatus === 'QR_READY' && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/25 dark:bg-amber-500/10">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Scan QR Code di bawah dengan WhatsApp → Linked Devices</p>
            {waQr ? (
              <div className="mt-3 flex justify-center">
                <WaQrCode value={waQr} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">QR belum tersedia, menunggu server...</p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Template Form + List */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800/80">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {editingTemplateId ? 'Edit Template' : 'Buat Template Baru'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Contoh variable:{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-black/30">{"{{nama}}"}</code>
              {' '}dan{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-black/30">{"{{wa}}"}</code>
            </p>
          </div>

          <form className="space-y-5 p-6" onSubmit={onSubmitTemplate}>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Template</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-cyan-500/50"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Misal: Tagihan Bulanan"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Isi Template</label>
              <textarea
                rows={5}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-cyan-500/50"
                value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                placeholder="Halo {{nama}}..."
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Preview: {formatPreview(templateText, 70)}
              </p>
              <div className="flex gap-2">
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition dark:text-slate-400 dark:ring-0 dark:hover:bg-slate-800"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  {busy ? 'Menyimpan…' : editingTemplateId ? 'Update Template' : 'Simpan Template'}
                </button>
              </div>
            </div>
          </form>

          <div className="border-t border-slate-200 p-6 dark:border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Daftar Template</h3>
            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-2">
              {templates.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-500">Belum ada template.</div>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-left text-sm transition',
                    selectedTemplateId === t.id
                      ? 'border-cyan-500/50 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold group flex-1">
                      <input type="radio" name="selectedTemplate" checked={selectedTemplateId === t.id} onChange={() => setSelectedTemplateId(t.id)} className="accent-cyan-500 shrink-0" />
                      <span className="group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition truncate">{t.nama_template}</span>
                    </label>
                    <div className="flex items-center gap-3 shrink-0">
                      <button type="button" onClick={() => onEditTemplate(t)} className="text-amber-600 hover:text-amber-500 text-xs font-medium dark:text-amber-400 dark:hover:text-amber-300">Edit</button>
                      <button type="button" onClick={() => onDeleteTemplate(t.id)} className="text-rose-600 hover:text-rose-500 text-xs font-medium dark:text-rose-400 dark:hover:text-rose-300">Hapus</button>
                    </div>
                  </div>
                  <div className="mt-2 pl-5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer" onClick={() => setSelectedTemplateId(t.id)}>
                    {formatPreview(t.template_text, 90)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Schedule Form */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800/80">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Jadwalkan Pesan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-500">Pilih template, penerima, tanggal, lalu jadwalkan.</p>
          </div>

          <form className="space-y-5 p-6" onSubmit={onSchedule}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Template</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:border-cyan-500/50"
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_template}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal</label>
                <input
                  type="date"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:border-cyan-500/50"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Waktu</label>
                <input
                  type="time"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:border-cyan-500/50"
                  value={waktu}
                  onChange={(e) => setWaktu(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Penerima</h3>
                  {pelanggan.length > 0 && (
                    <label className="flex items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-500 cursor-pointer bg-cyan-50 px-2 py-1 rounded-md border border-cyan-200 transition dark:text-cyan-400 dark:hover:text-cyan-300 dark:bg-cyan-950/30 dark:border-cyan-900/50">
                      <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="h-3.5 w-3.5 accent-cyan-500 rounded" />
                      Pilih Semua ({pelanggan.length})
                    </label>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">{selectedCount} dipilih</div>
              </div>

              <div className="mt-3 max-h-64 overflow-auto pr-2 space-y-2">
                {pelanggan.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-500">Belum ada pelanggan.</div>
                )}
                {pelanggan.map((p) => {
                  const checked = selectedRecipients.has(p.id)
                  return (
                    <label key={p.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer hover:bg-slate-100 dark:border-slate-800/70 dark:bg-slate-950/30 dark:hover:bg-slate-950/50">
                      <input type="checkbox" checked={checked} onChange={() => toggleRecipient(p.id)} className="mt-1 h-4 w-4 accent-cyan-400" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-200">{p.full_name}</span>
                          <span className="font-mono text-xs text-slate-400">{p.customer_code}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-all">{p.whatsapp_number}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Template aktif:{' '}
                <span className="text-slate-700 dark:text-slate-300">{selectedTemplate?.nama_template || '-'}</span>
              </p>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {busy ? 'Menjadwalkan…' : 'Jadwalkan Kirim'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Status Antrean Jadwal */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 dark:border-slate-800/80">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Status Antrean Jadwal
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-500">Melihat progres pengiriman WhatsApp massal (real-time).</p>
          </div>
          <button
            type="button"
            onClick={onClearSchedules}
            disabled={busy || schedules.length === 0}
            className="shrink-0 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30 dark:hover:bg-rose-500/25"
          >
            Bersihkan Antrean
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-500">
                <th className="px-6 py-3 font-medium">Jadwal Waktu</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Jml Penerima</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-500">
                    Belum ada antrean jadwal.
                  </td>
                </tr>
              )}
              {schedules.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{new Date(s.scheduled_at).toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2.5 text-slate-900 dark:text-slate-200">{s.nama_template || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{s.total_recipient} Orang</td>
                  <td className="px-6 py-3.5">
                    {s.status === 'queued' ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">
                        ⏳ Menunggu
                      </span>
                    ) : s.status === 'processing' ? (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 animate-pulse dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25">
                        🔄 Sedang Kirim...
                      </span>
                    ) : s.status === 'done' ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">
                        ✅ Selesai
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25">
                        ❌ Gagal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Riwayat Pengiriman */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40 dark:shadow-sm dark:ring-1 dark:ring-white/5">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 dark:border-slate-800/80">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Riwayat Pengiriman
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-500">Data dari tabel `whatsapp_delivery_log`.</p>
          </div>
          <button
            type="button"
            onClick={onClearLogs}
            disabled={busy || logs.length === 0}
            className="shrink-0 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30 dark:hover:bg-rose-500/25"
          >
            Bersihkan Log
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-500">
                <th className="px-6 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Kirim</th>
                <th className="px-4 py-3 font-medium">Status WA</th>
                <th className="px-4 py-3 font-medium">Penerima</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-6 py-3 font-medium">Konten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-500">
                    Belum ada log.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{l.created_at}</td>
                  <td className="px-3 py-2.5">
                    {l.status === 'sent' ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">
                        sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25">
                        failed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {(() => {
                      const st = waReadStatus(l)
                      const cls =
                        st.tone === 'read'
                          ? 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30'
                          : st.tone === 'delivered'
                            ? 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30'
                            : st.tone === 'sent'
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30'
                              : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      return (
                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>{st.label}</span>
                      )
                    })()}
                    {l.wa_delivered_at || l.wa_read_at ? (
                      <div className="mt-1 text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                        {l.wa_delivered_at ? <div>Diterima: {String(l.wa_delivered_at)}</div> : null}
                        {l.wa_read_at ? <div>Dibaca: {String(l.wa_read_at)}</div> : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-200">{l.nama_customer || l.nama_pelanggan || '-'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 break-all">{l.to_wa}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{l.nama_template || '-'}</td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">
                    <div className="max-w-[520px] break-words">{formatPreview(l.message_text, 160)}</div>
                    {l.error_message ? (
                      <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">Error: {formatPreview(l.error_message, 120)}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
