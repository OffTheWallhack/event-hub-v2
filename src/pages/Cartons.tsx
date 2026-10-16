import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { Empty, ErrorText, Field, PageHeader, Section } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { MovementForm } from '../components/MovementForm'
import { Photo, PhotoUpload } from '../components/Photo'
import { type Flavor, type Movement, MOVE_LABEL, flavorName, flavorStyle } from '../lib/cartons'
import { DEPT_LABEL, type Department, fmtDay, todayLocal } from '../lib/events'

type Panel = null | 'move' | 'inventory'

export function Cartons() {
  const { isAdmin } = useAuth()
  const [flavors, setFlavors] = useState<Flavor[]>([])
  const [stock, setStock] = useState<Record<string, number>>({})
  const [moves, setMoves] = useState<Movement[]>([])
  const [year, setYear] = useState(Number(todayLocal().slice(0, 4)))
  const [panel, setPanel] = useState<Panel>(null)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('flavors').select('id, name, label, color_bg, color_text, color_border, sort_order, active, photo_path').order('sort_order').order('name'),
      supabase.from('carton_stock').select('flavor_id, cartons'),
      supabase
        .from('carton_movements')
        .select('id, flavor_id, cartons, type, event_id, recipient, note, counts_in_stock, occurred_at, events(id, title, departments)')
        .gte('occurred_at', `${year}-01-01`)
        .lt('occurred_at', `${year + 1}-01-01`)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false }),
    ]).then(([f, s, m]) => {
      if (!alive) return
      const err = f.error ?? s.error ?? m.error
      if (err) return setError(err.message)
      setFlavors(f.data as Flavor[])
      setStock(Object.fromEntries((s.data ?? []).map((r) => [r.flavor_id, r.cartons])))
      setMoves(m.data as unknown as Movement[])
    })
    return () => { alive = false }
  }, [year, reload])

  const byId = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors])
  const active = flavors.filter((f) => f.active)
  // v sklade ukáž aktívne príchute a aj neaktívne, ak ich ešte niečo zostalo
  const tiles = flavors.filter((f) => f.active || (stock[f.id] ?? 0) !== 0)
  const total = tiles.reduce((s, f) => s + (stock[f.id] ?? 0), 0)

  async function remove(m: Movement) {
    const f = byId.get(m.flavor_id)
    if (!confirm(`Zmazať pohyb ${m.cartons > 0 ? '+' : ''}${m.cartons} ${f ? flavorName(f) : ''} (${MOVE_LABEL[m.type]})?`)) return
    const { error } = await supabase.from('carton_movements').delete().eq('id', m.id)
    if (error) setError(error.message)
    else setReload((r) => r + 1)
  }

  const done = (saved: boolean) => { setPanel(null); if (saved) setReload((r) => r + 1) }
  const list = showAll ? moves : moves.slice(0, 30)

  return (
    <div className="page">
      <PageHeader
        title="Kartóny"
        sub={<>Spolu v sklade: <b className="text-[var(--fg)] num">{total}</b></>}
        actions={isAdmin && panel === null && (
          <>
            <button onClick={() => setPanel('inventory')} className="btn btn-sm">Inventúra</button>
            <button onClick={() => setPanel('move')} className="btn btn-sm btn-primary"><Plus aria-hidden />Pohyb</button>
          </>
        )}
      />

      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {tiles.map((f) => {
          const n = stock[f.id] ?? 0
          return (
            <div key={f.id} className={'relative overflow-hidden rounded-[calc(var(--r,16px)*0.9)] border-2 p-2.5 min-h-[5rem] ' + (n === 0 ? 'opacity-45' : '')} style={{ ...flavorStyle(f), textShadow: 'none' }}>
              <p className="text-xs font-semibold truncate relative z-10 max-w-[70%]">{flavorName(f)}</p>
              <p className="text-3xl font-bold leading-none mt-1.5 relative z-10 num">{n}</p>
              <Photo kind="flavor-photos" path={f.photo_path} alt={flavorName(f)} className="absolute right-0.5 bottom-0.5 h-[85%] w-auto max-w-[55%] object-contain drop-shadow" />
            </div>
          )
        })}
      </div>

      {panel && (
        <Section title={panel === 'move' ? 'Nový pohyb' : 'Inventúra – zadaj skutočný stav'} sub={panel === 'inventory' ? 'Appka dopočíta rozdiel a uloží ho ako opravu. Pohyby sa nemenia.' : undefined}>
          <MovementForm flavors={active} stock={stock} initialMode={panel} onDone={done} />
        </Section>
      )}

      <div className="flex items-center gap-2 mt-3">
        <h2 className="section-title !text-xl flex-1">Rok {year}</h2>
        <button onClick={() => setYear(year - 1)} className="btn btn-sm btn-icon" aria-label="Predošlý rok"><ChevronLeft aria-hidden /></button>
        <button onClick={() => setYear(year + 1)} className="btn btn-sm btn-icon" aria-label="Ďalší rok"><ChevronRight aria-hidden /></button>
      </div>

      <Stats moves={moves} byId={byId} />

      <Section title="História pohybov">
        {moves.length === 0 ? (
          <Empty>Žiadne pohyby v roku {year}.</Empty>
        ) : (
          <ul className="list text-sm">
            {list.map((m) => {
              const f = byId.get(m.flavor_id)
              return (
                <li key={m.id} className="row !py-2.5">
                  <span className="muted w-11 shrink-0 text-xs num whitespace-nowrap">{fmtDay(m.occurred_at.slice(0, 10)).replace(/ \d{4}$/, '')}</span>
                  <span className={'w-9 shrink-0 text-right font-bold num ' + (m.cartons > 0 ? 'text-[var(--ok)]' : '')}>
                    {m.cartons > 0 ? '+' : ''}{m.cartons}
                  </span>
                  {f && <span className="badge border shrink-0" style={{ ...flavorStyle(f), textShadow: 'none' }}>{flavorName(f)}</span>}
                  <span className="flex-1 min-w-0 truncate">
                    {MOVE_LABEL[m.type]}
                    {m.events && (
                      <> · <Link to="/event/$id" params={{ id: m.events.id }} className="link font-medium">{m.events.title}</Link></>
                    )}
                    {m.recipient && <span className="muted"> · {m.recipient}</span>}
                    {m.note && <span className="muted"> · {m.note}</span>}
                    {!m.counts_in_stock && <span className="muted"> · len štatistika</span>}
                  </span>
                  {isAdmin && (
                    <button onClick={() => remove(m)} className="btn btn-sm btn-icon btn-quiet muted -mr-2" aria-label="Zmazať pohyb"><X aria-hidden /></button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!showAll && moves.length > list.length && (
          <button onClick={() => setShowAll(true)} className="btn btn-sm btn-block mt-2">Zobraziť všetkých {moves.length}</button>
        )}
      </Section>

      {isAdmin && <FlavorAdmin flavors={flavors} onChanged={() => setReload((r) => r + 1)} />}
    </div>
  )
}

function Stats({ moves, byId }: { moves: Movement[]; byId: Map<string, Flavor> }) {
  // spotreba = výdaj na eventy (aj historický sampling, ktorý nejde do skladu)
  const per = new Map<string, { in: number; used: number; other: number }>()
  const dept = new Map<string, number>()
  for (const m of moves) {
    const p = per.get(m.flavor_id) ?? { in: 0, used: 0, other: 0 }
    if (m.type === 'delivery') p.in += m.cartons
    else if (m.type === 'event') {
      p.used += -m.cartons
      // event s viacerými oddeleniami: spotreba sa rozdelí rovnakým dielom
      const ds = m.events?.departments?.length ? m.events.departments : ['none']
      for (const d of ds) dept.set(d, (dept.get(d) ?? 0) + -m.cartons / ds.length)
    } else if (m.type === 'opened_garage' || m.type === 'damaged') p.other += -m.cartons
    per.set(m.flavor_id, p)
  }
  const rows = [...per.entries()]
    .map(([id, v]) => ({ f: byId.get(id), ...v }))
    .filter((r) => r.f && (r.in || r.used || r.other))
    .sort((a, b) => b.used - a.used)
  const sum = rows.reduce((s, r) => ({ in: s.in + r.in, used: s.used + r.used, other: s.other + r.other }), { in: 0, used: 0, other: 0 })
  const deptRows = [...dept.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Section title="Prišlo / spotreba">
        {rows.length === 0 ? (
          <Empty>Žiadne dáta.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="muted text-xs text-left">
                <th className="font-medium pb-1">Príchuť</th>
                <th className="font-medium pb-1 text-right">Prišlo</th>
                <th className="font-medium pb-1 text-right">Eventy</th>
                <th className="font-medium pb-1 text-right">Iné</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f!.id} className="border-t">
                  <td className="py-1.5">{flavorName(r.f!)}</td>
                  <td className="text-right num">{r.in || '–'}</td>
                  <td className="text-right num font-semibold">{r.used || '–'}</td>
                  <td className="text-right num">{r.other || '–'}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold">
                <td className="py-1.5">Spolu</td>
                <td className="text-right num">{sum.in}</td>
                <td className="text-right num">{sum.used}</td>
                <td className="text-right num">{sum.other}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Spotreba podľa oddelenia">
        {deptRows.length === 0 ? (
          <Empty>Žiadne dáta.</Empty>
        ) : (
          <ul className="grid gap-2 text-sm">
            {deptRows.map(([d, n]) => {
              const pct = sum.used ? Math.round((n / sum.used) * 100) : 0
              return (
                <li key={d}>
                  <div className="flex justify-between">
                    <span>{d === 'none' ? 'Neurčené' : DEPT_LABEL[d as Department] ?? d}</span>
                    <span className="num"><b>{Math.round(n * 10) / 10}</b> <span className="muted">({pct} %)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--fill-2)] mt-1.5 overflow-hidden">
                    <div className="h-2 rounded-full bg-[var(--color-signal)]" style={{ width: pct + '%' }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs muted mt-3">Event s viacerými oddeleniami sa delí rovnakým dielom.</p>
      </Section>
    </div>
  )
}

function FlavorAdmin({ flavors, onChanged }: { flavors: Flavor[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<Partial<Flavor> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!edit?.name?.trim()) return setError('Zadaj názov.')
    const row = {
      name: edit.name.trim(),
      label: edit.label?.trim() || null,
      color_bg: edit.color_bg ?? '#ffffff',
      color_text: edit.color_text ?? '#000000',
      color_border: edit.color_border ?? '#cccccc',
      sort_order: Number(edit.sort_order ?? 999),
      active: edit.active ?? true,
    }
    const { error } = edit.id
      ? await supabase.from('flavors').update(row).eq('id', edit.id)
      : await supabase.from('flavors').insert(row)
    if (error) return setError(error.message)
    setEdit(null)
    setError(null)
    onChanged()
  }

  return (
    <Section title="Príchute" action={!edit && <button onClick={() => setEdit({ active: true, sort_order: 999 })} className="btn btn-sm"><Plus aria-hidden />Nová</button>}>
      <ul className="chips">
        {flavors.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => setEdit(f)}
              className={'chip border-2 font-semibold ' + (f.active ? '' : 'opacity-45')}
              style={{ ...flavorStyle(f), textShadow: 'none' }}
              title={f.active ? f.name : `${f.name} (neaktívna)`}
            >
              {flavorName(f)}{!f.active && <span className="count">neaktívna</span>}
            </button>
          </li>
        ))}
      </ul>
      {edit && (
        <div className="form mt-4 border-t pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Názov"><input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Krátky názov"><input className="input" value={edit.label ?? ''} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-3 items-end">
            <ColorField label="Pozadie" value={edit.color_bg ?? '#ffffff'} onChange={(v) => setEdit({ ...edit, color_bg: v })} />
            <ColorField label="Text" value={edit.color_text ?? '#000000'} onChange={(v) => setEdit({ ...edit, color_text: v })} />
            <ColorField label="Okraj" value={edit.color_border ?? '#cccccc'} onChange={(v) => setEdit({ ...edit, color_border: v })} />
            <Field label="Poradie"><input type="number" inputMode="numeric" className="input" value={edit.sort_order ?? 999} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            Aktívna (ponúka sa pri pohyboch)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative px-3 py-1 rounded-[var(--ctl-r)] border-2 font-semibold text-sm min-w-24 min-h-12 flex items-center" style={{ ...flavorStyle({ color_bg: edit.color_bg ?? null, color_text: edit.color_text ?? null, color_border: edit.color_border ?? null }), textShadow: 'none' }}>
              {edit.label || edit.name || 'Náhľad'}
              <Photo kind="flavor-photos" path={edit.photo_path} alt="" className="ml-2 h-10 w-auto object-contain" />
            </span>
            {edit.id ? (
              <PhotoUpload
                kind="flavor-photos"
                id={edit.id}
                label={edit.photo_path ? 'Zmeniť logo' : 'Nahrať logo'}
                onUploaded={async (path) => {
                  const { error } = await supabase.from('flavors').update({ photo_path: path }).eq('id', edit.id!)
                  if (error) throw new Error(error.message)
                  setEdit({ ...edit, photo_path: path })
                  onChanged()
                }}
              />
            ) : <span className="text-xs muted">Logo môžeš nahrať po uložení príchute.</span>}
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="form-actions">
            <button onClick={save} className="btn btn-primary">Uložiť</button>
            <button onClick={() => { setEdit(null); setError(null) }} className="btn btn-quiet">Zrušiť</button>
          </div>
        </div>
      )}
    </Section>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="color" className="input !p-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
