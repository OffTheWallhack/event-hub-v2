import { useState } from 'react'
import { THEMES, applyTheme, getAura, getTheme, type Theme } from '../lib/theme'

/** Tlačidlo 🎨 v hlavičke: výber farebnej témy a vypnutie animovanej aury. */
export function ThemePicker() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [aura, setAura] = useState(getAura())

  const pick = (t: Theme) => { setTheme(t); applyTheme(t, aura) }
  const toggleAura = (v: boolean) => { setAura(v); applyTheme(theme, v) }

  return (
    <>
      <button onClick={() => setOpen(!open)} className="text-sm px-2 py-1 rounded-lg border line shrink-0" aria-label="Farebná téma">🎨</button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Zavrieť" onClick={() => setOpen(false)} />
          <div className="fixed z-50 left-3 right-3 top-12 max-w-md ml-auto card p-3 shadow-2xl">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  className={'rounded-xl border-2 p-1.5 text-left ' + (theme === t.id ? 'border-[var(--color-signal)]' : 'border-transparent')}
                  style={{ background: t.bg }}
                >
                  <span
                    className="block h-8 rounded-lg mb-1 border"
                    style={{
                      borderColor: t.line,
                      background: t.aura
                        ? `radial-gradient(circle at 20% 30%, ${t.aura[0]}, transparent 60%), radial-gradient(circle at 80% 70%, ${t.aura[1]}, transparent 60%), ${t.card}`
                        : t.card,
                    }}
                  />
                  <span className="block text-[11px] font-semibold leading-tight" style={{ color: t.fg }}>
                    {t.label}{t.aura ? ' ✨' : ''}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={aura} onChange={(e) => toggleAura(e.target.checked)} />
              Animovaná aura na pozadí (✨ témy)
            </label>
          </div>
        </>
      )}
    </>
  )
}
