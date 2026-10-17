// Small display helpers shared by pages.

/** "1 h 05 min", "12 min", "45 s" */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`
}

/** Seconds from start to end, or to now while the session is still running. */
export function sessionSeconds(startedAt: string, endedAt: string | null) {
  return ((endedAt ? new Date(endedAt).getTime() : Date.now()) - new Date(startedAt).getTime()) / 1000
}
