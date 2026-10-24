import { useState } from 'react'
import { Moon, RotateCcw, Sun } from 'lucide-react'
import { SIZE_DEFAULT, SIZE_MAX, SIZE_MIN, applyMode, applySize, loadMode, loadSize, type Mode } from '../lib/theme'
import { Section } from './ui'

const OPTIONS: { id: Mode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Svetlá', Icon: Sun },
  { id: 'dark', label: 'Tmavá', Icon: Moon },
]

/** Svetlá / tmavá téma a veľkosť písma. Ukladá sa v tomto prehliadači. */
export function ThemePicker() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const [size, setSize] = useState<number>(loadSize)
  const pick = (m: Mode) => { setMode(m); applyMode(m) }
  const resize = (n: number) => { setSize(n); applySize(n) }

  return (
    <>
      <Section title="Téma" sub="Ukladá sa len v tomto prehliadači.">
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => pick(id)} aria-pressed={mode === id} className="theme-tile" data-preview={id}>
              <span className="theme-tile-swatch" aria-hidden>
                <span className="theme-tile-card">
                  <span className="theme-tile-aa">Aa</span>
                  <span className="theme-tile-bar" />
                </span>
              </span>
              <span className="theme-tile-label"><Icon aria-hidden />{label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Veľkosť písma"
        sub="Menšie písmo zmenší aj bloky a tlačidlá."
        action={size !== SIZE_DEFAULT && <button onClick={() => resize(SIZE_DEFAULT)} className="btn btn-sm btn-quiet"><RotateCcw aria-hidden />Obnoviť</button>}
      >
        <label className="block">
          <span className="flex justify-between text-sm mb-1">
            <span>Veľkosť</span>
            <span className="muted num">{String(size).replace('.', ',')} px{size === SIZE_DEFAULT ? ' (štandard)' : ''}</span>
          </span>
          <input type="range" min={SIZE_MIN} max={SIZE_MAX} step={0.5} value={size} onChange={(e) => resize(Number(e.target.value))} className="w-full h-7" />
          <span className="flex justify-between text-xs muted mt-0.5"><span>menšie</span><span>väčšie</span></span>
        </label>
      </Section>
    </>
  )
}
