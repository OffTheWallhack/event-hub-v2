// Vzhľad appky: predvoľby (PSP, Wii, Terminal…) + posuvníky na všetko. Ukladá sa v prehliadači (localStorage).
import { setFx, type FxMode } from './fx'

export type FontId = 'default' | 'system' | 'rounded' | 'mono' | 'terminal' | 'serif'

export type Cfg = {
  preset: string
  // základné farby
  bg: string; fg: string; card: string; line: string; muted: string; accent: string
  // úpravy farieb
  hue: number; sat: number; bright: number; contrast: number
  // karty a tvar
  cardOp: number; blur: number; radius: number; border: number; shadow: number
  // písmo
  font: FontId; fontScale: number; glow: number
  // pozadie / animácia
  fx: FxMode; fx1: string; fx2: string; fx3: string; fxSpeed: number; fxInt: number; fxBlur: number
  // CRT
  scan: number; vignette: number
}

export const BASE: Cfg = {
  preset: 'light',
  bg: '#f4f1ea', fg: '#0f1b2d', card: '#fffdf8', line: '#ddd6c8', muted: '#6b6558', accent: '#d7263d',
  hue: 0, sat: 100, bright: 0, contrast: 0,
  cardOp: 100, blur: 0, radius: 16, border: 1, shadow: 0,
  font: 'default', fontScale: 100, glow: 0,
  fx: 'none', fx1: '#34d399', fx2: '#67e8f9', fx3: '#a7f3d0', fxSpeed: 100, fxInt: 50, fxBlur: 70,
  scan: 0, vignette: 0,
}

export type Preset = { id: string; label: string; cfg: Cfg }
const P = (id: string, label: string, c: Partial<Cfg>): Preset => ({ id, label, cfg: { ...BASE, ...c, preset: id } })
const aura = (a: string, b: string, c: string, int = 50): Partial<Cfg> => ({ fx: 'aura', fx1: a, fx2: b, fx3: c, fxInt: int })

