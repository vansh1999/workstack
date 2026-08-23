import type { Sprint, SprintStatus } from '../api/sprints'
import { byMostRecent, pickDefaultSprint, validateSprintDates } from './sprints'

function sprint(
  name: string,
  start: string,
  status: SprintStatus = 'PLANNED',
  createdAt = '2026-01-01T00:00:00Z',
): Sprint {
  return {
    id: name,
    project_id: 'p1',
    name,
    goal: null,
    start_date: start,
    end_date: start,
    status,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

describe('pickDefaultSprint', () => {
  // The API returns sprints oldest-first, so the naive first element is the wrong one.
  it('picks the most recent sprint, not the oldest', () => {
    const sprints = [
      sprint('Sprint 1', '2026-01-05'),
      sprint('Sprint 2', '2026-02-05'),
      sprint('Sprint 3', '2026-03-05'),
    ]

    expect(pickDefaultSprint(sprints)?.name).toBe('Sprint 3')
  })

  it('prefers an active sprint over a more recent planned one', () => {
    const sprints = [
      sprint('Sprint 1', '2026-01-05'),
      sprint('Sprint 2', '2026-02-05', 'ACTIVE'),
      sprint('Sprint 3', '2026-03-05'),
    ]

    expect(pickDefaultSprint(sprints)?.name).toBe('Sprint 2')
  })

  it('falls back to the most recent when every sprint is completed', () => {
    const sprints = [
      sprint('Sprint 1', '2026-01-05', 'COMPLETED'),
      sprint('Sprint 2', '2026-02-05', 'COMPLETED'),
    ]

    expect(pickDefaultSprint(sprints)?.name).toBe('Sprint 2')
  })

  it('breaks a shared start date on creation time', () => {
    const sprints = [
      sprint('Older', '2026-02-05', 'PLANNED', '2026-01-01T00:00:00Z'),
      sprint('Newer', '2026-02-05', 'PLANNED', '2026-01-09T00:00:00Z'),
    ]

    expect(pickDefaultSprint(sprints)?.name).toBe('Newer')
  })

  it('returns null when there are no sprints', () => {
    expect(pickDefaultSprint([])).toBeNull()
  })

  it('does not mutate the array it was given', () => {
    const sprints = [sprint('Sprint 1', '2026-01-05'), sprint('Sprint 2', '2026-02-05')]

    pickDefaultSprint(sprints)

    expect(sprints.map((s) => s.name)).toEqual(['Sprint 1', 'Sprint 2'])
  })
})

describe('validateSprintDates', () => {
  // A two-digit year typed into a date input arrives as 0026-09-10 and then sorts two millennia
  // before every other sprint, which is how a September sprint ends up behind a July one.
  it('rejects a two-digit year', () => {
    expect(validateSprintDates('0026-09-10', '0026-10-10')).toMatch(/four-digit year/i)
    expect(validateSprintDates('2026-09-10', '0026-10-10')).toMatch(/four-digit year/i)
  })

  it('rejects an end date before the start date', () => {
    expect(validateSprintDates('2026-09-10', '2026-09-01')).toMatch(/cannot be before/i)
  })

  it('accepts a sane range, including a single-day sprint', () => {
    expect(validateSprintDates('2026-09-10', '2026-10-10')).toBeNull()
    expect(validateSprintDates('2026-09-10', '2026-09-10')).toBeNull()
  })

  it('leaves empty values to the inputs own required check', () => {
    expect(validateSprintDates('', '')).toBeNull()
    expect(validateSprintDates('2026-09-10', '')).toBeNull()
  })
})

describe('byMostRecent', () => {
  it('orders newest first', () => {
    const sprints = [
      sprint('Sprint 1', '2026-01-05'),
      sprint('Sprint 3', '2026-03-05'),
      sprint('Sprint 2', '2026-02-05'),
    ]

    expect([...sprints].sort(byMostRecent).map((s) => s.name)).toEqual([
      'Sprint 3',
      'Sprint 2',
      'Sprint 1',
    ])
  })
})
