import { useEffect, useState } from 'react'
import { Car, Plus, Wrench, X } from 'lucide-react'
import { Empty, ErrorText, Field, PageHeader, Section } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TodoList } from '../components/TodoList'
import { Photo, PhotoUpload } from '../components/Photo'
import { GARAGE_VEHICLES, type VehicleOpt } from '../lib/todos'
import { fmtDay, todayLocal } from '../lib/events'

type Vehicle = VehicleOpt & { full_name: string | null; equipment_notes: string | null; is_generic: boolean; image_path: string | null; custom_photo_path: string | null }
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
      supabase.from('vehicles').select('id, name, full_name, equipment_notes, is_generic, image_path, custom_photo_path').eq('active', true).order('sort_order'),
      supabase.from('todos').select('scope, vehicle_id').neq('status', 'done').range(0, 999),
    ]).then(([v, t]) => {
      const list = ((v.data ?? []) as Vehicle[]).filter((x) => GARAGE_VEHICLES.includes(x.name))
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
    <div className="page">
      <PageHeader title="Garáž" />

      <div className="chips-scroll">
        {[...vehicles.map((v) => ({ id: v.id, name: v.name, garage: false })), { id: GARAGE, name: 'Garáž', garage: true }].map((v) => (
          <button key={v.id} type="button" onClick={() => setSel(v.id)} aria-pressed={sel === v.id} className="chip">
            {v.garage ? <Wrench className="w-4 h-4" aria-hidden /> : <Car className="w-4 h-4" aria-hidden />}
            {v.name}{open[v.id] ? <span className="count">{open[v.id]}</span> : null}
          </button>
        ))}
      </div>

      {sel === GARAGE ? (
        <Section title="Úlohy v garáži">
          <TodoList vehicles={vehicles} isAdmin={isAdmin} scope="garage" onChanged={refresh} />
        </Section>
      ) : vehicle ? (
        <>
          <Section>
            <Photo
              kind="vehicle-photos"
              path={vehicle.custom_photo_path}
              alt={vehicle.name}
              className="w-full max-h-56 object-contain rounded-[var(--ctl-r)] mb-3"
            />
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="section-title !text-2xl">{vehicle.name}</h2>
                {vehicle.full_name && <p className="text-sm muted">{vehicle.full_name}</p>}
              </div>
              {isAdmin && (
                <PhotoUpload
                  kind="vehicle-photos"
                  id={vehicle.id}
                  label={vehicle.custom_photo_path ? 'Zmeniť fotku' : 'Nahrať fotku'}
                  onUploaded={async (path) => {
                    const { error } = await supabase.from('vehicles').update({ custom_photo_path: path }).eq('id', vehicle.id)
                    if (error) throw new Error(error.message)
                    refresh()
                  }}
                />
              )}
            </div>
            <Notes key={vehicle.id} v={vehicle} isAdmin={isAdmin} />
          </Section>

          <Section title="Úlohy">
            <TodoList vehicles={vehicles} isAdmin={isAdmin} scope="vehicle" vehicleId={vehicle.id} onChanged={refresh} />
          </Section>

          <Services key={vehicle.id} vehicleId={vehicle.id} isAdmin={isAdmin} />
        </>
      ) : null}
    </div>
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
  if (!isAdmin) return text ? <p className="text-sm whitespace-pre-wrap mt-4">{text}</p> : null
  return (
    <Field className="mt-4" label={<>Poznámky k autu (výbava, rozmery, CCS…) {saved && <b className="text-[var(--ok)]">· uložené</b>}</>}>
      <textarea rows={5} className="input" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
    </Field>
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

  return (
    <Section title="Servisy a opravy">
      {isAdmin && (
        <div className="grid gap-2 mb-3 min-w-0">
          <input className="input" placeholder="Čo sa robilo…" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            <button onClick={add} disabled={!desc.trim()} className="btn btn-primary"><Plus aria-hidden />Pridať</button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>Zatiaľ žiadne záznamy.</Empty>
      ) : (
        <ul className="list text-sm">
          {rows.map((s) => (
            <li key={s.id} className="row !py-2">
              <span className="muted w-20 shrink-0 text-xs num">{s.date ? fmtDay(s.date) : '–'}</span>
              <span className="flex-1 min-w-0 break-words">{s.description}</span>
              {isAdmin && <button onClick={() => remove(s)} className="btn btn-sm btn-icon btn-quiet muted -mr-2" aria-label="Zmazať"><X aria-hidden /></button>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
