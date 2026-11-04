export type ThemePreference = 'light' | 'dark' | 'system'
const KEY = 'fairteam.theme'

export function storedTheme(): ThemePreference {
  try { const value = localStorage.getItem(KEY); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

/** Applies the theme to <html> and keeps the browser chrome colour in sync. */
export function applyTheme(preference: ThemePreference = storedTheme()) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const theme = resolveTheme(preference, Boolean(media?.matches))
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1416' : '#f3f4f0')
  return theme
}

export function saveTheme(preference: ThemePreference) {
  try { if (preference === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, preference) } catch { /* private mode */ }
  applyTheme(preference)
}

/** Follow the operating system when the teacher chose "system". */
export function watchSystemTheme() {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onChange = () => { if (storedTheme() === 'system') applyTheme('system') }
  media?.addEventListener?.('change', onChange)
  return () => media?.removeEventListener?.('change', onChange)
}
