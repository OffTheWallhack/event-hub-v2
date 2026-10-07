import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomBar } from './BottomBar'
import { TYPE_COLOR, addDays, startDay, type EventRow } from '../lib/events'

type Mini = Pick<EventRow, 'id' | 'title' | 'start_date' | 'event_type'>

/**
 * Spodná lišta eventu: ‹ › na predošlý / ďalší event a mini kalendár (miniatúry eventov podľa dátumu).
 * Zobrazí okolie aktuálneho eventu, aktuálny je zvýraznený.
 */
export function EventNavBar({ ev }: { ev: Pick<EventRow, 'id' | 'title' | 'start_date' | 'event_type'> }) {
  const navigate = useNavigate()
  const [list, setList] = useState<Mini[]>([])
  const cur = useRef<HTMLButtonElement | null>(null)
  const day = startDay(ev)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, start_date, event_type')
      .neq('status', 'cancelled')
      .gte('start_date', addDays(day, -40) + 'T00:00:00Z')
      .lte('start_date', addDays(day, 60) + 'T00:00:00Z')
      .order('start_date')
      .order('id')
      .range(0, 199)
      .then(({ data }) => {
        let l = (data ?? []) as Mini[]
        if (!l.some((e) => e.id === ev.id)) l = [...l, ev as Mini].sort((a, b) => a.start_date.localeCompare(b.start_date))
        setList(l)
      })
  }, [ev.id, day])

  useEffect(() => { cur.current?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [list, ev.id])

  // eventy zoskupené podľa dňa: jedna čiarka = jeden event, viac čiarok vedľa seba = viac eventov v ten deň
  const groups: { day: string; events: Mini[] }[] = []
  for (const e of list) {
    const d = startDay(e)
    const last = groups[groups.length - 1]
    if (last && last.day === d) last.events.push(e)
    else groups.push({ day: d, events: [e] })
  }
  const idx = list.findIndex((e) => e.id === ev.id)
  const go = (e: Mini | undefined) => e && navigate({ to: '/event/$id', params: { id: e.id } })
  const prev = idx > 0 ? list[idx - 1] : undefined
  const next = idx >= 0 ? list[idx + 1] : undefined

  return (
    <BottomBar>
      <div className="flex items-center gap-2">
        <button onClick={() => go(prev)} disabled={!prev} className="h-12 w-12 shrink-0 rounded-lg border line text-xl disabled:opacity-30" aria-label="Predošlý event">‹</button>
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          <ul className="flex items-end gap-2.5 w-max px-1 h-12">
            {groups.map((g, i) => {
              const month = i === 0 || g.day.slice(0, 7) !== groups[i - 1].day.slice(0, 7)
              const isCur = g.events.some((e) => e.id === ev.id)
              return (
                <li key={g.day} className="flex items-end gap-1.5">
                  {month && <span className="text-[9px] muted self-center -mr-1">{Number(g.day.slice(5, 7))}.</span>}
                  <span className="flex items-end gap-[3px]">
                    {isCur && <span className="absolute -mt-9 text-[9px] font-bold" style={{ transform: 'translateX(-2px)' }}>{Number(g.day.slice(8))}.</span>}
                    {g.events.map((e) => {
                      const on = e.id === ev.id
                      return (
                        <button
                          key={e.id}
                          ref={on ? cur : undefined}
                          onClick={() => go(e)}
                          title={`${Number(g.day.slice(8))}. ${e.title}`}
                          aria-label={e.title}
                          className="w-2.5 rounded-sm"
                          style={{ height: on ? 40 : 28, background: TYPE_COLOR[e.event_type], outline: on ? '2px solid var(--fg)' : 'none', outlineOffset: 1 }}
                        />
                      )
                    })}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <button onClick={() => go(next)} disabled={!next} className="h-12 w-12 shrink-0 rounded-lg border line text-xl disabled:opacity-30" aria-label="Ďalší event">›</button>
      </div>
    </BottomBar>
  )
}
