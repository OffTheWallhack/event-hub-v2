import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Todo } from '../lib/todos'

type Due = Pick<Todo, 'id' | 'text' | 'remind_at'>

/** Pripomienky v appke: úlohy, ktorým už nastal čas pripomienky a nie sú hotové. Beží len pri otvorenej appke. */
export function Reminders() {
  const [due, setDue] = useState<Due[]>([])

  async function load() {
    const { data } = await supabase
      .from('todos')
      .select('id, text, remind_at')
      .neq('status', 'done')
      .not('remind_at', 'is', null)
      .lte('remind_at', new Date().toISOString())
      .order('remind_at')
    setDue((data ?? []) as Due[])
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  async function act(id: string, patch: Record<string, unknown>) {
    setDue((l) => l.filter((x) => x.id !== id))
    await supabase.from('todos').update(patch).eq('id', id)
  }
  const later = (ms: number) => new Date(Date.now() + ms).toISOString()
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString() }

  if (due.length === 0) return null
  return (
    <div className="grid gap-2 mb-4">
      {due.map((t) => (
        <div key={t.id} className="rounded-xl p-3 border-2 border-[var(--color-amber)]" style={{ background: 'color-mix(in srgb, var(--color-amber) 14%, var(--card))' }}>
          <p className="text-sm font-semibold">🔔 {t.text}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <button onClick={() => act(t.id, { status: 'done', remind_at: null })} className="h-9 px-3 rounded-lg font-semibold text-white bg-green-700 text-sm">Hotovo</button>
            <button onClick={() => act(t.id, { remind_at: later(3600_000) })} className="h-9 px-3 rounded-lg border line text-sm">Za 1 h</button>
            <button onClick={() => act(t.id, { remind_at: tomorrow() })} className="h-9 px-3 rounded-lg border line text-sm">Zajtra</button>
            <button onClick={() => act(t.id, { remind_at: null })} className="h-9 px-3 rounded-lg text-sm muted ml-auto">Zrušiť</button>
          </div>
        </div>
      ))}
    </div>
  )
}
