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

  const idx = list.findIndex((e) => e.id === ev.id)
  const go = (e: Mini | undefined) => e && navigate({ to: '/event/$id', params: { id: e.id } })
  const prev = idx > 0 ? list[idx - 1] : undefined
  const next = idx >= 0 ? list[idx + 1] : undefined

  return (
    <BottomBar>
      <div className="flex items-center gap-2">
        <button onClick={() => go(prev)} disabled={!prev} className="h-12 w-12 shrink-0 rounded-lg border line text-xl disabled:opacity-30" aria-label="Predošlý event">‹</button>
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          <ul className="flex gap-1 w-max px-0.5">
            {list.map((e, i) => {
              const d = startDay(e)
              const month = i === 0 || startDay(list[i - 1]).slice(0, 7) !== d.slice(0, 7)
              const on = e.id === ev.id
              return (
                <li key={e.id} className="flex items-end gap-1">
                  {month && <span className="text-[9px] muted self-center -mr-0.5">{Number(d.slice(5, 7))}.</span>}
                  <button
                    ref={on ? cur : undefined}
                    onClick={() => go(e)}
                    title={e.title}
                    className={'w-9 h-12 rounded-md border flex flex-col items-center justify-end overflow-hidden ' + (on ? 'border-[var(--fg)] border-2' : 'line')}
                  >
                    <span className="text-[10px] font-bold leading-none mb-1">{Number(d.slice(8))}</span>
                    <span className="w-full h-2.5" style={{ background: TYPE_COLOR[e.event_type] }} />
                  </button>
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
