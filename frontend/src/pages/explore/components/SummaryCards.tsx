

interface Summary {
  total_vehicles?: number
  avg_hourly_count?: number
  peak_hour?: number
  peak_hour_avg?: number
  busiest_weekday_name?: string
  busiest_junction?: string
  observation_count?: number
}

function Stat({
  label,
  value,
  sub,
  colorScheme,
}: {
  label: string
  value: string
  sub?: string
  colorScheme: 'sky' | 'indigo' | 'emerald' | 'amber' | 'cyan'
}) {
  const badgeClasses = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs hover:shadow-md transition-all duration-200">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">{value}</p>
      {sub && (
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1.5 ${badgeClasses[colorScheme]}`}>
          {sub}
        </span>
      )}
    </div>
  )
}

export default function SummaryCards({ data }: { data: Summary }) {
  if (!data || Object.keys(data).length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
      <Stat
        label="Total Vehicles"
        value={(data.total_vehicles ?? 0).toLocaleString()}
        colorScheme="sky"
      />
      <Stat
        label="Avg Hourly Volume"
        value={`${Math.round(data.avg_hourly_count ?? 0).toLocaleString()}`}
        sub="veh / hour"
        colorScheme="indigo"
      />
      <Stat
        label="Peak Hour"
        value={`${String(data.peak_hour ?? 0).padStart(2, '0')}:00`}
        sub={`avg ${Math.round(data.peak_hour_avg ?? 0)} veh/h`}
        colorScheme="amber"
      />
      <Stat
        label="Busiest Day"
        value={data.busiest_weekday_name ?? '—'}
        sub="Weekly High"
        colorScheme="emerald"
      />
      <Stat
        label="Busiest Junction"
        value={data.busiest_junction ?? '—'}
        sub={`${(data.observation_count ?? 0).toLocaleString()} records`}
        colorScheme="cyan"
      />
    </div>
  )
}
