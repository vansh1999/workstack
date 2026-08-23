import { useRef } from 'react'
import type { ThemePref } from '../hooks/useTheme'
import { IconMonitor, IconMoon, IconSun } from './icons'

const OPTIONS: { value: ThemePref; label: string; Icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'system', label: 'System', Icon: IconMonitor },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
]

interface ThemeToggleProps {
  value: ThemePref
  onChange: (value: ThemePref) => void
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  function onKeyDown(event: React.KeyboardEvent) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return

    event.preventDefault()
    const index = OPTIONS.findIndex((option) => option.value === value)
    const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length]
    onChange(next.value)
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [OPTIONS.indexOf(next)]?.focus()
  }

  return (
    <div
      ref={groupRef}
      className="segmented"
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
    >
      {OPTIONS.map(({ value: optionValue, label, Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          // Roving tabindex: only the selected option is a tab stop.
          tabIndex={value === optionValue ? 0 : -1}
          className="segmented__option"
          onClick={() => onChange(optionValue)}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}
