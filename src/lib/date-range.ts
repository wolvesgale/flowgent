const MS_PER_DAY = 86_400_000
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Returns the UTC date range representing the JST calendar day that is `plusDays + 1`
 * after the day of `base`. For example, `plusDays = 0` yields tomorrow in JST.
 */
export function jstDayRangeUTC(base: Date, plusDays: number) {
  const baseMs = base.getTime() + JST_OFFSET_MS
  const startOfTodayJstMs = Math.floor(baseMs / MS_PER_DAY) * MS_PER_DAY
  const start = new Date(startOfTodayJstMs + (plusDays + 1) * MS_PER_DAY - JST_OFFSET_MS)
  const end = new Date(startOfTodayJstMs + (plusDays + 2) * MS_PER_DAY - JST_OFFSET_MS)
  return { start, end }
}

export function jstTomorrowRangeUTC(now: Date = new Date()) {
  return jstDayRangeUTC(now, 0)
}
