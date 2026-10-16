// Spoločné UI kúsky. Vzhľad je v styles.css (@layer components), farby z témy.
import type { ReactNode } from 'react'

/** Hlavička stránky: veľký nadpis, podnadpis a akcie vpravo. */
export function PageHeader({ title, sub, actions, before }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; before?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="flex-1 min-w-0">
        {before}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}

/** Karta s nadpisom a voliteľným tlačidlom vpravo. */
export function Section({ title, sub, action, children, className = '', id }: {
  title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <section id={id} className={'card section ' + className}>
      {(title || action) && (
        <div className="section-head">
          <div className="min-w-0 min-h-9 flex flex-col justify-center">
            {title && <h2 className="section-title">{title}</h2>}
            {sub && <p className="text-xs muted mt-0.5">{sub}</p>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Pole formulára s popisom nad ním. */
export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={'field ' + className}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="text-xs muted">{hint}</span>}
    </label>
  )
}

/** Segmentovaný prepínač – jedna voľba z pár možností. */
export function Seg<T extends string>({ options, value, onChange, className = '', disabled }: {
  options: readonly (readonly [T, ReactNode])[]; value: T; onChange: (v: T) => void; className?: string; disabled?: boolean
}) {
  return (
    <div className={'seg ' + className} role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Rad prepínacích štítkov (jedna aj viac volieb). */
export function Chips<T extends string>({ options, isOn, onPick, scroll }: {
  options: readonly (readonly [T, ReactNode])[]; isOn: (v: T) => boolean; onPick: (v: T) => void; scroll?: boolean
}) {
  return (
    <div className={scroll ? 'chips-scroll' : 'chips'}>
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={isOn(v)} className="chip" onClick={() => onPick(v)}>{label}</button>
      ))}
    </div>
  )
}

export type Tone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral'
export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge ${tone === 'neutral' ? '' : 'badge-' + tone} ${className}`}>{children}</span>
}

/** Číslo s popisom (štatistika). */
export function Stat({ label, value, sub, color }: { label: ReactNode; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs muted truncate flex items-center gap-1.5">
        {color && <span className="dot" style={{ background: color }} />}
        {label}
      </p>
      <p className="stat-value mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs muted truncate">{sub}</p>}
    </div>
  )
}

/** Riadok „popis – hodnota“ do <dl className="kv">. Prázdna hodnota = pomlčka. */
export function KV({ label, children }: { label: ReactNode; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <>
      <dt>{label}</dt>
      <dd>{empty ? <span className="muted">–</span> : children}</dd>
    </>
  )
}

export const ErrorText = ({ children }: { children: ReactNode }) => (children ? <p className="err" role="alert">{children}</p> : null)
export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>

/** Z textu urobí klikateľné odkazy. */
export function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="link break-all">{part}</a>
    ) : (
      part
    ),
  )
}

export const dayWord = (n: number) => (n === 1 ? 'deň' : n >= 2 && n <= 4 ? 'dni' : 'dní')
