import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { missingOf } from '../lib/complete'
import { TYPE_COLOR, addDays, diffDays, fmtDay, fmtRange, startDay, todayLocal, type EventRow } from '../lib/events'

type Ev = Pick<EventRow, 'id' | 'title' | 'start_date' | 'end_date' | 'event_type' | 'status'>
type Lent = { id: string; name: string; status: string; held_by: string | null; borrowed_until: string | null }
type NotReturned = { quantity: number; equipment: { name: string } | null; events: { id: string; title: string; start_date: string } }
type Incomplete = Ev & { location: string | null; missing: string[] }
type Raw = Ev & {
  location: string | null
  event_drivers: { driver_id: string; drivers: { is_me: boolean } | null }[]
  driver_payouts: { driver_id: string }[]
  carton_movements: { type: string }[]
  event_equipment: { equipment_id: string }[]
}
const LENT_LABEL: Record<string, string> = { borrowed: 'požičané', in_rent: 'v prenájme', rented_out: 'prenajaté', lost: 'stratené' }

const COLS = 'id, title, start_date, end_date, event_type, status'

/** Dashboard: čo je dnes, najbližší event a (pre admina) čo treba doriešiť. */
export function DayPanel({ isAdmin }: { isAdmin: boolean }) {
  const today = todayLocal()
  const [now, setNow] = useState<Ev[]>([])
  const [next, setNext] = useState<Ev | null>(null)
  const [open, setOpen] = useState<Ev[]>([])
  const [open2, setOpen2] = useState(0)
  const [lent, setLent] = useState<Lent[]>([])
  const [notBack, setNotBack] = useState<NotReturned[]>([])
  const [incomplete, setIncomplete] = useState<Incomplete[]>([])

  useEffect(() => {
    const t0 = today + 'T00:00:00Z'
    supabase
      .from('events').select(COLS).neq('status', 'cancelled')
      .lte('start_date', t0).gte('start_date', addDays(today, -14) + 'T00:00:00Z')
      .or(`end_date.gte.${t0},end_date.is.null`).order('start_date')
      .then(({ data }) => setNow(((data ?? []) as Ev[]).filter((e) => !e.end_date || e.end_date >= t0 || startDay(e) === today)))
    supabase
      .from('events').select(COLS).neq('status', 'cancelled').gt('start_date', t0).order('start_date').limit(1)
      .then(({ data }) => setNext(((data ?? []) as Ev[])[0] ?? null))

    if (!isAdmin) return
    // už skončené, ale ešte neuzavreté (zostali Plánované)
    supabase
      .from('events').select(COLS).eq('status', 'planned').lt('end_date', t0).gte('start_date', '2026-01-01T00:00:00Z')
      .order('start_date', { ascending: false }).limit(10)
      .then(({ data }) => setOpen((data ?? []) as Ev[]))
    supabase
      .from('events').select('id', { count: 'exact', head: true }).eq('status', 'planned').lt('end_date', t0).gte('start_date', '2026-01-01T00:00:00Z')
      .then(({ count }) => setOpen2(count ?? 0))
    // neúplné eventy: od začiatku roka po najbližšie 2 týždne
    supabase
      .from('events')
      .select(COLS + ', location, event_drivers(driver_id, drivers(is_me)), driver_payouts(driver_id), carton_movements(type), event_equipment(equipment_id)')
      .neq('status', 'cancelled').gte('start_date', '2026-01-01T00:00:00Z').lte('start_date', addDays(today, 14) + 'T00:00:00Z')
      .order('start_date', { ascending: false }).range(0, 499)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as Raw[]).map((r) => {
          const paid = new Set(r.driver_payouts.map((p) => p.driver_id))
          const missing = missingOf(r, {
            drivers: r.event_drivers.length,
            externalWithoutPayout: r.event_drivers.filter((x) => !x.drivers?.is_me && !paid.has(x.driver_id)).length,
            cartons: r.carton_movements.filter((m) => m.type === 'event').length,
            gear: r.event_equipment.length,
          }, today)
          return { ...r, missing }
        }).filter((r) => r.missing.length > 0)
        setIncomplete(list)
      })
    // technika, ktorá je práve požičaná / v prenájme / stratená
    supabase
      .from('equipment').select('id, name, status, held_by, borrowed_until').eq('active', true).in('status', ['borrowed', 'in_rent', 'rented_out', 'lost']).order('name')
      .then(({ data }) => setLent((data ?? []) as Lent[]))
    // technika označená v reporte ako nevrátená
    supabase
      .from('event_equipment')
      .select('quantity, equipment(name), events!inner(id, title, start_date, status)')
      .eq('issue', 'not_returned').neq('events.status', 'cancelled').range(0, 99)
      .then(({ data }) => setNotBack((data ?? []) as unknown as NotReturned[]))
  }, [today, isAdmin])

  const attention = open2 + lent.length + notBack.length + incomplete.length

  const row = (e: Ev) => (
    <Link key={e.id} to="/event/$id" params={{ id: e.id }} className="flex items-center gap-3 px-4 py-3 min-w-0">
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: TYPE_COLOR[e.event_type] }} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{e.title}</span>
        <span className="block text-sm muted">{fmtRange(e)}</span>
      </span>
      <ChevronRight className="w-5 h-5 muted shrink-0" aria-hidden />
    </Link>
  )
  const nextIn = next ? diffDays(today, startDay(next)) : 0

  if (now.length === 0 && !next && attention === 0) return null
  return (
    <div className="grid gap-3">
      {(now.length > 0 || next) && (
        <div className="card overflow-hidden list">
          {now.length > 0 && (
            <div>
              <p className="eyebrow px-4 pt-3 !text-[var(--color-signal)]">Dnes</p>
              <div className="list">{now.map(row)}</div>
            </div>
          )}
          {next && (
            <div>
              <p className="eyebrow px-4 pt-3">Najbližší · {nextIn === 1 ? 'zajtra' : `o ${nextIn} dní`}</p>
              {row(next)}
            </div>
          )}
        </div>
      )}
      {isAdmin && attention > 0 && (
        <details className="notice group block">
          <summary className="flex items-center gap-2 font-semibold select-none">
            <TriangleAlert className="w-5 h-5 text-[var(--warn)] shrink-0" aria-hidden />
            <span className="flex-1">Treba doriešiť</span>
            <span className="badge badge-warn">{attention}</span>
            <ChevronDown className="w-5 h-5 muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          {open.length > 0 && (
            <div className="mt-3">
              <p className="eyebrow">Skončené, ešte neuzavreté</p>
              <ul className="list text-sm">
                {open.map((e) => (
                  <li key={e.id}>
                    <Link to="/event/$id" params={{ id: e.id }} className="flex items-center gap-2 py-2">
                      <span className="dot" style={{ background: TYPE_COLOR[e.event_type] }} />
                      <span className="flex-1 truncate font-medium">{e.title}</span>
                      <span className="muted text-xs shrink-0">{fmtDay(startDay(e)).replace(/ \d{4}$/, '')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {open2 > open.length && <p className="text-xs muted mt-1">…a ďalších {open2 - open.length}</p>}
            </div>
          )}
          {incomplete.length > 0 && (
            <div className="mt-3">
              <p className="eyebrow">Neúplné eventy</p>
              <ul className="list text-sm">
                {incomplete.slice(0, 10).map((e) => (
                  <li key={e.id}>
                    <Link to="/event/$id" params={{ id: e.id }} className="flex items-center gap-2 py-2">
                      <span className="dot" style={{ background: TYPE_COLOR[e.event_type] }} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block text-xs muted">{fmtDay(startDay(e)).replace(/ \d{4}$/, '')} · chýba: {e.missing.join(', ')}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 muted shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {incomplete.length > 10 && <p className="text-xs muted mt-1">…a ďalších {incomplete.length - 10}</p>}
            </div>
          )}
          {(lent.length > 0 || notBack.length > 0) && (
            <div className="mt-3">
              <p className="eyebrow">Technika mimo skladu</p>
              <ul className="list text-sm">
                {lent.map((l) => (
                  <li key={l.id} className="py-2">
                    <Link to="/technika" className="font-medium">{l.name}</Link>
                    <span className="muted"> · {LENT_LABEL[l.status] ?? l.status}{l.held_by ? ` · ${l.held_by}` : ''}</span>
                    {l.borrowed_until && l.borrowed_until < today && <span className="err font-semibold"> · malo byť vrátené {fmtDay(l.borrowed_until)}</span>}
                  </li>
                ))}
                {notBack.map((n, i) => (
                  <li key={i} className="py-2">
                    <span className="font-medium">{n.quantity}× {n.equipment?.name}</span>
                    <span className="muted"> · nevrátené z </span>
                    <Link to="/event/$id" params={{ id: n.events.id }} className="link">{n.events.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </div>
  )
}
