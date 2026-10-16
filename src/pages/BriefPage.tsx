import { useEffect, useState } from 'react'
import { CalendarDays, FileDown, MapPin } from 'lucide-react'
import { KV, Section, dayWord, linkify } from '../components/ui'
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
          <p className="eyebrow">Event Hub</p>
          <p className="section-title !text-xl mt-2">{error}</p>
          <p className="text-sm muted mt-1">Požiadaj o nový odkaz.</p>
        </div>
      </div>
    )
  }
  if (!b) return <div className="min-h-full grid place-items-center muted text-sm">Načítavam…</div>

  const ev = { start_date: b.start_date, end_date: b.end_date }
  const info = [b.notes, b.description].filter(Boolean).join('\n\n')
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 page">
      <div className="flex items-center gap-2 no-print">
        <p className="eyebrow flex-1">Event Hub · brief pre vodiča</p>
        <button onClick={() => window.print()} className="btn btn-sm btn-primary"><FileDown aria-hidden />Uložiť PDF</button>
      </div>

      <header className="card section">
        {b.cancelled && <span className="badge badge-danger mb-2">EVENT JE ZRUŠENÝ</span>}
        <h1 className="page-title">{b.title}</h1>
        <p className="mt-2 flex items-start gap-2 font-medium">
          <CalendarDays className="w-4 h-4 muted shrink-0 mt-[0.2em]" aria-hidden />
          <span>{fmtRange(ev)} <span className="muted font-normal">· {durationDays(ev)} {dayWord(durationDays(ev))}</span></span>
        </p>
      </header>

      <Section title="Logistika">
        <dl className="kv">
          <KV label="Príchod">{b.planned_arrival?.slice(0, 5)}</KV>
          <KV label="Lokalita">
            {b.location}
            {b.location_url && <a href={b.location_url} target="_blank" rel="noreferrer" className="link ml-2 inline-flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5" aria-hidden />Mapa</a>}
          </KV>
          <KV label="Kontakt">{b.contact && <span className="whitespace-pre-wrap">{linkify(b.contact)}</span>}</KV>
          <KV label="Vozidlá">{b.vehicles.join(', ')}</KV>
          <KV label="Vodiči">{b.drivers.join(', ')}</KV>
        </dl>
      </Section>

      {info && (
        <Section title="Popis">
          <p className="text-sm whitespace-pre-wrap break-words">{linkify(info)}</p>
        </Section>
      )}

      {b.equipment.length > 0 && (
        <Section title="Technika">
          <ul className="list text-sm">
            {[...b.equipment].sort((a, c) => a.name.localeCompare(c.name)).map((e) => (
              <li key={e.name} className="py-2 flex gap-3"><b className="w-8 num">{e.quantity}×</b><span>{e.name}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {b.cartons.length > 0 && (
        <Section title="Kartóny">
          <ul className="chips">
            {b.cartons.map((c) => <li key={c.label} className="chip"><b className="num">{c.n}×</b> {c.label}</li>)}
          </ul>
        </Section>
      )}

      {b.expires_at && <p className="text-xs muted">Odkaz platí do {fmtDay(b.expires_at.slice(0, 10))}.</p>}
    </main>
  )
}
