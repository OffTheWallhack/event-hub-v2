// Vzhľad appky: presne dve témy – svetlá a tmavá. Všetky farby, písma a rozmery sú v src/styles.css,
// tu sa len volí, ktorá téma je zapnutá. Výber sa ukladá v prehliadači (localStorage).
export type Mode = 'light' | 'dark'

const KEY = 'theme'
// Farby panela prehliadača (iPhone) – musia sedieť s --bg v styles.css
const BAR: Record<Mode, string> = { light: '#f5f3ee', dark: '#0d1117' }

const systemMode = (): Mode => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function loadMode(): Mode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return systemMode()
}

export function applyMode(m: Mode) {
  const root = document.documentElement
  root.dataset.theme = m
  root.dataset.dark = String(m === 'dark')
  root.style.colorScheme = m
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[m])
  try { localStorage.setItem(KEY, m) } catch { /* ignore */ }
}

/** Zmaže nastavenia zo starého vzhľadu (30 tém, posuvníky, písma). */
export function cleanOldSettings() {
  try { for (const k of ['themeCfg', 'themeMine', 'keepFont']) localStorage.removeItem(k) } catch { /* ignore */ }
}
