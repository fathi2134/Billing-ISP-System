import { useSearchParams, Link } from 'react-router-dom'

export function PaymentPending() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id')
  const transactionStatus = params.get('transaction_status')

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/15">
          <svg className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Menunggu Pembayaran
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran sesuai instruksi yang diberikan.
        </p>

        {orderId && (
          <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Order ID</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-800 dark:text-amber-300">{orderId}</p>
          </div>
        )}

        {transactionStatus && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Status: <span className="font-medium text-amber-600 dark:text-amber-400">{transactionStatus}</span>
          </p>
        )}

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Catatan:</p>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-700 dark:text-amber-400">
            <li>- Status akan otomatis diperbarui setelah pembayaran diterima</li>
            <li>- Simpan Order ID sebagai bukti transaksi</li>
            <li>- Hubungi admin jika ada kendala</li>
          </ul>
        </div>

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
