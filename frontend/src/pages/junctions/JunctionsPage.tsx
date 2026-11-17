import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJunctions, createJunction, deleteJunction } from '../../api/junctions'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import { JunctionIcon } from '../../components/Icons'

export default function JunctionsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ junction_id: '', name: '', capacity_per_hour: '' })
  const junctions = useQuery({ queryKey: ['junctions'], queryFn: () => getJunctions() })

  const create = useMutation({
    mutationFn: () =>
      createJunction({
        junction_id: form.junction_id.trim(),
        name: form.name.trim(),
        capacity_per_hour: form.capacity_per_hour ? Number(form.capacity_per_hour) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['junctions'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setForm({ junction_id: '', name: '', capacity_per_hour: '' })
    },
  })

  const remove = useMutation({
    mutationFn: deleteJunction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['junctions'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })

  const handleQuickFill = (id: string, name: string, cap: string) => {
    setForm({ junction_id: id, name, capacity_per_hour: cap })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Intersection Registry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure junction identifiers, geographical locations, and maximum design capacities.
          </p>
        </div>
      </div>

      {/* Registration Card */}
      <Card title="Register New Intersection" className="border-slate-200/90 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Junction ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
              placeholder="e.g. JCT-001 or J1"
              value={form.junction_id}
              onChange={e => setForm(p => ({ ...p, junction_id: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Intersection Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
              placeholder="e.g. Main St & 1st Ave"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Hourly Design Capacity <span className="text-slate-400 font-normal">(veh/h)</span>
            </label>
            <input
              type="number"
              className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
              placeholder="e.g. 1200"
              value={form.capacity_per_hour}
              onChange={e => setForm(p => ({ ...p, capacity_per_hour: e.target.value }))}
            />
          </div>
        </div>

        {/* Quick sample fills */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Quick Samples:</span>
          <button
            type="button"
            onClick={() => handleQuickFill('JCT-001', 'Main St & 1st Ave', '1200')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono transition-colors cursor-pointer"
          >
            + JCT-001 (1200)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('JCT-004', 'Central Park N & 7th', '1500')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono transition-colors cursor-pointer"
          >
            + JCT-004 (1500)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('J1', 'Main Junction 1', '500')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono transition-colors cursor-pointer"
          >
            + J1 (500)
          </button>
        </div>

        {create.error && <div className="mt-3"><ErrorAlert message={(create.error as Error).message} /></div>}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!form.junction_id || !form.name || create.isPending}
            className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 cursor-pointer"
          >
            <JunctionIcon size={16} />
            <span>{create.isPending ? 'Registering…' : 'Register Intersection'}</span>
          </button>
        </div>
      </Card>

      {/* Junctions List Table */}
      {junctions.isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card
          title={`Registered Intersections (${junctions.data?.total ?? 0})`}
          className="border-slate-200/90 shadow-xs"
        >
          {!(junctions.data?.items?.length) ? (
            <div className="text-center py-10 text-slate-400">
              <JunctionIcon size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Intersections Registered Yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Use the form above or click a Quick Sample to add your first junction.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-1">Junction ID</th>
                    <th className="pb-3">Intersection Name</th>
                    <th className="pb-3 text-right">Capacity (veh/h)</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(junctions.data?.items ?? []).map((j) => (
                    <tr key={j.junction_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pl-1">
                        <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-md border border-sky-200">
                          {j.junction_id}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-slate-800">{j.name}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-700">
                        {j.capacity_per_hour ? `${j.capacity_per_hour.toLocaleString()} veh/h` : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove.mutate(j.junction_id)}
                          disabled={remove.isPending}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
