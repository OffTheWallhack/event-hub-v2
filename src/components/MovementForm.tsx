import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Chips, ErrorText, Field } from './ui'
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

  const pickEvent = (id: string) => {
    setEventId(id)
    const ev = events.find((e) => e.id === id)
    if (ev) setDay(startDay(ev))
  }

  return (
    <div className="form">
      {mode === 'move' && !fixedEventId && (
        <div className="field">
          <span className="field-label">Typ pohybu</span>
          <Chips
            options={TYPES.map((t) => [t, `${MOVE_SIGN[t] > 0 ? '+' : '−'} ${MOVE_LABEL[t]}`] as const)}
            isOn={(t) => type === t}
            onPick={setType}
          />
        </div>
      )}

      {mode === 'move' && !fixedEventId && (type === 'event' || type === 'returned') && (
        <Field label={`Event${type === 'returned' ? ' (voliteľné)' : ''}`}>
          <select className="input" value={eventId} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">— vyber —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{fmtRange(e)} · {e.title}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="field">
        <span className="field-label">{mode === 'inventory' ? 'Skutočný stav v sklade (kartóny)' : 'Počet kartónov'}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {flavors.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded-[var(--ctl-r)] border-2 pl-3 pr-1.5 py-1.5" style={flavorStyle(f)}>
              <span className="flex-1 font-semibold text-sm truncate">{flavorName(f)}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="w-16 h-9 px-2 rounded-[calc(var(--ctl-r)*.7)] text-right bg-white/90 text-black font-bold text-base"
                value={qty[f.id] ?? ''}
                onChange={(e) => setQty((q) => ({ ...q, [f.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dátum"><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        {mode === 'move' && type !== 'delivery' && (
          <Field label="Komu / od koho"><input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
        )}
      </div>
      <Field label="Poznámka"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>

      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Ukladám…' : 'Uložiť'}</button>
        <button onClick={() => onDone(false)} className="btn btn-quiet">Zrušiť</button>
      </div>
    </div>
  )
}
