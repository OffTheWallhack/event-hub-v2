import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TYPE_COLOR, addDays, diffDays, fmtDay, fmtRange, startDay, todayLocal, type EventRow } from '../lib/events'

type Ev = Pick<EventRow, 'id' | 'title' | 'start_date' | 'end_date' | 'event_type' | 'status'>
type Lent = { id: string; name: string; status: string; held_by: string | null; borrowed_until: string | null }
type NotReturned = { quantity: number; equipment: { name: string } | null; events: { id: string; title: string; start_date: string } }
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

  const attention = open2 + lent.length + notBack.length

  const row = (e: Ev) => (
    <Link key={e.id} to="/event/$id" params={{ id: e.id }} className="flex items-center gap-2 py-1.5">
      <span className="w-2.5 h-8 rounded-sm shrink-0" style={{ background: TYPE_COLOR[e.event_type] }} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{e.title}</span>
        <span className="block text-xs muted">{fmtRange(e)}</span>
      </span>
    </Link>
  )

  if (now.length === 0 && !next && attention === 0) return null
  return (
    <div className="grid gap-2 mb-4">
      {now.length > 0 && (
        <div className="card p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-signal)]">Dnes</p>
          <div className="divide-y line">{now.map(row)}</div>
        </div>
      )}
      {next && (
        <div className="card p-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold muted">
            Najbližší event · {diffDays(today, startDay(next)) === 1 ? 'zajtra' : `o ${diffDays(today, startDay(next))} dní`}
          </p>
          {row(next)}
        </div>
      )}
      {isAdmin && attention > 0 && (
        <details className="card p-3 border-[var(--color-amber)] border-2">
          <summary className="font-semibold cursor-pointer">⚠ Treba doriešiť ({attention})</summary>
          {open.length > 0 && (
            <div className="mt-2">
              <p className="text-xs muted">Skončené, ešte neuzavreté (report):</p>
              <div className="divide-y line text-sm">{open.map(row)}</div>
              {open2 > open.length && <p className="text-xs muted mt-1">…a ďalších {open2 - open.length}</p>}
            </div>
          )}
          {(lent.length > 0 || notBack.length > 0) && (
            <div className="mt-2">
              <p className="text-xs muted">Technika mimo skladu:</p>
              <ul className="divide-y line text-sm">
                {lent.map((l) => (
                  <li key={l.id} className="py-1.5">
                    <Link to="/technika" className="font-semibold text-[var(--color-sky)]">{l.name}</Link>
                    <span className="muted text-xs"> · {LENT_LABEL[l.status] ?? l.status}{l.held_by ? ` · ${l.held_by}` : ''}</span>
                    {l.borrowed_until && l.borrowed_until < today && <span className="text-xs text-[var(--color-signal)] font-semibold"> · malo byť vrátené {fmtDay(l.borrowed_until)}</span>}
                  </li>
                ))}
                {notBack.map((n, i) => (
                  <li key={i} className="py-1.5">
                    <span className="font-semibold">{n.quantity}× {n.equipment?.name}</span>
                    <span className="muted text-xs"> · nevrátené z </span>
                    <Link to="/event/$id" params={{ id: n.events.id }} className="text-xs text-[var(--color-sky)]">{n.events.title}</Link>
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
