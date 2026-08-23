import type { Sprint } from '../api/sprints'

/** Sprint dates are date-only strings; anchoring at midnight keeps them in the local day. */
function parseDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`)
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

export function formatShortDate(isoDate: string): string {
  return parseDateOnly(isoDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDate(isoDate: string): string {
  return parseDateOnly(isoDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * MS_PER_DAY],
  ['month', 30 * MS_PER_DAY],
  ['week', 7 * MS_PER_DAY],
  ['day', MS_PER_DAY],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

/** "2 days ago" / "in 3 hours". Falls back to "just now" under a minute. */
export function formatRelative(iso: string): string {
  const elapsed = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(elapsed)) return ''

  for (const [unit, ms] of RELATIVE_STEPS) {
    if (Math.abs(elapsed) >= ms) {
      return RELATIVE.format(Math.round(elapsed / ms), unit)
    }
  }
  return 'just now'
}

/** Short human framing of where a sprint sits relative to today. */
export function describeSprintTiming(sprint: Sprint): string {
  if (sprint.status === 'COMPLETED') return 'Completed'

  const today = startOfToday()
  const daysToStart = wholeDaysBetween(today, parseDateOnly(sprint.start_date))
  if (daysToStart > 0) {
    return daysToStart === 1 ? 'Starts tomorrow' : `Starts in ${daysToStart} days`
  }

  const daysToEnd = wholeDaysBetween(today, parseDateOnly(sprint.end_date))
  if (daysToEnd < 0) {
    const overdue = Math.abs(daysToEnd)
    return overdue === 1 ? 'Ended yesterday' : `Ended ${overdue} days ago`
  }
  if (daysToEnd === 0) return 'Ends today'
  return daysToEnd === 1 ? '1 day left' : `${daysToEnd} days left`
}
