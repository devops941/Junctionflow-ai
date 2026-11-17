const COLORS: Record<string, { bg: string; dot: string }> = {
  uploaded:  { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  validated: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  failed:    { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  processed: { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  training:  { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  ready:     { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  low:       { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  moderate:  { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  high:      { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  critical:  { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-ping' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = COLORS[status] ?? { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}
