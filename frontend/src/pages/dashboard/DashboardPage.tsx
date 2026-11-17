import { useQuery } from '@tanstack/react-query'
import {
  getDashboardSummary, getLiveCongestion, getRecentForecasts, getCongestionAlerts,
  type LiveCongestion, type CongestionAlert, type RecentForecast,
} from '../../api/dashboard'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  JunctionIcon, DatasetIcon, ModelsIcon, ForecastsIcon,
  AlertTriangleIcon, CarIcon, PulseIcon, RefreshIcon, SparklesIcon,
} from '../../components/Icons'
import { formatAlertTime, formatSystemTime } from '../../utils/date'
import { useDashboardSocket } from '../../services/socket'

const CG_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  low: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  moderate: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  high: {
    bg: 'bg-orange-50/70',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
  },
  critical: {
    bg: 'bg-rose-50/80',
    border: 'border-rose-300',
    text: 'text-rose-700',
    badge: 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/30',
    dot: 'bg-rose-600 animate-pulse',
  },
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colorScheme,
}: {
  label: string
  value: number | undefined
  sub?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  colorScheme: 'sky' | 'indigo' | 'emerald' | 'amber' | 'cyan'
}) {
  const schemes = {
    sky: 'from-sky-500 to-blue-600 text-sky-600 bg-sky-50',
    indigo: 'from-indigo-500 to-violet-600 text-indigo-600 bg-indigo-50',
    emerald: 'from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50',
    amber: 'from-amber-500 to-orange-600 text-amber-600 bg-amber-50',
    cyan: 'from-cyan-500 to-teal-600 text-cyan-600 bg-cyan-50',
  }
  const badgeClasses = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${schemes[colorScheme].split(' ').slice(1).join(' ')} transition-transform group-hover:scale-110 duration-200`}>
          <Icon size={19} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {value !== undefined ? value.toLocaleString() : '—'}
        </p>
        {sub && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeClasses[colorScheme]}`}>
            {sub}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
        <span>Realtime tracked</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { isConnected, lastPulse, liveStreamData, pulseCount, requestRefresh } = useDashboardSocket()

  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 30_000,
  })
  const congestion = useQuery({
    queryKey: ['live-congestion'],
    queryFn: getLiveCongestion,
    refetchInterval: 60_000,
  })
  const recent = useQuery({
    queryKey: ['recent-forecasts'],
    queryFn: () => getRecentForecasts(6),
  })
  const alerts = useQuery({
    queryKey: ['congestion-alerts'],
    queryFn: () => getCongestionAlerts(24),
    refetchInterval: 120_000,
  })

  const alertList: CongestionAlert[] = alerts.data ?? []
  const liveList: LiveCongestion[] = liveStreamData ?? congestion.data ?? []
  const recentList: RecentForecast[] = recent.data ?? []
  const criticalAlerts = alertList.filter(a => a.congestion_level === 'critical')

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Traffic Control Center</h1>
            {isConnected ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Socket.IO Live</span>
                {pulseCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200/60 rounded-full font-mono text-emerald-800">
                    #{pulseCount}
                  </span>
                )}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Connecting Stream...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Intersection telemetry, congestion forecasts, and proactive bottleneck intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {lastPulse && (
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Pulse: {lastPulse.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => requestRefresh()}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            title="Request immediate real-time sync across all connected clients"
          >
            <RefreshIcon size={13} className="text-sky-600" />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {summary.isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Junctions" value={summary.data?.total_junctions} icon={JunctionIcon} colorScheme="sky" />
          <KpiCard label="Datasets" value={summary.data?.total_datasets} icon={DatasetIcon} colorScheme="indigo" />
          <KpiCard label="Models" value={summary.data?.total_models} sub="ready" icon={ModelsIcon} colorScheme="emerald" />
          <KpiCard label="Active Models" value={summary.data?.active_models} icon={SparklesIcon} colorScheme="amber" />
          <KpiCard label="Forecasts" value={summary.data?.total_forecasts} icon={ForecastsIcon} colorScheme="cyan" />
        </div>
      )}

      {/* Critical Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-50 to-orange-50/50 border border-rose-300 p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
              <AlertTriangleIcon size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <span>Critical Congestion Alert</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                    {criticalAlerts.length} Bottleneck Peak{criticalAlerts.length > 1 ? 's' : ''} Next 24h
                  </span>
                </h3>
              </div>
              <p className="text-xs text-rose-700/90 mt-1">
                Vehicle counts are forecast to meet or exceed intersection design capacities during the following peak windows:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                {criticalAlerts.slice(0, 3).map((a, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-rose-200 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{a.junction_name}</span>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {formatAlertTime(a.timestamp)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-rose-600 font-mono">
                        {Math.round(a.predicted)} veh/h
                      </span>
                      {a.ratio ? (
                        <p className="text-[10px] font-bold text-rose-500">
                          {Math.round(a.ratio * 100)}% capacity
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Junction Status */}
        <Card
          title="Current Junction Status"
          action={
            isConnected ? (
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                LIVE STREAM
              </span>
            ) : null
          }
          className="border-slate-200/80 shadow-xs"
        >
          {congestion.isLoading && !liveList.length ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              {!liveList.length && (
                <div className="text-center py-8 text-slate-400">
                  <CarIcon size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">No live telemetry yet</p>
                  <p className="text-xs text-slate-400">Generate a forecast to populate live junction status.</p>
                </div>
              )}
              {liveList.map((item) => {
                const cfg = CG_CONFIG[item.congestion_level] ?? CG_CONFIG.low
                const ratioPct = item.ratio != null ? Math.min(100, Math.round(item.ratio * 100)) : null

                return (
                  <div
                    key={item.junction_id}
                    className={`p-3.5 rounded-xl border transition-all duration-300 hover:shadow-xs ${cfg.bg} ${cfg.border}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <CarIcon size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{item.junction_name}</p>
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">{item.junction_id}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-extrabold text-slate-900 font-mono transition-all duration-300">
                          {Math.round(item.predicted)}{' '}
                          <span className="text-[11px] font-normal text-slate-500">veh/h</span>
                        </p>
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mt-0.5 ${cfg.badge}`}>
                          {item.congestion_level}
                        </span>
                      </div>
                    </div>

                    {/* Capacity bar indicator if capacity ratio is available */}
                    {ratioPct !== null && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/40">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Capacity Utilization</span>
                          <span className="font-bold text-slate-700">{ratioPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              ratioPct >= 100 ? 'bg-rose-600' : ratioPct >= 80 ? 'bg-orange-500' : ratioPct >= 60 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${ratioPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Congestion Alerts */}
        <Card
          title="Upcoming Congestion Windows (Next 24h)"
          className="border-slate-200/80 shadow-xs"
        >
          {alerts.isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-2.5">
              {!alertList.length && (
                <div className="text-center py-8 text-slate-400">
                  <PulseIcon size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-medium text-slate-600">All Traffic Clear</p>
                  <p className="text-xs text-slate-400">No high or critical bottlenecks forecast in the next 24 hours.</p>
                </div>
              )}
              {alertList.slice(0, 7).map((a, i) => {
                const isCritical = a.congestion_level === 'critical'
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                      isCritical
                        ? 'bg-rose-50/80 border-rose-200 hover:border-rose-300'
                        : 'bg-orange-50/70 border-orange-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCritical ? 'bg-rose-600 text-white' : 'bg-orange-500 text-white'
                        }`}
                      >
                        <AlertTriangleIcon size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{a.junction_name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatAlertTime(a.timestamp)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-extrabold text-slate-900 font-mono">
                        {Math.round(a.predicted)} <span className="text-[10px] text-slate-500 font-normal">veh/h</span>
                      </p>
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 ${
                          isCritical ? 'bg-rose-600 text-white' : 'bg-orange-500 text-white'
                        }`}
                      >
                        {a.congestion_level}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Forecasts Card */}
      <Card
        title="Recent Forecast Inferences"
        className="border-slate-200/80 shadow-xs"
      >
        {recent.isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="divide-y divide-slate-100">
            {!recentList.length && (
              <p className="text-sm text-slate-400 py-3 text-center">No recent forecast jobs recorded.</p>
            )}
            {recentList.map((f) => (
              <div
                key={f._id}
                className="flex items-center justify-between py-3 text-xs hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                    <ForecastsIcon size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 font-mono">{f.junction_id}</span>
                    <p className="text-[11px] text-slate-400">
                      Generated: {formatSystemTime(f.generated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono text-[11px]">
                    {f.horizon_hours}h horizon
                  </span>
                  <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Ready
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
