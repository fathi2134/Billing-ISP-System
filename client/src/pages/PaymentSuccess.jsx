import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import * as api from '../api'

export function PaymentSuccess() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id')
  const transactionStatus = params.get('transaction_status')
  const [syncHint, setSyncHint] = useState(null)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    api.syncPaymentPublic(orderId)
      .then((r) => {
        if (cancelled) return
        if (r.updated) setSyncHint('Tagihan di sistem telah diperbarui; konfirmasi juga dikirim ke WhatsApp jika nomor terdaftar.')
        else if (r.alreadyLunas) setSyncHint('Pembayaran ini sudah tercatat sebelumnya.')
        else if (r.status_bayar === 'belum') setSyncHint('Pembayaran mungkin masih diproses — cek lagi nanti atau hubungi admin.')
      })
      .catch(() => {
        if (!cancelled) setSyncHint(null)
      })
    return () => { cancelled = true }
  }, [orderId])

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15">
          <svg className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Pembayaran Berhasil
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Terima kasih! Pembayaran Anda telah berhasil diproses.
        </p>

        {orderId && (
          <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Order ID</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{orderId}</p>
          </div>
        )}

        {transactionStatus && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Status: <span className="font-medium text-emerald-600 dark:text-emerald-400">{transactionStatus}</span>
          </p>
        )}

        {syncHint && (
          <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {syncHint}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Jika Anda pelanggan, silakan tutup halaman ini setelah selesai.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/"
            className="block w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500"
          >
            Masuk panel admin
          </Link>
        </div>
      </div>
    </div>
  )
}
