import { useState } from 'react'
import * as api from '../api'

export function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const res = await api.login({ email, password })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      onLogin(res.user)
    } catch (error) {
      setErr(error.message || 'Gagal masuk sistem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-sm dark:backdrop-blur-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Billing ISP
          </h1>
          <p className="mt-2 text-sm text-slate-500">Autentikasi diwajibkan untuk masuk.</p>
        </div>

        {err && (
          <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Login Username</label>
            <input
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-600"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password" required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-600"
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="mt-4 w-full rounded-lg bg-cyan-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-500 disabled:opacity-50 dark:shadow-cyan-900/30"
          >
            {loading ? 'Memeriksa...' : 'Login Sekarang'}
          </button>
        </form>
      </div>
    </div>
  )
}
