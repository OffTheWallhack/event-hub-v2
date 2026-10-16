import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SyncBox } from '../components/SyncBox'
import { DayPanel } from '../components/DayPanel'
import { BottomBar } from '../components/BottomBar'
import { ErrorText, PageHeader, Section, Stat } from '../components/ui'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
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
    <div className="page">
      <DayPanel isAdmin={isAdmin} />

      <PageHeader
        title={<span className="capitalize">{monthName(m)} <span className="muted font-semibold">{y}</span></span>}
        actions={
          <button type="button" aria-pressed={showCancelled} onClick={() => setShowCancelled(!showCancelled)} className="chip">
            {showCancelled ? <Eye className="w-4 h-4" aria-hidden /> : <EyeOff className="w-4 h-4" aria-hidden />}Zrušené
          </button>
        }
      />

      <BottomBar>
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(prev)} className="btn btn-icon" aria-label="Predošlý mesiac"><ChevronLeft aria-hidden /></button>
          <button onClick={() => navigate({ to: '/', search: {} })} className="btn flex-1 capitalize" title="Späť na dnešok">
            {monthName(m)} {y}
          </button>
          <button onClick={() => goMonth(next)} className="btn btn-icon" aria-label="Ďalší mesiac"><ChevronRight aria-hidden /></button>
        </div>
      </BottomBar>

      <ErrorText>{error}</ErrorText>

      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs">
          {TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: TYPE_COLOR[t] }} />
              {TYPE_LABEL[t]}
            </span>
          ))}
        </div>
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b line">
            {WEEKDAYS.map((d, i) => <div key={d} className={'px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide muted ' + (i >= 5 ? 'bg-[var(--fill)]' : '')}>{d}</div>)}
          </div>
          {weeks.map(({ ws, segments, hidden }) => {
            const lanes = Math.max(2, ...segments.map((s) => s.lane + 1))
            return (
              <div
                key={ws}
                className="grid grid-cols-7 border-b line last:border-b-0 relative"
                style={{ gridTemplateRows: `24px repeat(${lanes}, 20px) 5px` }}
              >
                {Array.from({ length: 7 }, (_, c) => {
                  const day = addDays(ws, c)
                  const inMonth = day.slice(0, 7) === monthKey(y, m)
                  return (
                    <div
                      key={day}
                      className={'border-r line last:border-r-0 ' + (c >= 5 ? 'bg-[var(--fill)] ' : '') + (inMonth ? '' : 'opacity-40')}
                      style={{ gridColumn: c + 1, gridRow: '1 / -1' }}
                    >
                      <div className="flex items-center justify-between px-1 pt-1 h-6 text-xs">
                        <span
                          className={day === today ? 'bg-[var(--color-signal)] text-[var(--on-accent,#fff)] rounded-full w-5 h-5 grid place-items-center font-bold text-[11px]' : 'font-medium num pl-0.5'}
                        >
                          {Number(day.slice(8))}
                        </span>
                        {hidden[c] > 0 && <span className="muted text-[10px]">+{hidden[c]}</span>}
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
                      'z-10 my-[1px] px-1.5 text-[10.5px] sm:text-[11px] leading-[18px] font-semibold truncate ' +
                      (s.contLeft ? 'rounded-l-none ' : 'ml-[2px] rounded-l-[5px] ') + (s.contRight ? 'rounded-r-none ' : 'mr-[2px] rounded-r-[5px] ') +
                      (s.ev.status === 'cancelled' ? 'line-through opacity-50 ' : '')
                    }
                    style={{
                      gridColumn: `${s.col + 1} / span ${s.span}`,
                      gridRow: s.lane + 2,
                      background: TYPE_COLOR[s.ev.event_type],
                      color: TYPE_TEXT[s.ev.event_type],
                      textShadow: 'none',
                    }}
                  >
                    {s.ev.title}
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <Section title="Mesiac v číslach" sub={`Rozdiel oproti mesiacu ${monthName(prev.m)}. Zrušené eventy sa nerátajú.`}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Eventy" value={cur.count} sub={diff(cur.count, last.count)} />
          <Stat label="Obsadené dni" value={cur.busy} sub={diff(cur.busy, last.busy)} />
          <Stat label="Voľné dni" value={cur.free} sub={diff(cur.free, last.free)} />
        </div>
        <ul className="grid grid-cols-2 gap-x-6 mt-4 pt-3 border-t line text-sm">
          {TYPES.map((t) => (
            <li key={t} className="flex items-center gap-2 py-1">
              <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: TYPE_COLOR[t] }} />
              <span className="flex-1 truncate">{TYPE_LABEL[t]}</span>
              <b className="num">{cur.byType[t]}</b>
              <span className="text-xs muted num w-7 text-right">{signed(cur.byType[t] - last.byType[t])}</span>
            </li>
          ))}
        </ul>
      </Section>

      {isAdmin && <FinanceSummary month={monthKey(y, m)} label={monthName(m)} />}

      <SyncBox compact isAdmin={isAdmin} onSynced={() => setReload((r) => r + 1)} />
    </div>
  )
}

const signed = (n: number) => (n === 0 ? '=' : n > 0 ? `+${n}` : String(n))
const diff = (a: number, b: number) => (a === b ? 'rovnako' : `${signed(a - b)} oproti min.`)

// Mesačný prehľad financií (len admin).
function FinanceSummary({ month, label }: { month: string; label: string }) {
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
    <Section
      title={<span>Financie <span className="muted font-normal">· {label}</span></span>}
      action={<Link to="/financie" className="btn btn-sm btn-quiet">Detail<ChevronRight aria-hidden /></Link>}
    >
      <Link to="/financie" className="grid grid-cols-3 gap-3">
        <Stat label="Vedľajšie náklady" value={<span className="text-lg sm:text-2xl">{eur(sum.exp)}</span>} />
        <Stat label="Brigádnici + 15 %" value={<span className="text-lg sm:text-2xl">{eur(sum.pay)}</span>} />
        <Stat label="Pošle Red Bull" value={<span className="text-lg sm:text-2xl text-[var(--color-signal)]">{eur(sum.total)}</span>} />
      </Link>
    </Section>
  )
}
