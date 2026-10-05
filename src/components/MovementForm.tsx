import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { type Flavor, type MoveType, MOVE_LABEL, MOVE_SIGN, flavorName, flavorStyle } from '../lib/cartons'
import { fmtRange, startDay, todayLocal } from '../lib/events'

type EventOpt = { id: string; title: string; start_date: string; end_date: string | null }
type Mode = 'move' | 'inventory'

const TYPES: Exclude<MoveType, 'adjustment'>[] = ['delivery', 'event', 'returned', 'opened_garage', 'damaged']

/**
 * Formulár na pohyb kartónov (viac príchutí naraz) alebo inventúru.
 * fixedEventId: formulár na stránke eventu – typ je vždy „Na event“.
 */
export function MovementForm({
  flavors, stock, fixedEventId, fixedEventDay, initialMode = 'move', onDone,
}: {
  flavors: Flavor[]
  stock?: Record<string, number>
  fixedEventId?: string
  fixedEventDay?: string
  initialMode?: Mode
  onDone: (saved: boolean) => void
}) {
  const { session } = useAuth()
  const [mode] = useState<Mode>(fixedEventId ? 'move' : initialMode)
  const [type, setType] = useState<Exclude<MoveType, 'adjustment'>>(fixedEventId ? 'event' : 'delivery')
  const [qty, setQty] = useState<Record<string, string>>(() =>
    initialMode === 'inventory' && stock ? Object.fromEntries(flavors.map((f) => [f.id, String(stock[f.id] ?? 0)])) : {},
  )
  const [eventId, setEventId] = useState(fixedEventId ?? '')
  const [day, setDay] = useState(fixedEventDay ?? todayLocal())
  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')
  const [events, setEvents] = useState<EventOpt[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (fixedEventId || type !== 'event') return
    // posledné 3 mesiace + najbližšie 2, najnovšie hore
    const t = new Date()
    const from = new Date(t.getFullYear(), t.getMonth() - 3, 1).toISOString().slice(0, 10)
    const to = new Date(t.getFullYear(), t.getMonth() + 2, 28).toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .neq('status', 'cancelled')
      .gte('start_date', from)
      .lte('start_date', to)
      .order('start_date', { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as EventOpt[]))
  }, [type, fixedEventId])

  const num = (id: string) => {
    const n = Number((qty[id] ?? '').replace(',', '.'))
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }

  async function save() {
    setError(null)
    const occurred_at = day + 'T12:00:00Z'
    const base = { created_by: session?.user.id ?? null, occurred_at, note: note.trim() || null }
    let rows: Record<string, unknown>[]
    if (mode === 'inventory') {
      rows = flavors
        .filter((f) => (qty[f.id] ?? '') !== '')
        .map((f) => ({ ...base, flavor_id: f.id, cartons: num(f.id) - (stock?.[f.id] ?? 0), type: 'adjustment', note: base.note ?? 'Inventúra' }))
        .filter((r) => r.cartons !== 0)
      if (rows.length === 0) return setError('Stav sa nezmenil.')
    } else {
      if (type === 'event' && !eventId) return setError('Vyber event.')
      rows = flavors
        .filter((f) => num(f.id) > 0)
        .map((f) => ({
          ...base,
          flavor_id: f.id,
          cartons: MOVE_SIGN[type] * num(f.id),
          type,
          event_id: type === 'event' || type === 'returned' ? eventId || null : null,
          recipient: recipient.trim() || null,
        }))
      if (rows.length === 0) return setError('Zadaj aspoň jeden kartón.')
    }
    setSaving(true)
    const { error } = await supabase.from('carton_movements').insert(rows)
    setSaving(false)
    if (error) setError(error.message)
    else onDone(true)
  }

  const input = 'w-full h-11 px-3 rounded-lg border line bg-transparent'
  const pickEvent = (id: string) => {
    setEventId(id)
    const ev = events.find((e) => e.id === id)
    if (ev) setDay(startDay(ev))
  }

  return (
    <div className="grid gap-4">
      {mode === 'move' && !fixedEventId && (
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={'h-10 px-3 rounded-lg border line text-sm ' + (type === t ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
            >
              {MOVE_SIGN[t] > 0 ? '+ ' : '− '}{MOVE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {mode === 'move' && !fixedEventId && (type === 'event' || type === 'returned') && (
        <label className="grid gap-1 text-sm">
          <span className="muted">Event{type === 'returned' ? ' (voliteľné)' : ''}</span>
          <select className={input} value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">— vyber —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{fmtRange(e)} · {e.title}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-1 text-sm">
        <span className="muted">{mode === 'inventory' ? 'Skutočný stav v sklade (kartóny)' : 'Počet kartónov'}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {flavors.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded-lg border-2 pl-2 pr-1 py-1" style={flavorStyle(f)}>
              <span className="flex-1 font-semibold text-sm truncate">{flavorName(f)}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="w-16 h-9 px-2 rounded-md text-right bg-white/90 text-black font-bold"
                value={qty[f.id] ?? ''}
                onChange={(e) => setQty((q) => ({ ...q, [f.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          <span className="muted">Dátum</span>
          <input type="date" className={input} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        {mode === 'move' && type !== 'delivery' && (
          <label className="grid gap-1 text-sm">
            <span className="muted">Komu / od koho</span>
            <input className={input} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </label>
        )}
      </div>
      <label className="grid gap-1 text-sm">
        <span className="muted">Poznámka</span>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">
          {saving ? 'Ukladám…' : 'Uložiť'}
        </button>
        <button onClick={() => onDone(false)} className="h-11 px-4 rounded-lg border line">Zrušiť</button>
      </div>
    </div>
  )
}
