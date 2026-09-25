import { useSearchParams, Link } from 'react-router-dom'

export function PaymentFailed() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id')
  const transactionStatus = params.get('transaction_status')

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/15">
          <svg className="h-10 w-10 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Pembayaran Gagal
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Maaf, pembayaran Anda tidak dapat diproses. Silakan coba lagi atau hubungi admin.
        </p>

        {orderId && (
          <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 dark:bg-rose-500/10">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Order ID</p>
            <p className="mt-0.5 text-sm font-semibold text-rose-800 dark:text-rose-300">{orderId}</p>
          </div>
        )}

        {transactionStatus && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Status: <span className="font-medium text-rose-600 dark:text-rose-400">{transactionStatus}</span>
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Gunakan kembali link pembayaran dari WhatsApp atau hubungi admin ISP Anda.
        </p>

        <div className="mt-8">
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
