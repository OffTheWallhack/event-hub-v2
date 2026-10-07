import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TodoList } from '../components/TodoList'
import type { VehicleOpt } from '../lib/todos'
import { fmtDay, todayLocal } from '../lib/events'

type Vehicle = VehicleOpt & { full_name: string | null; equipment_notes: string | null; is_generic: boolean }
type Service = { id: string; date: string | null; description: string }

const GARAGE = 'garage'

export function Garage() {
  const { isAdmin } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [open, setOpen] = useState<Record<string, number>>({})
  const [sel, setSel] = useState<string>('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, name, full_name, equipment_notes, is_generic').eq('active', true).order('sort_order'),
      supabase.from('todos').select('scope, vehicle_id').neq('status', 'done').range(0, 999),
    ]).then(([v, t]) => {
      const list = (v.data ?? []) as Vehicle[]
      setVehicles(list)
      const c: Record<string, number> = {}
      for (const r of (t.data ?? []) as { scope: string; vehicle_id: string | null }[]) {
        const k = r.scope === 'garage' ? GARAGE : r.vehicle_id
        if (k) c[k] = (c[k] ?? 0) + 1
      }
      setOpen(c)
      setSel((s) => s || list[0]?.id || GARAGE)
    })
  }, [reload])

  const vehicle = vehicles.find((v) => v.id === sel)
  const refresh = () => setReload((r) => r + 1)

  return (
    <section className="flex flex-col gap-4 min-w-0">
      <h1 className="display text-4xl font-bold">Garáž</h1>

      <div className="flex flex-wrap gap-1">
        {[...vehicles.map((v) => ({ id: v.id, name: v.name })), { id: GARAGE, name: '🔧 Garáž' }].map((v) => (
          <button
            key={v.id}
            onClick={() => setSel(v.id)}
            className={'h-10 px-3 rounded-lg border line text-sm ' + (sel === v.id ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
          >
            {v.name}{open[v.id] ? <span className="ml-1 text-xs opacity-70">{open[v.id]}</span> : null}
          </button>
        ))}
      </div>

      {sel === GARAGE ? (
        <div className="card p-4">
          <h2 className="display text-xl font-bold mb-2">Úlohy v garáži</h2>
          <TodoList vehicles={vehicles} isAdmin={isAdmin} scope="garage" onChanged={refresh} />
        </div>
      ) : vehicle ? (
        <>
          <div className="card p-4 min-w-0">
            <h2 className="display text-2xl font-bold">{vehicle.name}</h2>
            {vehicle.full_name && <p className="text-sm muted">{vehicle.full_name}</p>}
            <Notes key={vehicle.id} v={vehicle} isAdmin={isAdmin} />
          </div>

          <div className="card p-4">
            <h2 className="display text-xl font-bold mb-2">Úlohy</h2>
            <TodoList vehicles={vehicles} isAdmin={isAdmin} scope="vehicle" vehicleId={vehicle.id} onChanged={refresh} />
          </div>

          <Services key={vehicle.id} vehicleId={vehicle.id} isAdmin={isAdmin} />
        </>
      ) : null}
    </section>
  )
}

function Notes({ v, isAdmin }: { v: Vehicle; isAdmin: boolean }) {
  const [text, setText] = useState(v.equipment_notes ?? '')
  const [saved, setSaved] = useState(false)
  async function save() {
    if (text === (v.equipment_notes ?? '')) return
    const { error } = await supabase.from('vehicles').update({ equipment_notes: text.trim() || null }).eq('id', v.id)
    if (!error) { v.equipment_notes = text.trim() || null; setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }
  if (!isAdmin) return text ? <p className="text-sm whitespace-pre-wrap mt-3">{text}</p> : null
  return (
    <label className="grid gap-1 mt-3 text-sm">
      <span className="muted">Poznámky k autu (výbava, rozmery, CCS…) {saved && <b className="text-green-700">· uložené</b>}</span>
      <textarea rows={5} className="w-full p-2 rounded-lg border line bg-transparent text-sm" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
    </label>
  )
}

function Services({ vehicleId, isAdmin }: { vehicleId: string; isAdmin: boolean }) {
  const [rows, setRows] = useState<Service[]>([])
  const [date, setDate] = useState(todayLocal())
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    supabase.from('vehicle_services').select('id, date, description').eq('vehicle_id', vehicleId).order('date', { ascending: false, nullsFirst: false })
      .then(({ data }) => setRows((data ?? []) as Service[]))
  }, [vehicleId, reload])

  async function add() {
    if (!desc.trim()) return
    const { error } = await supabase.from('vehicle_services').insert({ vehicle_id: vehicleId, date: date || null, description: desc.trim() })
    if (error) return setError(error.message)
    setDesc(''); setError(null)
    setReload((r) => r + 1)
  }

  async function remove(s: Service) {
    if (!confirm('Zmazať záznam o servise?')) return
    await supabase.from('vehicle_services').delete().eq('id', s.id)
    setReload((r) => r + 1)
  }

  const input = 'h-10 px-3 rounded-lg border line bg-transparent text-sm'
  return (
    <div className="card p-4 min-w-0">
      <h2 className="display text-xl font-bold mb-2">Servisy a opravy</h2>
      {isAdmin && (
        <div className="grid gap-2 mb-3 min-w-0">
          <input className={input + ' w-full min-w-0'} placeholder="Čo sa robilo…" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input type="date" className={input + ' min-w-0'} value={date} onChange={(e) => setDate(e.target.value)} />
            <button onClick={add} disabled={!desc.trim()} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-50">Pridať</button>
          </div>
          {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="muted text-sm">Zatiaľ žiadne záznamy.</p>
      ) : (
        <ul className="divide-y line text-sm">
          {rows.map((s) => (
            <li key={s.id} className="py-2 flex gap-2 items-baseline">
              <span className="muted w-20 shrink-0 text-xs">{s.date ? fmtDay(s.date) : '–'}</span>
              <span className="flex-1 min-w-0 break-words">{s.description}</span>
              {isAdmin && <button onClick={() => remove(s)} className="muted px-1" aria-label="Zmazať">×</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
