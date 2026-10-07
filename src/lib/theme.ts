// Farebné témy. Každá nastaví farby povrchov; niektoré majú animovanú auru na pozadí.
export type ThemeId =
  | 'light' | 'sand' | 'mint' | 'sunrise'
  | 'dark' | 'black' | 'graphite' | 'amber' | 'fire' | 'ocean' | 'forest' | 'purple' | 'neon' | 'redbull'

export type Theme = ThemeId

type Def = {
  id: ThemeId
  label: string
  dark: boolean
  bg: string; fg: string; card: string; line: string; muted: string
  aura?: [string, string, string]
}

export const THEMES: Def[] = [
  { id: 'light', label: 'Svetlá', dark: false, bg: '#f4f1ea', fg: '#0f1b2d', card: '#fffdf8', line: '#ddd6c8', muted: '#6b6558' },
  { id: 'sand', label: 'Piesok', dark: false, bg: '#efe3cc', fg: '#2b2112', card: '#fbf3e2', line: '#d6c39c', muted: '#7a6a48' },
  { id: 'mint', label: 'Mäta', dark: false, bg: '#e6f4ee', fg: '#0c2a20', card: '#f6fcf9', line: '#bcded0', muted: '#52786a', aura: ['#34d399', '#67e8f9', '#a7f3d0'] },
  { id: 'sunrise', label: 'Svit', dark: false, bg: '#fff1e6', fg: '#3b1d0b', card: '#fffaf5', line: '#f0cbae', muted: '#9b6b4c', aura: ['#fb923c', '#f472b6', '#fcd34d'] },
  { id: 'dark', label: 'Tmavá', dark: true, bg: '#0b1320', fg: '#ece7dc', card: '#121d2e', line: '#24324a', muted: '#8f99aa' },
  { id: 'black', label: 'Čierna', dark: true, bg: '#000000', fg: '#f2f2f2', card: '#0d0d0f', line: '#26262b', muted: '#8a8a93' },
  { id: 'graphite', label: 'Grafit', dark: true, bg: '#17181a', fg: '#eceef0', card: '#202225', line: '#34373c', muted: '#9aa0a8' },
  { id: 'amber', label: 'Amber', dark: true, bg: '#1a1206', fg: '#fdeccb', card: '#271a08', line: '#4a3413', muted: '#c2a36a', aura: ['#f59e0b', '#b45309', '#fcd34d'] },
  { id: 'fire', label: 'Oheň', dark: true, bg: '#160708', fg: '#ffe9e0', card: '#230c0c', line: '#4a1d17', muted: '#d09080', aura: ['#ef4444', '#f97316', '#fbbf24'] },
  { id: 'ocean', label: 'Oceán', dark: true, bg: '#06151f', fg: '#dff3ff', card: '#0b2332', line: '#17445c', muted: '#7fb2cc', aura: ['#0ea5e9', '#14b8a6', '#2563eb'] },
  { id: 'forest', label: 'Les', dark: true, bg: '#08140d', fg: '#e3f5e6', card: '#0e2315', line: '#1d4a2c', muted: '#85b592', aura: ['#22c55e', '#166534', '#84cc16'] },
  { id: 'purple', label: 'Fialová noc', dark: true, bg: '#100820', fg: '#f0e8ff', card: '#1a0f33', line: '#3a2468', muted: '#a58fd1', aura: ['#a855f7', '#6366f1', '#ec4899'] },
  { id: 'neon', label: 'Neón', dark: true, bg: '#05050a', fg: '#f4f4ff', card: '#0c0c18', line: '#2b2b55', muted: '#9a9ad0', aura: ['#ff2bd6', '#00e5ff', '#7c4dff'] },
  { id: 'redbull', label: 'Red Bull', dark: true, bg: '#0a1633', fg: '#f5f7ff', card: '#101f45', line: '#263a73', muted: '#93a3d4', aura: ['#ffc800', '#d7263d', '#2f6fdd'] },
]

const ids = new Set<string>(THEMES.map((t) => t.id))

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    if (t && ids.has(t)) return t as Theme
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getAura(): boolean {
  try { return localStorage.getItem('aura') !== 'off' } catch { return true }
}

export function applyTheme(t: Theme, aura: boolean = getAura()) {
  const d = THEMES.find((x) => x.id === t) ?? THEMES[0]
  const root = document.documentElement
  root.dataset.theme = d.id
  root.dataset.dark = String(d.dark)
  root.dataset.aura = d.aura && aura ? 'on' : 'off'
  const s = root.style
  s.setProperty('--bg', d.bg); s.setProperty('--fg', d.fg); s.setProperty('--card', d.card)
  s.setProperty('--line', d.line); s.setProperty('--muted', d.muted)
  if (d.aura) {
    s.setProperty('--aura1', d.aura[0]); s.setProperty('--aura2', d.aura[1]); s.setProperty('--aura3', d.aura[2])
  }
  s.setProperty('--aura-op', d.dark ? '0.5' : '0.35')
  root.style.colorScheme = d.dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d.bg)
  if (!document.getElementById('aura')) {
    const a = document.createElement('div')
    a.id = 'aura'
    a.setAttribute('aria-hidden', 'true')
    a.innerHTML = '<i></i>'
    document.body.prepend(a)
  }
  try { localStorage.setItem('theme', d.id); localStorage.setItem('aura', aura ? 'on' : 'off') } catch { /* ignore */ }
}
