import { act, renderHook } from '@testing-library/react'
import { THEME_STORAGE_KEY, useTheme } from './useTheme'

// A memory-backed Storage, so these assertions do not depend on what the test environment's own
// localStorage implementation happens to support.
const store = new Map<string, string>()

const memoryStorage: Storage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, String(value))
  },
  removeItem: (key) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  },
}

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  })
})

beforeEach(() => {
  store.clear()
  delete document.documentElement.dataset.theme
})

describe('useTheme', () => {
  it('defaults to system and leaves the OS preference in charge', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    // No data-theme means the prefers-color-scheme block in tokens.css applies.
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('stamps and persists an explicit choice', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setPreference('dark'))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('restores a persisted choice on the next mount', () => {
    store.set(THEME_STORAGE_KEY, 'light')

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('clears the stamp when going back to system', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setPreference('dark'))
    act(() => result.current.setPreference('system'))

    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('ignores a junk stored value rather than stamping it', () => {
    store.set(THEME_STORAGE_KEY, 'chartreuse')

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('cycles system → light → dark → system for the collapsed rail', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.cycle())
    expect(result.current.preference).toBe('light')

    act(() => result.current.cycle())
    expect(result.current.preference).toBe('dark')

    act(() => result.current.cycle())
    expect(result.current.preference).toBe('system')
  })

  it('survives a localStorage that throws', () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('site data blocked')
      },
      configurable: true,
    })

    try {
      const { result } = renderHook(() => useTheme())
      expect(result.current.preference).toBe('system')

      act(() => result.current.setPreference('dark'))
      expect(result.current.preference).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    } finally {
      Object.defineProperty(window, 'localStorage', {
        value: memoryStorage,
        configurable: true,
      })
    }
  })
})
