export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'dial-in-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  const root = document.documentElement
  // Swap instantly: without this every control animates its colours separately.
  const freeze = document.createElement('style')
  freeze.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(freeze)
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#17100b' : '#f7f1e8')
  void getComputedStyle(root).color // force a style flush before re-enabling transitions
  freeze.remove()
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  apply(pref)
}

/** Applies the saved preference and keeps "system" in sync with OS changes. */
export function initTheme() {
  apply(getThemePref())
  media.addEventListener('change', () => {
    if (getThemePref() === 'system') apply('system')
  })
}
