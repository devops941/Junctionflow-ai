/**
 * Format any timestamp string into the user's local operating system time.
 * If the string does not specify a timezone offset, treat it as UTC
 * so the browser converts it directly into the local system clock (e.g. IST +5:30).
 */
export function formatSystemTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—'
  if (dateStr instanceof Date) return dateStr.toLocaleString()

  let s = String(dateStr).trim()
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z'
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleString()
}

export function formatSystemTimeOnly(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—'
  if (dateStr instanceof Date) return dateStr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  let s = String(dateStr).trim()
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z'
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Cleanly format an alert timestamp into "Nov 17, 05:00 PM"
 * without raw full date/second strings.
 */
export function formatAlertTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—'
  let s = typeof dateStr === 'string' ? dateStr.trim() : dateStr.toISOString()
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z'
  }
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(dateStr)

  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
