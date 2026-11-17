interface HeatmapData {
  hours: number[]
  days: number[]
  day_names: string[]
  values: number[][]
}

function getColor(value: number, min: number, max: number): string {
  if (max === min) return 'rgb(224, 242, 254)'
  const ratio = (value - min) / (max - min)
  const r = Math.round(14 + ratio * (220 - 14))
  const g = Math.round(165 + ratio * (38 - 165))
  const b = Math.round(233 + ratio * (38 - 233))
  return `rgb(${r},${g},${b})`
}

export default function HeatmapGrid({ data }: { data: HeatmapData | undefined }) {
  if (!data?.values?.length) return <p className="text-sm text-gray-400 py-8 text-center">No data</p>
  const allValues = data.values.flat()
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Hour headers */}
        <div className="flex ml-10">
          {data.hours.map(h => (
            <div key={h} className="w-8 text-center text-xs text-gray-400 font-mono">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {/* Rows */}
        {data.days.map((dayIdx, dRow) => (
          <div key={dayIdx} className="flex items-center">
            <div className="w-10 text-xs text-gray-500 font-medium shrink-0">
              {data.day_names[dRow]}
            </div>
            {data.hours.map((_, hCol) => {
              const val = data.values[dRow][hCol]
              return (
                <div
                  key={hCol}
                  className="w-8 h-7 border border-white/50 rounded-sm"
                  style={{ backgroundColor: getColor(val, min, max) }}
                  title={`${data.day_names[dRow]} ${hCol}:00 — avg ${val.toFixed(0)} veh`}
                />
              )
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-xs text-gray-400">{Math.round(min)}</span>
          <div className="flex h-3 flex-1 rounded overflow-hidden max-w-40">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: getColor(min + (max - min) * i / 19, min, max) }} />
            ))}
          </div>
          <span className="text-xs text-gray-400">{Math.round(max)}</span>
        </div>
      </div>
    </div>
  )
}
