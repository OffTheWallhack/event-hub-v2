import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BASE, FONT_LIST, PRESETS, applyCfg, loadCfg, loadMine, saveMine, type Cfg } from '../lib/theme'
import type { FxMode } from '../lib/fx'

const FX_LIST: { id: FxMode; label: string }[] = [
  { id: 'none', label: 'Žiadne' }, { id: 'aura', label: 'Aura' }, { id: 'waves', label: 'Vlny' }, { id: 'grid', label: 'Mriežka' },
  { id: 'matrix', label: 'Matrix' }, { id: 'stars', label: 'Hviezdy' }, { id: 'bubbles', label: 'Bubliny' },
]

/** Tlačidlo 🎨 v hlavičke: predvoľby (PSP, Wii, Terminal…) a posuvníky na farby, animáciu, tvar aj písmo. */
export function ThemePicker() {
  const [open, setOpen] = useState(false)
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
    <label className="block mb-2">
      <span className="flex justify-between text-xs"><span>{label}</span><span className="muted tabular-nums">{cfg[key] as number}{unit}</span></span>
      <input type="range" min={min} max={max} value={cfg[key] as number} onChange={(e) => update({ [key]: Number(e.target.value) })} className="w-full h-7" style={{ accentColor: 'var(--color-signal)' }} />
    </label>
  )
  const color = (label: string, key: keyof Cfg) => (
    <label className="flex flex-col items-center gap-1 text-[11px]">
      <input type="color" value={cfg[key] as string} onChange={(e) => update({ [key]: e.target.value })} className="w-12 h-9 p-0 border-0 bg-transparent" />
      {label}
    </label>
  )
  const chips = <T extends string>(list: { id: T; label: string }[], value: T, on: (id: T) => void) => (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {list.map((x) => (
        <button key={x.id} onClick={() => on(x.id)} className={'h-8 px-3 rounded-lg border line text-xs font-semibold ' + (value === x.id ? 'bg-[var(--color-signal)] text-[var(--on-accent,#fff)] border-transparent' : '')}>{x.label}</button>
      ))}
    </div>
  )

  return (
    <>
      <button onClick={() => setOpen(!open)} className="card p-4 mt-4 w-full text-left flex items-center gap-3" aria-label="Farebná téma">
        <span className="text-2xl">🎨</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Vzhľad a témy</span>
          <span className="block muted text-xs">Predvoľby (PSP, Wii, Terminal…), farby, animácie, písmo. Teraz: {preset?.label ?? 'vlastné'}</span>
        </span>
        <span className="muted">›</span>
      </button>
      {open && createPortal(
        <div className="fixed z-50 inset-x-0 bottom-0 max-h-[52vh] overflow-y-auto rounded-t-2xl border-t line p-3 pb-6 shadow-2xl" style={{ background: 'color-mix(in srgb, var(--bg) 94%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
          <div className="flex items-center gap-2 mb-2 sticky top-0 -mt-1 pt-1 pb-1" style={{ background: 'inherit' }}>
            <h2 className="display text-xl font-bold flex-1">Vzhľad{preset ? ` · ${preset.label}` : ''}</h2>
            <button onClick={() => pick(preset?.cfg ?? BASE, false)} className="h-8 px-3 rounded-lg border line text-xs">Obnoviť</button>
            <button onClick={() => setOpen(false)} className="h-8 px-3 rounded-lg bg-[var(--color-signal)] text-[var(--on-accent,#fff)] text-xs font-semibold">Hotovo</button>
          </div>

          <Sec title="Predvoľby" open>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => pick(p.cfg)} className={'rounded-lg border-2 p-1 text-left ' + (cfg.preset === p.id ? 'border-[var(--color-signal)]' : 'border-transparent')} style={{ background: p.cfg.bg }}>
                  <span className="flex h-5 rounded overflow-hidden mb-1 border" style={{ borderColor: p.cfg.line }}>
                    <span className="flex-1" style={{ background: p.cfg.card }} />
                    <span className="w-2" style={{ background: p.cfg.accent }} />
                  </span>
                  <span className="block text-[10px] font-semibold leading-tight truncate" style={{ color: p.cfg.fg }}>{p.label}</span>
                </button>
              ))}
              {mine && (
                <button onClick={() => pick(mine, false)} className="rounded-lg border-2 border-dashed line p-1 text-left">
                  <span className="block h-5 mb-1 rounded" style={{ background: `linear-gradient(90deg, ${mine.bg}, ${mine.card} 60%, ${mine.accent})` }} />
                  <span className="block text-[10px] font-semibold">⭐ Moja</span>
                </button>
              )}
            </div>
            <button onClick={() => { saveMine(cfg); setMine(cfg); setMsg('Uložené ako „Moja“.'); setTimeout(() => setMsg(''), 2000) }} className="mt-2 h-8 px-3 rounded-lg border line text-xs">⭐ Uložiť toto nastavenie ako „Moja“</button>
            {msg && <span className="text-xs ml-2">{msg}</span>}
          </Sec>

          <Sec title="Farby">
            {slider('Odtieň (celá appka)', 'hue', -180, 180, '°')}
            {slider('Sýtosť farieb', 'sat', 0, 200, ' %')}
            {slider('Jas pozadí', 'bright', -30, 30)}
            {slider('Kontrast písma', 'contrast', -40, 40)}
            <div className="flex justify-around mt-1">{color('Pozadie', 'bg')}{color('Karty', 'card')}{color('Text', 'fg')}{color('Čiary', 'line')}{color('Akcent', 'accent')}</div>
          </Sec>

          <Sec title="Pozadie a animácia">
            {chips(FX_LIST, cfg.fx, (id) => update({ fx: id }))}
            {cfg.fx !== 'none' && (
              <>
                {slider('Rýchlosť (0 = stojí)', 'fxSpeed', 0, 300, ' %')}
                {slider('Sila / viditeľnosť', 'fxInt', 0, 100, ' %')}
                {cfg.fx === 'aura' && slider('Rozmazanie aury', 'fxBlur', 0, 150, ' px')}
                <div className="flex justify-around mt-1">{color('Farba 1', 'fx1')}{color('Farba 2', 'fx2')}{color('Farba 3', 'fx3')}</div>
              </>
            )}
          </Sec>

          <Sec title="Karty a tvar">
            {slider('Priehľadnosť kariet (100 = plné)', 'cardOp', 20, 100, ' %')}
            {slider('Rozmazanie za kartou (sklo)', 'blur', 0, 30, ' px')}
            {slider('Zaoblenie rohov', 'radius', 0, 30, ' px')}
            {slider('Hrúbka orámovania', 'border', 0, 4, ' px')}
            {slider('Žiara okolo kariet', 'shadow', 0, 40, ' px')}
          </Sec>

          <Sec title="Písmo">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FONT_LIST.map((f) => (
                <button key={f.id} onClick={() => update({ font: f.id })} style={{ fontFamily: f.family }} className={'h-9 px-3 rounded-lg border line text-sm ' + (cfg.font === f.id ? 'bg-[var(--color-signal)] text-[var(--on-accent,#fff)] border-transparent' : '')}>{f.label}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={keepFont} onChange={(e) => toggleKeep(e.target.checked)} className="w-5 h-5" />
              Nechať moje písmo pri zmene témy
            </label>
            {slider('Veľkosť písma', 'fontScale', 85, 130, ' %')}
            {slider('Žiara textu', 'glow', 0, 14, ' px')}
          </Sec>

          <Sec title="CRT efekty">
            {slider('Riadky ako na starej obrazovke', 'scan', 0, 100, ' %')}
            {slider('Tmavé okraje', 'vignette', 0, 100, ' %')}
          </Sec>
        </div>,
        document.body,
      )}
    </>
  )
}

function Sec({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="border-t line py-2">
      <summary className="text-sm font-semibold cursor-pointer select-none py-1">{title}</summary>
      <div className="pt-2">{children}</div>
    </details>
  )
}
