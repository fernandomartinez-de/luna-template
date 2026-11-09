// Week 1 Day 1 of the mesocycle. Change this if the program shifts.
export const PROGRAM_START = '2026-09-27' // Sunday, Sep 27 2026

export function programStartDate() {
  return new Date(PROGRAM_START + 'T00:00:00')
}

export function currentProgramWeek(today) {
  const start = programStartDate()
  const t = today || new Date()
  const tMid = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  if (tMid < start) return 0
  const days = Math.floor((tMid - start) / (24 * 60 * 60 * 1000))
  return Math.floor(days / 7) + 1
}

export function weekDateRange(weekNum) {
  const start = programStartDate()
  const s = new Date(start)
  s.setDate(start.getDate() + (weekNum - 1) * 7)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  const eEnd = new Date(e)
  eEnd.setHours(23, 59, 59, 999)
  return { start: s, end: eEnd }
}

export function fmtDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtWeekRange(weekNum) {
  const r = weekDateRange(weekNum)
  return `${fmtDateShort(r.start)} - ${fmtDateShort(r.end)}`
}
