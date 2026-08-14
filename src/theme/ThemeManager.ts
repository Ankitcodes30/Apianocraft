export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'apianocraft-theme'
const OLD_KEY = 'apiano_theme_preference'

export class ThemeManager {
  private preference: ThemeMode = 'system'
  private mediaQuery: MediaQueryList | null = null
  private listeners = new Set<(theme: 'light' | 'dark', mode: ThemeMode) => void>()

  constructor() {
    this.init()
  }

  private init(): void {
    if (typeof window === 'undefined') return

    // Migrate from old localStorage key if present
    let saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (!saved) {
      const oldVal = localStorage.getItem(OLD_KEY) as ThemeMode | null
      if (oldVal === 'light' || oldVal === 'dark' || oldVal === 'system') {
        saved = oldVal
        try {
          localStorage.setItem(STORAGE_KEY, oldVal)
          localStorage.removeItem(OLD_KEY)
        } catch { /* ignore */ }
      }
    }

    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.preference = saved
    } else {
      this.preference = 'system'
    }

    if (window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        if (this.preference === 'system') {
          this.apply()
        }
      }
      if (this.mediaQuery.addEventListener) {
        this.mediaQuery.addEventListener('change', onChange)
      } else {
        // Fallback for older browsers
        this.mediaQuery.addListener(onChange)
      }
    }
    this.apply()
  }

  getPreference(): ThemeMode {
    return this.preference
  }

  getEffectiveTheme(): 'light' | 'dark' {
    if (this.preference === 'light') return 'light'
    if (this.preference === 'dark') return 'dark'
    return this.mediaQuery?.matches ? 'dark' : 'light'
  }

  setPreference(mode: ThemeMode): void {
    this.preference = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore localStorage quota/disabled errors */
    }
    this.apply()
  }

  subscribe(listener: (theme: 'light' | 'dark', mode: ThemeMode) => void): () => void {
    this.listeners.add(listener)
    listener(this.getEffectiveTheme(), this.preference)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private apply(): void {
    const effective = this.getEffectiveTheme()
    const el = document.documentElement

    // Toggle .dark class for Tailwind's dark: variant
    el.classList.toggle('dark', effective === 'dark')
    // Keep data-theme for existing CSS compatibility
    el.setAttribute('data-theme', effective)
    el.setAttribute('data-theme-mode', this.preference)

    // Remove no-transitions class if still present (set by index.html blocking script)
    el.classList.remove('no-transitions')

    for (const l of this.listeners) {
      l(effective, this.preference)
    }
  }
}

let themeManagerSingleton: ThemeManager | null = null

export function getThemeManager(): ThemeManager {
  if (!themeManagerSingleton) {
    themeManagerSingleton = new ThemeManager()
  }
  return themeManagerSingleton
}