export const PRESETS: Preset[] = [
  P('psp', 'PSP', {
    bg: '#071252', fg: '#f4f7ff', card: '#2a3a9c', line: '#8ea2ff', muted: '#b4c0ff', accent: '#5b8cff',
    cardOp: 38, blur: 14, radius: 8, border: 1, shadow: 10, font: 'system',
    fx: 'waves', fx1: '#5b8cff', fx2: '#a06bff', fx3: '#3be3ff', fxSpeed: 90, fxInt: 80,
  }),
  P('wii', 'Wii', {
    bg: '#e8edf1', fg: '#52606b', card: '#ffffff', line: '#cfd9e0', muted: '#8996a1', accent: '#29a8e8',
    cardOp: 92, blur: 6, radius: 26, border: 2, shadow: 10, font: 'rounded',
    fx: 'bubbles', fx1: '#7ccbf2', fx2: '#b9e3f7', fx3: '#9ad8ee', fxSpeed: 60, fxInt: 45,
  }),
  P('terminal', 'Terminal', {
    bg: '#010a03', fg: '#35ff6b', card: '#03150a', line: '#12803a', muted: '#1fa64c', accent: '#1ed75a',
    cardOp: 82, blur: 0, radius: 0, border: 1, shadow: 8, glow: 5, font: 'terminal', fontScale: 112,
    fx: 'matrix', fx1: '#b6ffc8', fx2: '#10b84a', fx3: '#10b84a', fxSpeed: 70, fxInt: 30, scan: 45, vignette: 55,
  }),
  P('amberterm', 'Amber CRT', {
    bg: '#0d0700', fg: '#ffb52e', card: '#190d00', line: '#8a5a10', muted: '#c98a1f', accent: '#ffa21a',
    cardOp: 85, radius: 0, border: 1, shadow: 8, glow: 5, font: 'terminal', fontScale: 112, scan: 50, vignette: 60,
  }),
  P('gameboy', 'Game Boy', {
    bg: '#9bbc0f', fg: '#0f380f', card: '#8bac0f', line: '#306230', muted: '#306230', accent: '#0f380f',
    radius: 4, border: 2, font: 'terminal', fontScale: 112, scan: 18,
  }),
  P('synthwave', 'Synthwave', {
    bg: '#12062b', fg: '#ffeafe', card: '#241047', line: '#7a3cff', muted: '#c79bff', accent: '#ff3ec9',
    cardOp: 60, blur: 8, radius: 10, border: 1, shadow: 14, glow: 2,
    fx: 'grid', fx1: '#ffe14a', fx2: '#ff2e93', fx3: '#7a3cff', fxSpeed: 80, fxInt: 80,
  }),
  P('space', 'Vesmír', {
    bg: '#02030c', fg: '#e8ecff', card: '#0b1030', line: '#27337a', muted: '#8d9ad6', accent: '#7c8cff',
    cardOp: 60, blur: 8, radius: 14, fx: 'stars', fx1: '#ffffff', fx2: '#9fb4ff', fx3: '#ffd9a0', fxSpeed: 70, fxInt: 70,
  }),
  P('light', 'Svetlá', {}),
  P('sand', 'Piesok', { bg: '#efe3cc', fg: '#2b2112', card: '#fbf3e2', line: '#d6c39c', muted: '#7a6a48' }),
  P('mint', 'Mäta', { bg: '#e6f4ee', fg: '#0c2a20', card: '#f6fcf9', line: '#bcded0', muted: '#52786a', ...aura('#34d399', '#67e8f9', '#a7f3d0', 35) }),
  P('dark', 'Tmavá', { bg: '#0b1320', fg: '#ece7dc', card: '#121d2e', line: '#24324a', muted: '#8f99aa' }),
  P('black', 'Čierna', { bg: '#000000', fg: '#f2f2f2', card: '#0d0d0f', line: '#26262b', muted: '#8a8a93' }),
  P('amber', 'Amber', { bg: '#1a1206', fg: '#fdeccb', card: '#271a08', line: '#4a3413', muted: '#c2a36a', accent: '#f59e0b', ...aura('#f59e0b', '#b45309', '#fcd34d') }),
  P('fire', 'Oheň', { bg: '#160708', fg: '#ffe9e0', card: '#230c0c', line: '#4a1d17', muted: '#d09080', ...aura('#ef4444', '#f97316', '#fbbf24') }),
  P('ocean', 'Oceán', { bg: '#06151f', fg: '#dff3ff', card: '#0b2332', line: '#17445c', muted: '#7fb2cc', accent: '#0ea5e9', ...aura('#0ea5e9', '#14b8a6', '#2563eb') }),
  P('forest', 'Les', { bg: '#08140d', fg: '#e3f5e6', card: '#0e2315', line: '#1d4a2c', muted: '#85b592', accent: '#22c55e', ...aura('#22c55e', '#166534', '#84cc16') }),
  P('purple', 'Fialová noc', { bg: '#100820', fg: '#f0e8ff', card: '#1a0f33', line: '#3a2468', muted: '#a58fd1', accent: '#a855f7', ...aura('#a855f7', '#6366f1', '#ec4899') }),
  P('neon', 'Neón', { bg: '#05050a', fg: '#f4f4ff', card: '#0c0c18', line: '#2b2b55', muted: '#9a9ad0', accent: '#ff2bd6', ...aura('#ff2bd6', '#00e5ff', '#7c4dff') }),
  P('redbull', 'Red Bull', { bg: '#0a1633', fg: '#f5f7ff', card: '#101f45', line: '#263a73', muted: '#93a3d4', ...aura('#ffc800', '#d7263d', '#2f6fdd') }),
]

