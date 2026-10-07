import { useEffect, useState, type ReactNode } from 'react'
import { SUPABASE_KEY, SUPABASE_URL } from '../lib/supabase'
import { durationDays, fmtDay, fmtRange } from '../lib/events'

type Brief = {
  title: string
  start_date: string
  end_date: string | null
  cancelled: boolean
  notes: string | null
  description: string | null
  location: string | null
  location_url: string | null
  planned_arrival: string | null
  contact: string | null
  vehicles: string[]
  drivers: string[]
  equipment: { name: string; quantity: number }[]
  cartons: { label: string; n: number }[]
  expires_at: string | null
}

const dayWord = (n: number) => (n === 1 ? 'deň' : n >= 2 && n <= 4 ? 'dni' : 'dní')

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-[var(--color-sky)] break-all">{part}</a> : part,
  )
}

/** Verejná stránka pre externého vodiča (/brief/<token>), bez prihlásenia a bez financií. */
export function BriefPage({ token }: { token: string }) {
  const [b, setB] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${SUPABASE_URL}/functions/v1/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? 'Odkaz sa nepodarilo načítať.')
        setB(body as Brief)
        document.title = body.title
      })
      .catch((e) => setError(e.message))
  }, [token])

  if (error) {
    return (
      <div className="min-h-full grid place-items-center p-6 text-center">
        <div>
          <p className="display text-3xl font-bold">Event Hub</p>
          <p className="mt-3">{error}</p>
          <p className="text-sm muted mt-1">Požiadaj o nový odkaz.</p>
        </div>
      </div>
    )
  }
  if (!b) return <div className="min-h-full grid place-items-center muted">Načítavam…</div>

  const ev = { start_date: b.start_date, end_date: b.end_date }
  const info = [b.notes, b.description].filter(Boolean).join('\n\n')
  return (
    <main className="max-w-2xl mx-auto px-4 py-5 grid gap-4">
      <div className="flex items-center gap-2 no-print">
        <p className="display text-xl font-bold flex-1">Event Hub</p>
        <button onClick={() => window.print()} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Stiahnuť PDF</button>
      </div>

      <div className="card p-4">
        {b.cancelled && <p className="text-[var(--color-signal)] font-bold mb-1">EVENT JE ZRUŠENÝ</p>}
        <h1 className="display text-4xl font-bold leading-tight">{b.title}</h1>
        <p className="font-medium mt-1">
          {fmtRange(ev)} <span className="muted">· {durationDays(ev)} {dayWord(durationDays(ev))}</span>
        </p>
      </div>

      <Section title="Logistika">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
          <Row label="Príchod">{b.planned_arrival?.slice(0, 5)}</Row>
          <Row label="Lokalita">
            {b.location}
            {b.location_url && <a href={b.location_url} target="_blank" rel="noreferrer" className="ml-2 text-[var(--color-sky)] font-semibold">Mapa ↗</a>}
          </Row>
          <Row label="Kontakt">{b.contact && <span className="whitespace-pre-wrap">{linkify(b.contact)}</span>}</Row>
          <Row label="Vozidlá">{b.vehicles.join(', ')}</Row>
          <Row label="Vodiči">{b.drivers.join(', ')}</Row>
        </dl>
      </Section>

      {info && (
        <Section title="Popis">
          <p className="whitespace-pre-wrap break-words">{linkify(info)}</p>
        </Section>
      )}

      {b.equipment.length > 0 && (
        <Section title="Technika">
          <ul className="grid gap-1">
            {[...b.equipment].sort((a, c) => a.name.localeCompare(c.name)).map((e) => (
              <li key={e.name}><b className="inline-block w-8">{e.quantity}×</b>{e.name}</li>
            ))}
          </ul>
        </Section>
      )}

      {b.cartons.length > 0 && (
        <Section title="Kartóny">
          <ul className="flex flex-wrap gap-2">
            {b.cartons.map((c) => <li key={c.label} className="px-2 py-1 rounded-lg border line"><b>{c.n}×</b> {c.label}</li>)}
          </ul>
        </Section>
      )}

      {b.expires_at && <p className="text-xs muted">Odkaz platí do {fmtDay(b.expires_at.slice(0, 10))}.</p>}
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4 text-sm">
      <h2 className="display text-xl font-bold mb-2">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd className="min-w-0 break-words">{empty ? <span className="muted">–</span> : children}</dd>
    </>
  )
}
