import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
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
    <div className="grid gap-3 min-w-0">
      {isAdmin && <QuickAdd vehicles={vehicles} scope={scope} vehicleId={vehicleId} onAdded={refresh} onError={setError} />}

      <div className="flex flex-wrap items-center gap-1">
        {([['open', `Otvorené ${counts.open}`], ['done', `Hotové ${counts.done}`], ['all', 'Všetko']] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} className={chip(filter === f)}>{label}</button>
        ))}
        {!scope && (
          <span className="flex gap-1 ml-auto">
            {(['all', 'general', 'garage', 'vehicle'] as const).map((s) => (
              <button key={s} onClick={() => setScopeFilter(s)} className={chip(scopeFilter === s)}>{s === 'all' ? 'Všetky' : SCOPE_LABEL[s]}</button>
            ))}
          </span>
        )}
      </div>

      {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}

      {groups.length === 0 ? (
        <p className="muted text-sm">Nič tu nie je.</p>
      ) : (
        groups.map(([name, list]) => (
          <div key={name}>
            <h3 className={'text-xs font-semibold uppercase tracking-wider mb-1 ' + (name === 'Po termíne' ? 'text-[var(--color-signal)]' : 'muted')}>{name} · {list.length}</h3>
            <ul className="card divide-y line">
              {list.map((t) => (
                <li key={t.id} className="px-3 py-2">
                  <div className="flex items-start gap-3">
                    <button
                      disabled={!isAdmin}
                      onClick={() => setStatus(t, t.status === 'done' ? 'open' : 'done')}
                      className={'mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 grid place-items-center text-xs ' + (t.status === 'done' ? 'bg-green-700 border-green-700 text-white' : t.status === 'in_progress' ? 'border-[var(--color-amber)] text-[var(--color-amber)]' : 'border-[var(--muted)]')}
                      aria-label={t.status === 'done' ? 'Znovu otvoriť' : 'Hotovo'}
                    >
                      {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◐' : ''}
                    </button>
                    <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex-1 min-w-0 text-left">
                      <span className={'block text-sm leading-snug ' + (t.status === 'done' ? 'line-through muted' : '') + (open === t.id ? '' : ' line-clamp-2')}>{t.text}</span>
                      <span className="flex flex-wrap gap-x-2 text-[11px] muted mt-0.5">
                        {t.scope === 'vehicle' && <span>🚐 {vName(t.vehicle_id) ?? 'auto'}</span>}
                        {t.scope === 'garage' && <span>🔧 Garáž</span>}
                        {t.due_date && <span className={t.status !== 'done' && t.due_date < today ? 'text-[var(--color-signal)] font-semibold' : ''}>📅 {fmtDay(t.due_date)}</span>}
                        {t.remind_at && t.status !== 'done' && <span>🔔 {new Date(t.remind_at).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                      </span>
                    </button>
                  </div>
                  {open === t.id && isAdmin && <Edit t={t} vehicles={vehicles} fixed={!!scope} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); refresh() }} onError={setError} />}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

const chip = (on: boolean) =>
  'h-8 px-3 rounded-lg border line text-xs font-medium ' + (on ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')

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

  const sel = 'h-10 px-2 rounded-lg border line bg-transparent text-sm'
  return (
    <div className="card p-2 grid gap-2">
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 h-10 px-3 rounded-lg border line bg-transparent"
          placeholder="Nová úloha…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={busy || !text.trim()} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-50">Pridať</button>
      </div>
      {!scope && (
        <div className="flex gap-2">
          <select className={sel} value={sc} onChange={(e) => setSc(e.target.value as TodoScope)}>
            {(['general', 'garage', 'vehicle'] as const).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
          </select>
          {sc === 'vehicle' && (
            <select className={sel + ' flex-1'} value={veh} onChange={(e) => setVeh(e.target.value)}>
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
  const input = 'w-full h-10 px-3 rounded-lg border line bg-transparent text-sm'

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
    <div className="mt-3 grid gap-2 border-t line pt-3">
      <textarea rows={3} className={input + ' h-auto py-2'} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="flex gap-1">
        {(['open', 'in_progress', 'done'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setF({ ...f, status: s })} className={chip(f.status === s) + ' flex-1'}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      {!fixed && (
        <div className="flex gap-2">
          <select className={input} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as TodoScope })}>
            {(['general', 'garage', 'vehicle'] as const).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
          </select>
          {f.scope === 'vehicle' && (
            <select className={input} value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
              <option value="">— auto —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs"><span className="muted">Termín</span>
          <input type="date" className={input} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
        <label className="grid gap-1 text-xs"><span className="muted">Pripomienka 🔔</span>
          <input type="datetime-local" className={input} value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })} /></label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="h-10 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Uložiť</button>
        <button onClick={onClose} className="h-10 px-4 rounded-lg border line text-sm">Zavrieť</button>
        <button onClick={remove} className="h-10 px-3 ml-auto text-sm text-[var(--color-signal)]">Zmazať</button>
      </div>
    </div>
  )
}
