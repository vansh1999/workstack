interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
}

export function Skeleton({ width = '100%', height = '12px', radius }: SkeletonProps) {
  return (
    <span
      className="skeleton"
      style={{ display: 'block', width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/** Placeholder cards for a grid that is still loading. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="project-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card">
          <Skeleton width="45%" height="14px" />
          <Skeleton width="85%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  )
}

/** Placeholder rows for a hairline list that is still loading. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="row-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="row-list__item">
          <div className="row-list__main" style={{ flex: 1 }}>
            <Skeleton width="28px" height="28px" radius="var(--radius-md)" />
            <Skeleton width="180px" />
          </div>
          <Skeleton width="64px" height="18px" radius="var(--radius-full)" />
        </div>
      ))}
    </div>
  )
}
