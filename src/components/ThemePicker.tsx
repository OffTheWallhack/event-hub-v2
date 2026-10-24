import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyMode, loadMode, type Mode } from '../lib/theme'
import { Section } from './ui'

const OPTIONS: { id: Mode; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Svetlá', Icon: Sun },
  { id: 'dark', label: 'Tmavá', Icon: Moon },
]

/** Prepínač medzi svetlou a tmavou témou. Ukladá sa v tomto prehliadači. */
export function ThemePicker() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const pick = (m: Mode) => { setMode(m); applyMode(m) }

  return (
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
  )
}
