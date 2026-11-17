import { Outlet, NavLink } from 'react-router-dom'
import {
  DashboardIcon, JunctionIcon, DatasetIcon, ExploreIcon,
  FeaturesIcon, ModelsIcon, ForecastsIcon, AccuracyIcon,
  ReportsIcon, TrafficLightIcon
} from './Icons'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/junctions', label: 'Junctions', icon: JunctionIcon },
  { to: '/datasets', label: 'Datasets', icon: DatasetIcon },
  { to: '/explore', label: 'Explore & STL', icon: ExploreIcon },
  { to: '/features', label: 'Features', icon: FeaturesIcon },
  { to: '/models', label: 'Models', icon: ModelsIcon },
  { to: '/forecasts', label: 'Forecasts', icon: ForecastsIcon },
  { to: '/accuracy', label: 'Accuracy', icon: AccuracyIcon },
  { to: '/reports', label: 'Reports', icon: ReportsIcon },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white flex flex-col shrink-0 shadow-2xl z-20">
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <TrafficLightIcon size={22} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                JunctionFlow
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-400/30">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Traffic Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Control Center
          </div>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / System Status */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              FastAPI + Mongo 7
            </span>
            <span className="font-mono text-slate-400">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-auto bg-slate-50/70 p-8 min-w-0">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
