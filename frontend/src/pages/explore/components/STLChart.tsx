import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface STLData {
  timestamps: string[]
  observed: number[]
  trend: number[]
  seasonal: number[]
  residual: number[]
  error?: string
}

function MiniChart({ data, dataKey, color, label }: {
  data: Array<Record<string, unknown>>; dataKey: string; color: string; label: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={data} margin={{ top: 2, right: 8, bottom: 2, left: 8 }}>
          <XAxis dataKey="t" hide />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            formatter={(v: number) => [v.toFixed(1), label]}
            labelFormatter={() => ''}
            contentStyle={{ fontSize: 11 }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function STLChart({ data }: { data: STLData | undefined }) {
  if (!data) return <p className="text-sm text-gray-400 py-8 text-center">Select a single junction to view STL decomposition.</p>
  if (data.error) return <p className="text-sm text-yellow-600 py-4">{data.error}</p>
  if (!data.timestamps?.length) return <p className="text-sm text-gray-400 py-8 text-center">No data</p>

  const step = Math.max(1, Math.floor(data.timestamps.length / 60))
  const chartData = data.timestamps
    .filter((_, i) => i % step === 0)
    .map((ts, i) => ({
      t: new Date(ts).toLocaleDateString(),
      observed: data.observed[i * step],
      trend: data.trend[i * step],
      seasonal: data.seasonal[i * step],
      residual: data.residual[i * step],
    }))

  return (
    <div className="space-y-3">
      <MiniChart data={chartData} dataKey="observed" color="#0ea5e9" label="Observed" />
      <MiniChart data={chartData} dataKey="trend" color="#f59e0b" label="Trend" />
      <MiniChart data={chartData} dataKey="seasonal" color="#10b981" label="Seasonal" />
      <MiniChart data={chartData} dataKey="residual" color="#94a3b8" label="Residual" />
    </div>
  )
}