const FONTS: Record<FontId, { label: string; body: string; display: string }> = {
  default: { label: 'Barlow', body: '"Barlow", system-ui, sans-serif', display: '"Barlow Condensed", "Barlow", system-ui, sans-serif' },
  system: { label: 'Systém', body: '-apple-system, system-ui, "Helvetica Neue", Arial, sans-serif', display: '-apple-system, system-ui, "Helvetica Neue", Arial, sans-serif' },
  rounded: { label: 'Okrúhle', body: '"Nunito", ui-rounded, system-ui, sans-serif', display: '"Nunito", ui-rounded, system-ui, sans-serif' },
  mono: { label: 'Mono', body: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', display: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  terminal: { label: 'Terminál', body: '"VT323", ui-monospace, Menlo, monospace', display: '"VT323", ui-monospace, Menlo, monospace' },
  serif: { label: 'Serif', body: 'ui-serif, Georgia, "Times New Roman", serif', display: 'ui-serif, Georgia, "Times New Roman", serif' },
}
export const FONT_LIST = (Object.keys(FONTS) as FontId[]).map((id) => ({ id, label: FONTS[id].label }))

// ---- farby ----
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** kind: 'surface' = pozadia (jas), 'text' = písmo (kontrast), 'color' = len odtieň a sýtosť */
function tweak(hex: string, c: Cfg, kind: 'surface' | 'text' | 'color', dark: boolean): string {
  const [h, s, l] = hexToHsl(hex)
  let L = l
  if (kind === 'surface') L = clamp(l + c.bright / 100, 0, 1)
  if (kind === 'text') L = clamp(l + (dark ? 1 : -1) * (c.contrast / 100), 0, 1)
  return hslToHex(h + c.hue, clamp(s * (c.sat / 100), 0, 1), L)
}
const lum = (hex: string) => hexToHsl(hex)[2]

// ---- ukladanie ----
const KEY = 'themeCfg'
const MINE = 'themeMine'

function sanitize(raw: unknown): Cfg {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Cfg>
  return { ...BASE, ...o }
}

export function loadCfg(): Cfg {
  try {
    const j = localStorage.getItem(KEY)
    if (j) return sanitize(JSON.parse(j))
    // staré nastavenie: len id témy
    const old = localStorage.getItem('theme')
    const p = PRESETS.find((x) => x.id === old)
    if (p) return { ...p.cfg }
  } catch { /* ignore */ }
  return { ...(PRESETS.find((x) => x.id === (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))!.cfg) }
}
export function loadMine(): Cfg | null {
  try { const j = localStorage.getItem(MINE); return j ? sanitize(JSON.parse(j)) : null } catch { return null }
}
export function saveMine(c: Cfg) { try { localStorage.setItem(MINE, JSON.stringify(c)) } catch { /* ignore */ } }

function layers() {
  if (!document.getElementById('aura')) {
    const a = document.createElement('div')
    a.id = 'aura'; a.setAttribute('aria-hidden', 'true'); a.innerHTML = '<i></i>'
    document.body.prepend(a)
  }
  if (!document.getElementById('crt')) {
    const c = document.createElement('div')
    c.id = 'crt'; c.setAttribute('aria-hidden', 'true')
    document.body.append(c)
  }
}

export function applyCfg(c: Cfg) {
  layers()
  const bg = tweak(c.bg, c, 'surface', false)
  const dark = lum(bg) < 0.5
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  const font = FONTS[c.font] ?? FONTS.default

  root.dataset.theme = c.preset
  root.dataset.dark = String(dark)
  root.dataset.aura = c.fx === 'aura' ? 'on' : 'off'
  root.style.colorScheme = dark ? 'dark' : 'light'
  root.style.fontSize = `${c.fontScale}%`

  const accent = tweak(c.accent, c, 'color', dark)
  root.dataset.onaccent = lum(accent) > 0.58 ? 'dark' : 'light'
  set('--bg', bg)
  set('--card', tweak(c.card, c, 'surface', dark))
  set('--line', tweak(c.line, c, 'surface', dark))
  set('--fg', tweak(c.fg, c, 'text', dark))
  set('--muted', tweak(c.muted, c, 'text', dark))
  set('--color-signal', accent)
  set('--on-accent', lum(accent) > 0.58 ? '#000' : '#fff')
  set('--font-sans', font.body)
  set('--font-display', font.display)

  set('--card-op', `${c.cardOp}%`)
  set('--card-blur', `${c.blur}px`)
  set('--bw', `${c.border}px`)
  set('--r', `${c.radius}px`)
  const r = c.radius
  set('--radius-xs', `${r * 0.15}px`); set('--radius-sm', `${r * 0.3}px`); set('--radius-md', `${r * 0.45}px`)
  set('--radius-lg', `${r * 0.6}px`); set('--radius-xl', `${r * 0.8}px`); set('--radius-2xl', `${r}px`)
  set('--radius-3xl', `${r * 1.3}px`); set('--radius-4xl', `${r * 1.6}px`)
  set('--card-shadow', c.shadow > 0 ? `0 0 ${c.shadow}px color-mix(in srgb, ${accent} 45%, transparent)` : 'none')
  set('--glow-shadow', c.glow > 0 ? `0 0 ${c.glow}px color-mix(in srgb, currentColor 65%, transparent)` : 'none')

  const fx1 = tweak(c.fx1, c, 'color', dark), fx2 = tweak(c.fx2, c, 'color', dark), fx3 = tweak(c.fx3, c, 'color', dark)
  set('--aura1', fx1); set('--aura2', fx2); set('--aura3', fx3)
  set('--aura-op', String(c.fxInt / 100))
  set('--aura-blur', `${c.fxBlur}px`)
  set('--fx-speed', c.fxSpeed > 0 ? String(c.fxSpeed / 100) : '0')
  set('--scan-a', String((c.scan / 100) * 0.5))
  set('--vig-a', String((c.vignette / 100) * 0.85))
  root.dataset.crt = c.scan > 0 || c.vignette > 0 ? 'on' : 'off'

  setFx({ mode: c.fx, colors: [fx1, fx2, fx3], speed: c.fxSpeed / 100, int: c.fxInt / 100 })
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* ignore */ }
}
