const TINTS = ['red', 'amber', 'green', 'blue'] as const

/** Stable per-name tint, so the same person keeps the same colour across screens. */
function tintFor(seed: string): (typeof TINTS)[number] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return TINTS[Math.abs(hash) % TINTS.length]
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2)
  return words[0][0] + words[words.length - 1][0]
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** Show a neutral grey tile instead of a colour-coded one. */
  neutral?: boolean
  /** Override the derived initials, e.g. with a project key. */
  label?: string
}

export function Avatar({ name, size = 'md', neutral = false, label }: AvatarProps) {
  const classes = ['avatar']
  if (size !== 'md') classes.push(`avatar--${size}`)
  if (!neutral) classes.push(`avatar--${tintFor(name)}`)

  return (
    <span className={classes.join(' ')} aria-hidden="true">
      {label ?? initialsOf(name)}
    </span>
  )
}
