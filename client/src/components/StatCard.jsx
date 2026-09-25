export function StatCard({ title, value, hint, icon: Icon, variant = 'slate' }) {
  const v = {
    slate:   'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
    cyan:    'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/40 dark:text-cyan-400',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400',
    amber:   'text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400',
    rose:    'text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400'
  }[variant] || 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`p-2 rounded-md ${v}`}>
            <Icon />
          </div>
        )}
        <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-500">{hint}</p>
      </div>
    </div>
  )
}
