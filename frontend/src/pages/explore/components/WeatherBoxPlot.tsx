import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts'

interface WeatherStats {
  min: number; q1: number; median: number; q3: number; max: number; mean: number; count: number
}
interface WeatherData {
  conditions: string[]
  stats: Record<string, WeatherStats>
}

const COND_COLORS: Record<string, string> = {
  clear: '#0ea5e9', cloudy: '#94a3b8', rain: '#3b82f6', fog: '#a1a1aa', storm: '#6366f1',
}

const CustomBoxShape = (props: {
  x?: number; y?: number; width?: number; height?: number;
  q1?: number; q3?: number; median?: number; min?: number; max?: number;
  fill?: string;
  [key: string]: unknown;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#0ea5e9' } = props
  if (!width) return null
  const cx = x + width / 2
  return (
    <g>
      <rect x={x + 4} y={y} width={width - 8} height={height} fill={fill} fillOpacity={0.7} rx={2} />
      <line x1={x + 4} x2={x + width - 4} y1={y + height / 2} y2={y + height / 2}
        stroke={fill} strokeWidth={2} />
      <line x1={cx} y1={y - 10} x2={cx} y2={y} stroke={fill} strokeWidth={1.5} strokeDasharray="3 2" />
      <line x1={cx} y1={y + height} x2={cx} y2={y + height + 10} stroke={fill} strokeWidth={1.5} strokeDasharray="3 2" />
      <line x1={cx - 6} y1={y - 10} x2={cx + 6} y2={y - 10} stroke={fill} strokeWidth={1.5} />
      <line x1={cx - 6} y1={y + height + 10} x2={cx + 6} y2={y + height + 10} stroke={fill} strokeWidth={1.5} />
    </g>
  )
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { condition: string; median: number; q1: number; q3: number; min: number; max: number; count: number } }> }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border rounded shadow p-3 text-xs space-y-1">
      <p className="font-semibold capitalize">{d.condition}</p>
      <p>Max: <strong>{d.max}</strong></p>
      <p>Q3: <strong>{d.q3}</strong></p>
      <p>Median: <strong>{d.median}</strong></p>
      <p>Q1: <strong>{d.q1}</strong></p>
      <p>Min: <strong>{d.min}</strong></p>
      <p className="text-gray-400">{d.count.toLocaleString()} observations</p>
    </div>
  )
}

export default function WeatherBoxPlot({ data }: { data: WeatherData | undefined }) {
  if (!data?.conditions?.length) return <p className="text-sm text-gray-400 py-8 text-center">No data</p>

  const chartData = data.conditions.map(cond => {
    const s = data.stats[cond]
    return {
      condition: cond,
      q1: s.q1,
      iqr: s.q3 - s.q1,
      median: s.median,
      min: s.min,
      max: s.max,
      count: s.count,
      q3: s.q3,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 10, left: 20 }}>
        <XAxis dataKey="condition" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} label={{ value: 'Vehicles/h', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="q1" stackId="box" fill="transparent" />
        <Bar dataKey="iqr" stackId="box" shape={<CustomBoxShape />}>
          {chartData.map((entry) => (
            <Cell key={entry.condition} fill={COND_COLORS[entry.condition] ?? '#0ea5e9'} />
          ))}
        </Bar>
        {chartData.map((entry) => (
          <ReferenceLine key={entry.condition} y={entry.median} stroke="transparent" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
