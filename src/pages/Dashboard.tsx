import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SyncBox } from '../components/SyncBox'
import { DayPanel } from '../components/DayPanel'
import { BottomBar } from '../components/BottomBar'
import { monthRange, summarize } from '../lib/finance'
import { eur } from '../lib/events'
import {
  type EventRow, type EventType, TYPE_COLOR, TYPE_LABEL, TYPE_TEXT,
  addDays, diffDays, endDay, monthName, startDay, todayLocal,
} from '../lib/events'

const WEEKDAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']
const TYPES: EventType[] = ['event_car', 'support', 'adhoc', 'servis']
const MAX_LANES = 6

type CalEvent = Pick<EventRow, 'id' | 'title' | 'start_date' | 'end_date' | 'status' | 'event_type'>

const pad = (n: number) => String(n).padStart(2, '0')
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`

function parseMonth(m: string | undefined): { y: number; m: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? '')
  if (match) return { y: Number(match[1]), m: Number(match[2]) - 1 }
  const t = todayLocal()
  return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }
}
function shiftMonth(y: number, m: number, by: number) {
  const d = new Date(Date.UTC(y, m + by, 1))
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}
const firstOfMonth = (y: number, m: number) => `${y}-${pad(m + 1)}-01`
const lastOfMonth = (y: number, m: number) => addDays(firstOfMonth(shiftMonth(y, m, 1).y, shiftMonth(y, m, 1).m), -1)

// Pondelok týždňa, v ktorom je deň.
function mondayOf(day: string): string {
  const wd = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7
  return addDays(day, -wd)
}

type Segment = { ev: CalEvent; col: number; span: number; lane: number; contLeft: boolean; contRight: boolean }

function layoutWeek(weekStart: string, events: CalEvent[]): { segments: Segment[]; hidden: number[] } {
  const weekEnd = addDays(weekStart, 6)
  const items = events
    .filter((e) => startDay(e) <= weekEnd && endDay(e) >= weekStart)
    .map((ev) => {
      const s = startDay(ev) < weekStart ? weekStart : startDay(ev)
      const e = endDay(ev) > weekEnd ? weekEnd : endDay(ev)
      return { ev, col: diffDays(weekStart, s), span: diffDays(s, e) + 1, contLeft: startDay(ev) < weekStart, contRight: endDay(ev) > weekEnd }
    })
    .sort((a, b) => a.col - b.col || b.span - a.span || a.ev.title.localeCompare(b.ev.title))

  const laneEnds: number[] = []
  const segments: Segment[] = []
  const hidden = [0, 0, 0, 0, 0, 0, 0]
  for (const it of items) {
    let lane = laneEnds.findIndex((end) => end < it.col)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(-1) }
    laneEnds[lane] = it.col + it.span - 1
    if (lane < MAX_LANES) segments.push({ ...it, lane })
    else for (let c = it.col; c < it.col + it.span; c++) hidden[c]++
  }
  return { segments, hidden }
}

function occupiedDays(events: CalEvent[], from: string, to: string): number {
  const days = new Set<string>()
  for (const e of events) {
    let d = startDay(e) < from ? from : startDay(e)
    const last = endDay(e) > to ? to : endDay(e)
    while (d <= last) { days.add(d); d = addDays(d, 1) }
  }
  return days.size
}

function monthStats(events: CalEvent[], y: number, m: number) {
  const from = firstOfMonth(y, m)
  const to = lastOfMonth(y, m)
  const inMonth = events.filter((e) => e.status !== 'cancelled' && startDay(e) <= to && endDay(e) >= from)
  const byType = Object.fromEntries(TYPES.map((t) => [t, inMonth.filter((e) => e.event_type === t).length])) as Record<EventType, number>
  const busy = occupiedDays(inMonth, from, to)
  const total = diffDays(from, to) + 1
  return { count: inMonth.length, byType, busy, free: total - busy }
}

export function Dashboard() {
  const search = useSearch({ strict: false }) as { m?: string }
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { y, m } = parseMonth(search.m)
  const prev = shiftMonth(y, m, -1)
  const next = shiftMonth(y, m, 1)

  const gridStart = mondayOf(firstOfMonth(y, m))
  const gridEnd = addDays(gridStart, 41)
  const loadFrom = firstOfMonth(prev.y, prev.m) < gridStart ? firstOfMonth(prev.y, prev.m) : gridStart

  const [events, setEvents] = useState<CalEvent[]>([])
  const [showCancelled, setShowCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    // Eventy môžu trvať viac dní, preto načítame aj tie, ktoré začali o niečo skôr.
    supabase
      .from('events')
      .select('id, title, start_date, end_date, status, event_type')
      .gte('start_date', addDays(loadFrom, -31) + 'T00:00:00Z')
      .lte('start_date', gridEnd + 'T00:00:00Z')
      .order('start_date')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setError(error.message)
        else setEvents((data as CalEvent[]).filter((e) => endDay(e) >= loadFrom))
      })
    return () => { alive = false }
  }, [loadFrom, gridEnd, reload])

  const visible = useMemo(() => events.filter((e) => showCancelled || e.status !== 'cancelled'), [events, showCancelled])
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(gridStart, i * 7)).map((ws) => ({ ws, ...layoutWeek(ws, visible) })),
    [gridStart, visible],
  )
  const cur = monthStats(events, y, m)
  const last = monthStats(events, prev.y, prev.m)
  const today = todayLocal()
  const goMonth = (t: { y: number; m: number }) => navigate({ to: '/', search: { m: monthKey(t.y, t.m) } })

  return (
    <section>
      <DayPanel isAdmin={isAdmin} />
      <h1 className="display text-4xl font-bold capitalize whitespace-nowrap">
        {monthName(m)} <span className="muted font-medium">{y}</span>
      </h1>

      <BottomBar>
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(prev)} className="h-11 w-14 rounded-lg border line text-xl" aria-label="Predošlý mesiac">‹</button>
          <button onClick={() => navigate({ to: '/', search: {} })} className="flex-1 h-11 rounded-lg border line font-semibold capitalize">
            {monthName(m)} {y}
          </button>
          <button onClick={() => goMonth(next)} className="h-11 w-14 rounded-lg border line text-xl" aria-label="Ďalší mesiac">›</button>
        </div>
      </BottomBar>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        {TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
            {TYPE_LABEL[t]}
          </span>
        ))}
        <label className="flex items-center gap-1 ml-auto muted">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          Zrušené
        </label>
      </div>

      {error && <p className="mt-3 text-[var(--color-signal)]">{error}</p>}

      <div className="card mt-3 overflow-hidden">
        <div className="grid grid-cols-7 border-b line text-[11px] font-semibold muted">
          {WEEKDAYS.map((d) => <div key={d} className="px-1.5 py-1">{d}</div>)}
        </div>
        {weeks.map(({ ws, segments, hidden }) => {
          const lanes = Math.max(2, ...segments.map((s) => s.lane + 1))
          return (
            <div
              key={ws}
              className="grid grid-cols-7 border-b line last:border-b-0 relative"
              style={{ gridTemplateRows: `20px repeat(${lanes}, 19px) 4px` }}
            >
              {Array.from({ length: 7 }, (_, c) => {
                const day = addDays(ws, c)
                const inMonth = day.slice(0, 7) === monthKey(y, m)
                return (
                  <div
                    key={day}
                    className={'border-r line last:border-r-0 ' + (inMonth ? '' : 'opacity-40')}
                    style={{ gridColumn: c + 1, gridRow: '1 / -1' }}
                  >
                    <div className="flex items-center justify-between px-1 h-5 text-[11px]">
                      <span
                        className={day === today ? 'bg-[var(--color-signal)] text-white rounded-full w-5 h-5 grid place-items-center font-bold' : 'font-medium'}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {hidden[c] > 0 && <span className="muted">+{hidden[c]}</span>}
                    </div>
                  </div>
                )
              })}
              {segments.map((s) => (
                <Link
                  key={s.ev.id + ws}
                  to="/event/$id"
                  params={{ id: s.ev.id }}
                  title={s.ev.title}
                  className={
                    'z-10 mx-px my-[1px] px-1 text-[10px] sm:text-[11px] leading-[17px] font-semibold truncate ' +
                    (s.contLeft ? 'rounded-l-none ' : 'rounded-l ') + (s.contRight ? 'rounded-r-none ' : 'rounded-r ') +
                    (s.ev.status === 'cancelled' ? 'line-through opacity-50 ' : '')
                  }
                  style={{
                    gridColumn: `${s.col + 1} / span ${s.span}`,
                    gridRow: s.lane + 2,
                    background: TYPE_COLOR[s.ev.event_type],
                    color: TYPE_TEXT[s.ev.event_type],
                  }}
                >
                  {s.ev.title}
                </Link>
              ))}
            </div>
          )
        })}
      </div>

      <h2 className="display text-xl font-bold mt-4">Štatistiky mesiaca</h2>
      <div className="grid grid-cols-4 gap-1.5 mt-2">
        <Stat label="Eventy spolu" value={cur.count} prev={last.count} />
        <Stat label="Obsadené dni" value={cur.busy} prev={last.busy} />
        <Stat label="Voľné dni" value={cur.free} prev={last.free} />
        {TYPES.map((t) => (
          <Stat key={t} label={TYPE_LABEL[t]} value={cur.byType[t]} prev={last.byType[t]} color={TYPE_COLOR[t]} />
        ))}
      </div>
      <p className="text-xs muted mt-1">Číslo vedľa = rozdiel oproti mesiacu {monthName(prev.m)}. Zrušené eventy sa nerátajú.</p>

      {isAdmin && <FinanceSummary month={monthKey(y, m)} />}

      <SyncBox isAdmin={isAdmin} onSynced={() => setReload((r) => r + 1)} />
    </section>
  )
}

function Stat({ label, value, prev, color }: { label: string; value: number; prev: number; color?: string }) {
  const diff = value - prev
  return (
    <div className="card px-2 py-1.5 min-w-0" style={color ? { borderTop: `3px solid ${color}` } : undefined}>
      <p className="text-[10px] muted leading-tight truncate">{label}</p>
      <p className="flex items-baseline gap-1">
        <span className="display text-2xl font-bold leading-tight">{value}</span>
        <span className="text-[10px] muted">{diff === 0 ? '=' : diff > 0 ? `+${diff}` : diff}</span>
      </p>
    </div>
  )
}

// Mesačný prehľad financií (len admin).
function FinanceSummary({ month }: { month: string }) {
  const [sum, setSum] = useState<ReturnType<typeof summarize> | null>(null)
  useEffect(() => {
    const [from, to] = monthRange(month)
    Promise.all([
      supabase.from('expenses').select('amount').gte('date', from).lt('date', to),
      supabase.from('driver_payouts').select('amount, tax_rate, events!inner(start_date)').gte('events.start_date', from).lt('events.start_date', to),
    ]).then(([e, p]) => setSum(summarize(e.data ?? [], p.data ?? [])))
  }, [month])
  if (!sum) return null
  return (
    <>
      <h2 className="display text-2xl font-bold mt-6">Financie mesiaca</h2>
      <Link to="/financie" className="grid grid-cols-3 gap-2 mt-2">
        <div className="card p-3"><p className="text-[11px] muted">Vedľajšie náklady</p><p className="display text-xl font-bold">{eur(sum.exp)}</p></div>
        <div className="card p-3"><p className="text-[11px] muted">Brigádnici + 15 %</p><p className="display text-xl font-bold">{eur(sum.pay)}</p></div>
        <div className="card p-3 border-2 border-[var(--color-signal)]"><p className="text-[11px] muted">Pošle Red Bull</p><p className="display text-xl font-bold">{eur(sum.total)}</p></div>
      </Link>
    </>
  )
}
