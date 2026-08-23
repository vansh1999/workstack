import type { Sprint } from '../api/sprints'

/**
 * Newest first, by start date. Both fields are ISO strings, so lexical order is chronological.
 *
 * The API returns sprints oldest-first (ordered by created_at), which is the wrong end for a
 * picker — the sprint you want is nearly always the current one.
 */
export function byMostRecent(a: Sprint, b: Sprint): number {
  return b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at)
}

/** The sprint a board should open on: the active one if there is one, otherwise the most recent. */
export function pickDefaultSprint(sprints: Sprint[]): Sprint | null {
  const ordered = [...sprints].sort(byMostRecent)
  return ordered.find((sprint) => sprint.status === 'ACTIVE') ?? ordered[0] ?? null
}

/**
 * Earliest date a sprint may start.
 *
 * `<input type="date">` happily yields a two-digit year as `0026-09-10`, which the API stores and
 * which then sorts two millennia before everything else — a mistyped year is otherwise invisible
 * until a sprint mysteriously refuses to come first.
 */
export const MIN_SPRINT_DATE = '2000-01-01'

/** Validates a start/end pair. Returns the problem, or null when the pair is usable. */
export function validateSprintDates(startDate: string, endDate: string): string | null {
  // Empty values are already blocked by the inputs' required attribute.
  if (!startDate || !endDate) return null

  if (startDate < MIN_SPRINT_DATE || endDate < MIN_SPRINT_DATE) {
    return 'Enter a four-digit year — dates before 2000 are almost always a typo.'
  }
  if (endDate < startDate) {
    return 'The end date cannot be before the start date.'
  }
  return null
}
