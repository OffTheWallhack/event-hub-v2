import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Car, Check, Plus, Trash2, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Empty, ErrorText, Field, Seg } from './ui'
import {
  type Todo, type TodoScope, type TodoStatus, type VehicleOpt,
  SCOPE_LABEL, STATUS_LABEL, TODO_COLUMNS, fromLocalInput, toLocalInput,
} from '../lib/todos'
import { fmtDay, todayLocal } from '../lib/events'

type Props = {
  vehicles: VehicleOpt[]
  isAdmin: boolean
  /** pevný rozsah (stránka Garáž); bez neho sa ukážu všetky a dá sa filtrovať */
  scope?: TodoScope
  vehicleId?: string
  onChanged?: () => void
}

type Filter = 'open' | 'done' | 'all'

const GROUPS = ['Po termíne', 'Dnes', 'Neskôr', 'Bez termínu'] as const
const groupOf = (t: Todo, today: string): (typeof GROUPS)[number] =>
  !t.due_date ? 'Bez termínu' : t.due_date < today ? 'Po termíne' : t.due_date === today ? 'Dnes' : 'Neskôr'

/** Kompaktný zoznam úloh. Klepnutím na krúžok sa úloha uzavrie, klepnutím na text sa otvorí úprava. */
export function TodoList({ vehicles, isAdmin, scope, vehicleId, onChanged }: Props) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [scopeFilter, setScopeFilter] = useState<TodoScope | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let q = supabase.from('todos').select(TODO_COLUMNS).order('created_at', { ascending: false }).range(0, 999)
    if (scope) q = q.eq('scope', scope)
    if (vehicleId) q = q.eq('vehicle_id', vehicleId)
    q.then(({ data, error }) => {
      if (error) setError(error.message)
      else setTodos(data as Todo[])
    })
  }, [scope, vehicleId, reload])

  const refresh = () => { setReload((r) => r + 1); onChanged?.() }
  const vName = (id: string | null) => vehicles.find((v) => v.id === id)?.name
  const today = todayLocal()

  async function setStatus(t: Todo, status: TodoStatus) {
    setTodos((l) => l.map((x) => (x.id === t.id ? { ...x, status } : x)))
    const { error } = await supabase.from('todos').update({ status, ...(status === 'done' ? { remind_at: null } : {}) }).eq('id', t.id)
    if (error) { setError(error.message); setReload((r) => r + 1) } else onChanged?.()
  }

  const shown = useMemo(
    () => todos.filter((t) => (filter === 'all' || (filter === 'done' ? t.status === 'done' : t.status !== 'done')) && (scope || scopeFilter === 'all' || t.scope === scopeFilter)),
    [todos, filter, scope, scopeFilter],
  )
  const groups = useMemo(() => {
    if (filter === 'done') return [['Hotové', shown] as const]
    const open = shown.filter((t) => t.status !== 'done')
    const done = shown.filter((t) => t.status === 'done')
    const by = new Map<string, Todo[]>()
    for (const t of open) by.set(groupOf(t, today), [...(by.get(groupOf(t, today)) ?? []), t])
    for (const l of by.values()) l.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    const out: (readonly [string, Todo[]])[] = GROUPS.filter((g) => by.has(g)).map((g) => [g, by.get(g)!] as const)
    if (done.length) out.push(['Hotové', done] as const)
    return out
  }, [shown, filter, today])

  const counts = { open: todos.filter((t) => t.status !== 'done').length, done: todos.filter((t) => t.status === 'done').length }

  return (
    <div className="grid gap-4 min-w-0">
      {isAdmin && <QuickAdd vehicles={vehicles} scope={scope} vehicleId={vehicleId} onAdded={refresh} onError={setError} />}

      <div className="grid gap-2">
        <Seg
          options={[['open', `Otvorené ${counts.open}`], ['done', `Hotové ${counts.done}`], ['all', 'Všetko']] as const}
          value={filter}
          onChange={setFilter}
        />
        {!scope && (
          <div className="chips-scroll">
            {(['all', 'general', 'garage', 'vehicle'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScopeFilter(s)} aria-pressed={scopeFilter === s} className="chip">{s === 'all' ? 'Všetky' : SCOPE_LABEL[s]}</button>
            ))}
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      {groups.length === 0 ? (
        <Empty>Nič tu nie je.</Empty>
      ) : (
        groups.map(([name, list]) => (
          <div key={name}>
            <h3 className={'eyebrow mb-1.5 px-1 ' + (name === 'Po termíne' ? '!text-[var(--danger)]' : '')}>{name} · {list.length}</h3>
            <ul className="card list overflow-hidden">
              {list.map((t) => (
                <li key={t.id} className={open === t.id ? 'bg-[var(--fill)]' : ''}>
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <button
                      disabled={!isAdmin}
                      onClick={() => setStatus(t, t.status === 'done' ? 'open' : 'done')}
                      className={'mt-px w-6 h-6 shrink-0 rounded-full border-2 grid place-items-center ' + (t.status === 'done' ? 'bg-[var(--ok)] border-[var(--ok)] text-[var(--bg)]' : t.status === 'in_progress' ? 'border-[var(--warn)]' : 'border-[var(--muted)] opacity-70')}
                      aria-label={t.status === 'done' ? 'Znovu otvoriť' : 'Hotovo'}
                    >
                      {t.status === 'done' ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : t.status === 'in_progress' ? <span className="w-2.5 h-2.5 rounded-full bg-[var(--warn)]" /> : null}
                    </button>
                    <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex-1 min-w-0 text-left">
                      <span className={'block leading-snug ' + (t.status === 'done' ? 'line-through muted' : '') + (open === t.id ? '' : ' line-clamp-2')}>{t.text}</span>
                      {(t.scope !== 'general' || t.due_date || (t.remind_at && t.status !== 'done')) && (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs muted mt-1">
                          {t.scope === 'vehicle' && <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" aria-hidden />{vName(t.vehicle_id) ?? 'auto'}</span>}
                          {t.scope === 'garage' && <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" aria-hidden />Garáž</span>}
                          {t.due_date && <span className={'inline-flex items-center gap-1 ' + (t.status !== 'done' && t.due_date < today ? 'text-[var(--danger)] font-semibold' : '')}><CalendarDays className="w-3.5 h-3.5" aria-hidden />{fmtDay(t.due_date)}</span>}
                          {t.remind_at && t.status !== 'done' && <span className="inline-flex items-center gap-1"><Bell className="w-3.5 h-3.5" aria-hidden />{new Date(t.remind_at).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                        </span>
                      )}
                    </button>
                  </div>
                  {open === t.id && isAdmin && <div className="px-3 pb-3"><Edit t={t} vehicles={vehicles} fixed={!!scope} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); refresh() }} onError={setError} /></div>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

function QuickAdd({ vehicles, scope, vehicleId, onAdded, onError }: {
  vehicles: VehicleOpt[]; scope?: TodoScope; vehicleId?: string; onAdded: () => void; onError: (m: string) => void
}) {
  const [text, setText] = useState('')
  const [sc, setSc] = useState<TodoScope>(scope ?? 'general')
  const [veh, setVeh] = useState(vehicleId ?? '')
  const [busy, setBusy] = useState(false)

  async function add() {
    const t = text.trim()
    if (!t) return
    if (sc === 'vehicle' && !(vehicleId ?? veh)) return onError('Vyber auto.')
    setBusy(true)
    const { error } = await supabase.from('todos').insert({ text: t, scope: sc, vehicle_id: sc === 'vehicle' ? vehicleId ?? veh : null })
    setBusy(false)
    if (error) return onError(error.message)
    setText('')
    onAdded()
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Nová úloha…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={busy || !text.trim()} className="btn btn-primary btn-icon shrink-0" aria-label="Pridať úlohu"><Plus aria-hidden /></button>
      </div>
      {!scope && text.trim() !== '' && (
        <div className="flex gap-2">
          <Seg className="flex-1" options={(['general', 'garage', 'vehicle'] as const).map((s) => [s, SCOPE_LABEL[s]] as const)} value={sc} onChange={setSc} />
          {sc === 'vehicle' && (
            <select className="input !w-32 !h-10" value={veh} onChange={(e) => setVeh(e.target.value)}>
              <option value="">— auto —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

function Edit({ t, vehicles, fixed, onClose, onSaved, onError }: {
  t: Todo; vehicles: VehicleOpt[]; fixed: boolean; onClose: () => void; onSaved: () => void; onError: (m: string) => void
}) {
  const [f, setF] = useState({
    text: t.text, status: t.status, scope: t.scope, vehicle_id: t.vehicle_id ?? '',
    due_date: t.due_date ?? '', remind: toLocalInput(t.remind_at),
  })

  async function save() {
    if (!f.text.trim()) return onError('Zadaj text.')
    if (f.scope === 'vehicle' && !f.vehicle_id) return onError('Vyber auto.')
    const { error } = await supabase.from('todos').update({
      text: f.text.trim(), status: f.status, scope: f.scope,
      vehicle_id: f.scope === 'vehicle' ? f.vehicle_id : null,
      due_date: f.due_date || null, remind_at: f.status === 'done' ? null : fromLocalInput(f.remind),
    }).eq('id', t.id)
    if (error) onError(error.message)
    else onSaved()
  }

  async function remove() {
    if (!confirm('Zmazať úlohu?')) return
    const { error } = await supabase.from('todos').delete().eq('id', t.id)
    if (error) onError(error.message)
    else onSaved()
  }

  return (
    <div className="form pt-1">
      <textarea rows={3} className="input" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <Seg options={(['open', 'in_progress', 'done'] as const).map((s) => [s, STATUS_LABEL[s]] as const)} value={f.status} onChange={(s) => setF({ ...f, status: s })} />
      {!fixed && (
        <div className="flex gap-2">
          <select className="input" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as TodoScope })}>
            {(['general', 'garage', 'vehicle'] as const).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
          </select>
          {f.scope === 'vehicle' && (
            <select className="input" value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
              <option value="">— auto —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Termín"><input type="date" className="input" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Pripomienka"><input type="datetime-local" className="input" value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })} /></Field>
      </div>
      <div className="form-actions">
        <button onClick={save} className="btn btn-primary">Uložiť</button>
        <button onClick={onClose} className="btn btn-quiet">Zavrieť</button>
        <button onClick={remove} className="btn btn-danger ml-auto"><Trash2 aria-hidden />Zmazať</button>
      </div>
    </div>
  )
}
