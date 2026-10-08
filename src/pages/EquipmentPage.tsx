import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Photo, PhotoUpload } from '../components/Photo'
import {
  type EqCategory, type EqStatus, type Equipment,
  CATEGORIES, CATEGORY_LABEL, EQ_COLUMNS, EQ_GROUPS, NEEDS_HOLDER, QUICK_STATUSES, STATUS_COLOR, STATUS_LABEL, eqCounts, eqGroup, eqIcon, splitName, type EqGroup,
} from '../lib/equipment'
import { durationDays, fmtRange } from '../lib/events'

type Usage = { events: number; days: number; last: { id: string; title: string; start_date: string; end_date: string | null } | null }
type UsageRow = {
  equipment_id: string
  quantity: number
  events: { id: string; title: string; start_date: string; end_date: string | null; status: string } | null
}
type SetRow = { id: string; name: string; vehicle_id: string | null; equipment_set_items: { equipment_id: string; quantity: number }[] }
type Vehicle = { id: string; name: string }

export function EquipmentPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<Equipment[]>([])
  const [usage, setUsage] = useState<Map<string, Usage>>(new Map())
  const [cat, setCat] = useState<EqGroup | 'all'>('all')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('equipment').select(EQ_COLUMNS).order('name'),
      supabase.from('event_equipment').select('equipment_id, quantity, events(id, title, start_date, end_date, status)').range(0, 9999),
    ]).then(([eq, ee]) => {
      if (!alive) return
      if (eq.error ?? ee.error) return setError((eq.error ?? ee.error)!.message)
      setItems(eq.data as Equipment[])
      // koľkokrát a koľko dní bola technika na eventoch (zrušené sa nerátajú)
      const u = new Map<string, Usage>()
      for (const r of ee.data as unknown as UsageRow[]) {
        if (!r.events || r.events.status === 'cancelled') continue
        const cur = u.get(r.equipment_id) ?? { events: 0, days: 0, last: null }
        cur.events++
        cur.days += durationDays(r.events)
        if (!cur.last || r.events.start_date > cur.last.start_date) cur.last = r.events
        u.set(r.equipment_id, cur)
      }
      setUsage(u)
    })
    return () => { alive = false }
  }, [reload])

  const hasIssue = (e: Equipment) => e.status !== 'ok' || e.qty_broken > 0 || e.qty_borrowed > 0
  const shown = useMemo(
    () => items.filter((e) => (isAdmin || e.active) && (cat === 'all' || eqGroup(e) === cat) && (!onlyIssues || hasIssue(e))),
    [items, cat, onlyIssues, isAdmin],
  )
  const issues = items.filter((e) => e.active && hasIssue(e)).length
  const refresh = () => setReload((r) => r + 1)

  return (
    <section className="flex flex-col gap-4 min-w-0">
      <div className="flex items-end gap-2">
        <h1 className="display text-4xl font-bold flex-1">Technika</h1>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)]">+ Nová</button>
        )}
      </div>
      {error && <p className="text-[var(--color-signal)]">{error}</p>}
      {adding && (
        <div className="card p-4">
          <h2 className="display text-xl font-bold mb-2">Nová technika</h2>
          <ItemForm onDone={(saved) => { setAdding(false); if (saved) refresh() }} />
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {(['all', ...EQ_GROUPS] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={'h-9 px-3 rounded-lg border line text-sm ' + (cat === c ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
          >
            {c === 'all' ? 'Všetko' : c}
          </button>
        ))}
        <label className="flex items-center gap-1 ml-auto text-sm muted">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          Mimo skladu / pokazené ({issues})
        </label>
      </div>

      <ul className="grid sm:grid-cols-2 gap-2">
        {shown.map((e) => (
          <li key={e.id} className={'card p-3 ' + (e.active ? '' : 'opacity-50')}>
            <ItemCard e={e} usage={usage.get(e.id)} isAdmin={isAdmin} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} onSaved={() => { setOpen(null); refresh() }} />
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="muted">Nič tu nie je.</p>}

      {isAdmin && <SetsAdmin items={items.filter((e) => e.active)} />}
    </section>
  )
}

function ItemCard({ e, usage, isAdmin, open, onToggle, onSaved }: {
  e: Equipment; usage?: Usage; isAdmin: boolean; open: boolean; onToggle: () => void; onSaved: () => void
}) {
  const [editAll, setEditAll] = useState(false)
  const [name] = splitName(e.name)
  const c = eqCounts(e)
  const lent = e.held_by && (NEEDS_HOLDER.includes(e.status) || e.qty_borrowed > 0)
  const cat = splitName(e.name)[1] ?? CATEGORY_LABEL[e.category]
  return (
    <>
      <div className="relative overflow-hidden rounded-md">
        <Photo
          kind="equipment-photos"
          path={e.photo_path}
          alt={e.name}
          className="absolute right-0 top-0 h-full w-[48%] object-contain object-right pointer-events-none"
          fallback={null}
        />
        <button onClick={isAdmin ? onToggle : undefined} className="relative w-full text-left grid gap-1.5 min-h-[88px]">
          <span className="block pr-[46%]">
            <span className="block font-semibold text-lg leading-tight">{name}</span>
            <span className="block text-[11px] uppercase tracking-wider muted">{cat}</span>
          </span>
          <span className="flex flex-wrap gap-1 text-xs">
            {c.free > 0 && <Badge color="#2e8b57">{c.free} voľné</Badge>}
            {c.borrowed > 0 && <Badge color="#b7791f">{c.borrowed} požičané</Badge>}
            {c.broken > 0 && <Badge color={STATUS_COLOR.broken}>{c.broken} pokazené</Badge>}
            {c.lost > 0 && <Badge color={STATUS_COLOR.lost}>{c.lost} stratené</Badge>}
          </span>
          {lent && (
            <span className="block rounded-lg border px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--color-sun) 28%, transparent)', borderColor: 'var(--color-sun)' }}>
              <b className="block">Požičané: {e.held_by}</b>
              {e.status_note && <span className="block text-xs">{e.status_note}</span>}
            </span>
          )}
          {!lent && e.held_by && <span className="block text-sm pr-[46%]">U: {e.held_by}</span>}
          {!lent && e.status_note && <span className="block text-xs pr-[46%]">{e.status_note}</span>}
          {e.notes && <span className="block text-xs muted pr-[46%]">{e.notes}</span>}
          <span className="block text-[11px] muted">
            {usage ? `${usage.events}× na evente · ${usage.days} dní` : 'Ešte nebola na evente'}
            {usage?.last && <> · <Link to="/event/$id" params={{ id: usage.last.id }} className="text-[var(--color-sky)]" onClick={(ev) => ev.stopPropagation()}>{fmtRange(usage.last)}</Link></>}
          </span>
          {isAdmin && <span className="block text-xs font-semibold muted">✎ Upraviť</span>}
        </button>
      </div>
      {open && !editAll && <QuickStatus e={e} onSaved={onSaved} onEditAll={() => setEditAll(true)} />}
      {open && editAll && <div className="mt-3 border-t line pt-3"><ItemForm item={e} onDone={(saved) => { setEditAll(false); if (saved) onSaved() }} /></div>}
    </>
  )
}

function QuickStatus({ e, onSaved, onEditAll }: { e: Equipment; onSaved: () => void; onEditAll: () => void }) {
  const [status, setStatus] = useState<EqStatus>(e.status)
  const [holder, setHolder] = useState(e.held_by ?? '')
  const [note, setNote] = useState(e.status_note ?? '')
  const [broken, setBroken] = useState(String(e.qty_broken))
  const [borrowed, setBorrowed] = useState(String(e.qty_borrowed))
  const [error, setError] = useState<string | null>(null)
  const multi = e.quantity > 1

  async function save() {
    const clamp = (s: string) => Math.max(0, Math.min(e.quantity, Math.trunc(Number(s) || 0)))
    const patch = {
      status,
      held_by: holder.trim() || null,
      status_note: note.trim() || null,
      // pri jednom kuse sa počty odvodia zo stavu
      qty_broken: multi ? clamp(broken) : status === 'broken' ? 1 : 0,
      qty_borrowed: multi ? clamp(borrowed) : NEEDS_HOLDER.includes(status) ? 1 : 0,
    }
    const { error } = await supabase.from('equipment').update(patch).eq('id', e.id)
    if (error) setError(error.message)
    else onSaved()
  }

  const input = 'w-full h-10 px-3 rounded-lg border line bg-transparent'
  return (
    <div className="mt-3 border-t line pt-3 grid gap-3">
      <div className="flex flex-wrap gap-1">
        {QUICK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="h-9 px-3 rounded-lg border-2 text-sm font-semibold"
            style={status === s ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s], color: '#fff' } : { borderColor: 'var(--line)' }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {multi && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm"><span className="muted">Pokazené ks (z {e.quantity})</span>
            <input type="number" inputMode="numeric" min={0} max={e.quantity} className={input} value={broken} onChange={(ev) => setBroken(ev.target.value)} /></label>
          <label className="grid gap-1 text-sm"><span className="muted">Požičané ks</span>
            <input type="number" inputMode="numeric" min={0} max={e.quantity} className={input} value={borrowed} onChange={(ev) => setBorrowed(ev.target.value)} /></label>
        </div>
      )}
      <label className="grid gap-1 text-sm"><span className="muted">Komu / kde je</span>
        <input className={input} value={holder} onChange={(ev) => setHolder(ev.target.value)} /></label>
      <label className="grid gap-1 text-sm"><span className="muted">Poznámka k stavu</span>
        <input className={input} value={note} onChange={(ev) => setNote(ev.target.value)} /></label>
      {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="h-10 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Uložiť</button>
        <button onClick={onEditAll} className="h-10 px-4 rounded-lg border line text-sm ml-auto">Upraviť položku</button>
      </div>
    </div>
  )
}

function ItemForm({ item, onDone }: { item?: Equipment; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    name: item?.name ?? '',
    category: item?.category ?? ('others' as EqCategory),
    quantity: String(item?.quantity ?? 1),
    notes: item?.notes ?? '',
    active: item?.active ?? true,
  })
  const [error, setError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(item?.photo_path ?? null)

  async function save() {
    if (!f.name.trim()) return setError('Zadaj názov.')
    const row = {
      name: f.name.trim(),
      category: f.category,
      quantity: Math.max(0, Math.trunc(Number(f.quantity) || 0)),
      notes: f.notes.trim() || null,
      active: f.active,
    }
    const { error } = item
      ? await supabase.from('equipment').update(row).eq('id', item.id)
      : await supabase.from('equipment').insert(row)
    if (error) setError(error.message)
    else onDone(true)
  }

  const input = 'w-full h-10 px-3 rounded-lg border line bg-transparent'
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm"><span className="muted">Názov</span>
        <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="napr. Cooler: Small" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm"><span className="muted">Kategória</span>
          <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as EqCategory })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select></label>
        <label className="grid gap-1 text-sm"><span className="muted">Počet kusov</span>
          <input type="number" inputMode="numeric" min={0} className={input} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></label>
      </div>
      <label className="grid gap-1 text-sm"><span className="muted">Poznámka (model, rozmer…)</span>
        <input className={input} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      {item && (
        <div className="flex items-center gap-3">
          <Photo kind="equipment-photos" path={photo} alt="" className="w-16 h-16 rounded-lg object-cover border line" fallback={<span className="w-16 h-16 rounded-lg border line grid place-items-center text-3xl">{eqIcon(item)}</span>} />
          <PhotoUpload
            kind="equipment-photos"
            id={item.id}
            label={photo ? 'Zmeniť fotku' : 'Nahrať fotku'}
            onUploaded={async (path) => {
              const { error } = await supabase.from('equipment').update({ photo_path: path }).eq('id', item.id)
              if (error) throw new Error(error.message)
              setPhoto(path)
            }}
          />
        </div>
      )}
      {item && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Aktívna (keď už technika nie je, odškrtni – história ostane)
        </label>
      )}
      {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="h-10 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Uložiť</button>
        <button onClick={() => onDone(false)} className="h-10 px-4 rounded-lg border line">Zrušiť</button>
      </div>
    </div>
  )
}

