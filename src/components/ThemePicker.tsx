import { useState, type ReactNode } from 'react'
import { ChevronDown, RotateCcw, Star } from 'lucide-react'
import { BASE, FONT_LIST, PRESETS, applyCfg, loadCfg, loadMine, saveMine, type Cfg } from '../lib/theme'
import type { FxMode } from '../lib/fx'
import { Section } from './ui'

const FX_LIST: { id: FxMode; label: string }[] = [
  { id: 'none', label: 'Žiadne' }, { id: 'aura', label: 'Aura' }, { id: 'waves', label: 'Vlny' }, { id: 'grid', label: 'Mriežka' },
  { id: 'matrix', label: 'Matrix' }, { id: 'stars', label: 'Hviezdy' }, { id: 'bubbles', label: 'Bubliny' }, { id: 'ps2', label: 'PS2' },
]
const fontOf = (c: Cfg) => FONT_LIST.find((f) => f.id === c.font)?.family ?? FONT_LIST[0].family

/** Vzhľad: predvoľby (PSP, Wii, Terminal…) a jemné doladenie farieb, pozadia, tvaru aj písma. Ukladá sa v prehliadači. */
export function ThemePicker() {
  const [cfg, setCfg] = useState<Cfg>(loadCfg)
  const [mine, setMine] = useState<Cfg | null>(loadMine)
  const [msg, setMsg] = useState('')
  // „Nechať moje písmo“: pri zmene predvoľby sa písmo nemení
  const [keepFont, setKeepFont] = useState(() => { try { return localStorage.getItem('keepFont') === '1' } catch { return false } })
  const toggleKeep = (v: boolean) => { setKeepFont(v); try { localStorage.setItem('keepFont', v ? '1' : '0') } catch { /* ignore */ } }

  const update = (p: Partial<Cfg>) => { const n = { ...cfg, ...p }; setCfg(n); applyCfg(n) }
  const pick = (c: Cfg, theme = true) => {
    const n = theme && keepFont ? { ...c, font: cfg.font, fontScale: cfg.fontScale, glow: cfg.glow } : { ...c }
    setCfg(n); applyCfg(n)
  }
  const preset = PRESETS.find((p) => p.id === cfg.preset)

  const slider = (label: string, key: keyof Cfg, min: number, max: number, unit = '') => (
    <label className="block">
      <span className="flex justify-between text-sm mb-1"><span>{label}</span><span className="muted num">{cfg[key] as number}{unit}</span></span>
      <input type="range" min={min} max={max} value={cfg[key] as number} onChange={(e) => update({ [key]: Number(e.target.value) })} className="w-full h-7" />
    </label>
  )
  const color = (label: string, key: keyof Cfg) => (
    <label className="flex flex-col items-center gap-1.5 text-xs muted">
      <input type="color" value={cfg[key] as string} onChange={(e) => update({ [key]: e.target.value })} className="w-11 h-11 p-0 rounded-full overflow-hidden border line bg-transparent" />
      {label}
    </label>
  )
  const chips = <T extends string>(list: { id: T; label: string }[], value: T, on: (id: T) => void) => (
    <div className="chips">
      {list.map((x) => <button key={x.id} type="button" onClick={() => on(x.id)} aria-pressed={value === x.id} className="chip">{x.label}</button>)}
    </div>
  )

  const tile = (c: Cfg, label: ReactNode, on: boolean, onClick: () => void, key: string) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on} className="text-left">
      <span
        className={'relative block aspect-[4/3] rounded-[var(--ctl-r)] overflow-hidden border ' + (on ? 'ring-2 ring-[var(--color-signal)] ring-offset-2 ring-offset-[var(--bg)]' : 'line')}
        style={{ background: c.bg }}
      >
        <span
          className="absolute inset-x-2 top-2 bottom-2 flex flex-col justify-between p-1.5"
          style={{ background: `color-mix(in srgb, ${c.card} ${c.cardOp}%, transparent)`, border: `${Math.max(1, Math.min(c.border, 2))}px solid ${c.line}`, borderRadius: Math.min(c.radius, 14) * 0.6 }}
        >
          <span className="text-sm font-bold leading-none" style={{ color: c.fg, fontFamily: fontOf(c) }}>Aa</span>
          <span className="block h-1.5 w-2/3 rounded-full" style={{ background: c.accent }} />
        </span>
      </span>
      <span className={'block mt-1.5 text-xs leading-tight truncate ' + (on ? 'font-semibold' : 'muted')}>{label}</span>
    </button>
  )

  return (
    <>
      <Section
        title="Téma"
        sub={`Teraz: ${preset?.label ?? 'vlastná'}`}
        action={<button onClick={() => pick(preset?.cfg ?? BASE, false)} className="btn btn-sm btn-quiet" title="Vrátiť doladenie témy"><RotateCcw aria-hidden />Obnoviť</button>}
      >
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-4">
          {mine && tile(mine, <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" aria-hidden />Moja</span>, false, () => pick(mine, false), 'mine')}
          {PRESETS.map((p) => tile(p.cfg, p.label, cfg.preset === p.id, () => pick(p.cfg), p.id))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5">
          <button onClick={() => { saveMine(cfg); setMine(cfg); setMsg('Uložené ako „Moja“.'); setTimeout(() => setMsg(''), 2000) }} className="btn btn-sm">
            <Star aria-hidden />Uložiť ako „Moja“
          </button>
          <label className="check text-sm">
            <input type="checkbox" checked={keepFont} onChange={(e) => toggleKeep(e.target.checked)} />
            Nechať moje písmo pri zmene témy
          </label>
          {msg && <span className="text-sm muted">{msg}</span>}
        </div>
      </Section>

      <div className="card list">
        <Group title="Farby">
          {slider('Odtieň (celá appka)', 'hue', -180, 180, '°')}
          {slider('Sýtosť farieb', 'sat', 0, 200, ' %')}
          {slider('Jas pozadí', 'bright', -30, 30)}
          {slider('Kontrast písma', 'contrast', -40, 40)}
          <div className="flex justify-between pt-1">{color('Pozadie', 'bg')}{color('Karty', 'card')}{color('Text', 'fg')}{color('Čiary', 'line')}{color('Akcent', 'accent')}</div>
        </Group>
        <Group title="Pozadie a animácia">
          {chips(FX_LIST, cfg.fx, (id) => update({ fx: id }))}
          {cfg.fx !== 'none' && (
            <>
              {slider('Rýchlosť (0 = stojí)', 'fxSpeed', 0, 300, ' %')}
              {slider('Sila / viditeľnosť', 'fxInt', 0, 100, ' %')}
              {cfg.fx === 'aura' && slider('Rozmazanie aury', 'fxBlur', 0, 150, ' px')}
              <div className="flex justify-around pt-1">{color('Farba 1', 'fx1')}{color('Farba 2', 'fx2')}{color('Farba 3', 'fx3')}</div>
            </>
          )}
        </Group>
        <Group title="Karty a tvar">
          {slider('Priehľadnosť kariet (100 = plné)', 'cardOp', 20, 100, ' %')}
          {slider('Rozmazanie za kartou (sklo)', 'blur', 0, 30, ' px')}
          {slider('Zaoblenie rohov', 'radius', 0, 30, ' px')}
          {slider('Hrúbka orámovania', 'border', 0, 4, ' px')}
          {slider('Žiara okolo kariet', 'shadow', 0, 40, ' px')}
        </Group>
        <Group title="Písmo">
          <div className="chips">
            {FONT_LIST.map((f) => (
              <button key={f.id} type="button" onClick={() => update({ font: f.id })} style={{ fontFamily: f.family }} aria-pressed={cfg.font === f.id} className="chip">{f.label}</button>
            ))}
          </div>
          {slider('Veľkosť písma', 'fontScale', 85, 130, ' %')}
          {slider('Žiara textu', 'glow', 0, 14, ' px')}
        </Group>
        <Group title="CRT efekty">
          {slider('Riadky ako na starej obrazovke', 'scan', 0, 100, ' %')}
          {slider('Tmavé okraje', 'vignette', 0, 100, ' %')}
        </Group>
      </div>
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex items-center justify-between px-4 h-14 font-medium select-none">
        {title}
        <ChevronDown className="w-5 h-5 muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-5 grid gap-4">{children}</div>
    </details>
  )
}
