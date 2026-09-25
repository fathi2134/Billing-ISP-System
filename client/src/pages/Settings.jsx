import { useState, useEffect } from 'react'
import * as api from '../api'

export function Settings() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [users, setUsers] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ nama: '', email: '', password: '', role: 'bos' })
  const [busy, setBusy] = useState(false)

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = currentUser.role === 'admin'

  async function loadUsers() {
    try { const { data } = await api.getUsers(); setUsers(data || []) }
    catch (e) { console.error(e) }
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  async function onAddUser(e) {
    e.preventDefault(); setBusy(true)
    try {
      await api.createUser(addForm)
      setAddForm({ nama: '', email: '', password: '', role: 'bos' })
      setAddOpen(false); await loadUsers()
    } catch (e) { alert(e.message || 'Gagal menambah user') }
    finally { setBusy(false) }
  }

  async function onDeleteUser(id) {
    if (!window.confirm('Yakin ingin menghapus pengguna ini?')) return
    try { await api.deleteUser(id); await loadUsers() }
    catch (e) { alert(e.message || 'Gagal menghapus') }
  }

  const card   = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/40'
  const inp    = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
  const sel    = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100'
  const thead  = 'border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60'

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Pengaturan</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Atur preferensi tampilan dan hak akses pengguna sistem.</p>
      </header>

      {/* Tema */}
      <section className={card}>
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tampilan Visual</h2>
          <p className="text-sm text-slate-500">Pilih mode warna kesukaan Anda.</p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4">
            {[
              { value: 'light', label: 'Mode Terang (Light)', desc: 'Tampilan bersih dengan latar belakang putih.' },
              { value: 'dark',  label: 'Mode Gelap (Dark)',   desc: 'Cocok untuk digunakan di ruang minim cahaya.' },
            ].map(opt => (
              <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ${theme === opt.value ? 'border-cyan-500 bg-cyan-50 text-cyan-800 ring-1 ring-cyan-500/50 dark:bg-cyan-900/20 dark:text-cyan-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <input type="radio" name="theme" value={opt.value} checked={theme === opt.value} onChange={e => setTheme(e.target.value)} className="h-4 w-4 accent-cyan-500" />
                <div className="flex flex-col">
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs opacity-70">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* User management */}
      <section className={card}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manajemen Akses (Role)</h2>
            <p className="text-sm text-slate-500">Atur siapa saja yang bisa masuk ke panel aplikasi ini.</p>
          </div>
          {isAdmin && (
            <button onClick={() => setAddOpen(true)} className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
              + Tambah Pengguna
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-6 py-4 font-medium">Nama Pengguna</th>
                <th className="px-3 py-3 font-medium">Login</th>
                <th className="px-3 py-3 font-medium">Role</th>
                {isAdmin && <th className="px-6 py-4 font-medium text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">{u.nama}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-3 py-2.5">
                    {u.role === 'admin'
                      ? <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25">Admin</span>
                      : <span className="inline-flex rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">Bos</span>}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-3.5 text-right">
                      <button onClick={() => onDeleteUser(u.id)} disabled={u.id === currentUser.id}
                        className="text-xs font-medium text-rose-500 hover:text-rose-700 disabled:opacity-30 dark:text-rose-400 dark:hover:text-rose-300">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Tambah User */}
      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Pengguna Sistem</h3>
            <form onSubmit={onAddUser} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama</label>
                <input required className={inp} value={addForm.nama} onChange={e => setAddForm({...addForm, nama: e.target.value})} placeholder="Bos Besar" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Login Username</label>
                <input required className={inp} value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="admin_baru" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password Baru</label>
                <input type="password" required className={inp} value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hak Akses (Role)</label>
                <select className={sel} value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                  <option value="bos">Bos (Read-only)</option>
                  <option value="admin">Admin (Full Akses)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800/80">
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