function SetsAdmin({ items }: { items: Equipment[] }) {
  const [sets, setSets] = useState<SetRow[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [edit, setEdit] = useState<{ id?: string; name: string; vehicle_id: string; qty: Record<string, string> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('equipment_sets').select('id, name, vehicle_id, equipment_set_items(equipment_id, quantity)').order('name'),
      supabase.from('vehicles').select('id, name').eq('active', true).order('sort_order'),
    ]).then(([s, v]) => {
      setSets((s.data ?? []) as SetRow[])
      setVehicles((v.data ?? []) as Vehicle[])
    })
  }, [reload])

  const eqName = (id: string) => items.find((e) => e.id === id)?.name ?? '?'

  async function save() {
    if (!edit) return
    if (!edit.name.trim()) return setError('Zadaj názov sady.')
    const row = { name: edit.name.trim(), vehicle_id: edit.vehicle_id || null }
    let setId = edit.id
    if (setId) {
      const { error } = await supabase.from('equipment_sets').update(row).eq('id', setId)
      if (error) return setError(error.message)
    } else {
      const { data, error } = await supabase.from('equipment_sets').insert(row).select('id').single()
      if (error) return setError(error.message)
      setId = data.id
    }
    // položky sady: zmaž a vlož nanovo (sada je len šablóna)
    const del = await supabase.from('equipment_set_items').delete().eq('set_id', setId!)
    if (del.error) return setError(del.error.message)
    const rows = Object.entries(edit.qty)
      .map(([equipment_id, q]) => ({ set_id: setId!, equipment_id, quantity: Math.trunc(Number(q) || 0) }))
      .filter((r) => r.quantity > 0)
    if (rows.length) {
      const { error } = await supabase.from('equipment_set_items').insert(rows)
      if (error) return setError(error.message)
    }
    setEdit(null)
    setError(null)
    setReload((r) => r + 1)
  }

  async function removeSet(id: string) {
    if (!confirm('Zmazať sadu? Technika na eventoch ostane.')) return
    await supabase.from('equipment_sets').delete().eq('id', id)
    setEdit(null)
    setReload((r) => r + 1)
  }

  const input = 'w-full h-10 px-3 rounded-lg border line bg-transparent'
  return (
    <div className="card p-4 min-w-0">
      <h2 className="display text-xl font-bold">Sady techniky</h2>
      <p className="text-xs muted mb-2">Keď na evente vyberieš auto, jeho sada sa pridá automaticky.</p>
      <ul className="grid gap-2">
        {sets.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setEdit({ id: s.id, name: s.name, vehicle_id: s.vehicle_id ?? '', qty: Object.fromEntries(s.equipment_set_items.map((i) => [i.equipment_id, String(i.quantity)])) })}
              className="w-full text-left text-sm"
            >
              <span className="font-semibold">{s.name}</span>
              <span className="muted"> · {vehicles.find((v) => v.id === s.vehicle_id)?.name ?? 'bez auta'}</span>
              <span className="block muted text-xs">{s.equipment_set_items.map((i) => `${i.quantity}× ${eqName(i.equipment_id)}`).join(', ') || 'prázdna'}</span>
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="grid gap-3 mt-4 border-t line pt-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm"><span className="muted">Názov</span>
              <input className={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="grid gap-1 text-sm"><span className="muted">Auto</span>
              <select className={input} value={edit.vehicle_id} onChange={(e) => setEdit({ ...edit, vehicle_id: e.target.value })}>
                <option value="">— žiadne —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select></label>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="muted">Technika v sade (počet kusov)</span>
            <ul className="grid gap-1 max-h-72 overflow-y-auto">
              {items.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{e.name}</span>
                  <input
                    type="number" inputMode="numeric" min={0} placeholder="0"
                    className="w-16 h-9 px-2 rounded-md border line bg-transparent text-right"
                    value={edit.qty[e.id] ?? ''}
                    onChange={(ev) => setEdit({ ...edit, qty: { ...edit.qty, [e.id]: ev.target.value } })}
                  />
                </li>
              ))}
            </ul>
          </div>
          {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} className="h-10 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Uložiť</button>
            <button onClick={() => { setEdit(null); setError(null) }} className="h-10 px-4 rounded-lg border line">Zrušiť</button>
            {edit.id && <button onClick={() => removeSet(edit.id!)} className="h-10 px-3 ml-auto text-sm text-[var(--color-signal)]">Zmazať</button>}
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit({ name: '', vehicle_id: '', qty: {} })} className="mt-3 h-10 px-4 rounded-lg border line text-sm">+ Nová sada</button>
      )}
    </div>
  )
}

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded font-semibold text-white" style={{ background: color }}>{children}</span>
  )
}
