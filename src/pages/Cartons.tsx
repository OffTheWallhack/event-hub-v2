import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
    <section className="flex flex-col gap-4 min-w-0">
      <div className="flex items-end gap-2">
        <h1 className="display text-4xl font-bold flex-1">Kartóny</h1>
        <p className="muted text-sm pb-1">Spolu v sklade: <b className="text-[var(--fg)]">{total}</b></p>
      </div>

      {error && <p className="text-[var(--color-signal)]">{error}</p>}

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {tiles.map((f) => {
          const n = stock[f.id] ?? 0
          return (
            <div key={f.id} className={'relative overflow-hidden rounded-xl border-2 p-2 min-h-[4.5rem] ' + (n === 0 ? 'opacity-45' : '')} style={flavorStyle(f)}>
              <p className="text-xs font-semibold truncate relative z-10 max-w-[70%]">{flavorName(f)}</p>
              <p className="display text-3xl font-bold leading-none mt-1 relative z-10">{n}</p>
              <Photo kind="flavor-photos" path={f.photo_path} alt={flavorName(f)} className="absolute right-0.5 bottom-0.5 h-[85%] w-auto max-w-[55%] object-contain drop-shadow" />
            </div>
          )
        })}
      </div>

      {isAdmin && panel === null && (
        <div className="flex gap-2">
          <button onClick={() => setPanel('move')} className="h-11 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)]">+ Pohyb</button>
          <button onClick={() => setPanel('inventory')} className="h-11 px-4 rounded-lg border line font-medium">Inventúra</button>
        </div>
      )}
      {panel && (
        <Card title={panel === 'move' ? 'Nový pohyb' : 'Inventúra – zadaj skutočný stav'}>
          {panel === 'inventory' && (
            <p className="text-sm muted mb-3">Appka dopočíta rozdiel a uloží ho ako opravu. Pohyby sa nemenia.</p>
          )}
          <MovementForm flavors={active} stock={stock} initialMode={panel} onDone={done} />
        </Card>
      )}

      <div className="flex items-center gap-2 mt-2">
        <h2 className="display text-2xl font-bold flex-1">Rok {year}</h2>
        <button onClick={() => setYear(year - 1)} className="h-9 w-9 rounded-lg border line" aria-label="Predošlý rok">‹</button>
        <button onClick={() => setYear(year + 1)} className="h-9 w-9 rounded-lg border line" aria-label="Ďalší rok">›</button>
      </div>

      <Stats moves={moves} byId={byId} />

      <Card title="História pohybov">
        {moves.length === 0 ? (
          <p className="muted text-sm">Žiadne pohyby v roku {year}.</p>
        ) : (
          <ul className="divide-y line text-sm">
            {list.map((m) => {
              const f = byId.get(m.flavor_id)
              return (
                <li key={m.id} className="py-2 flex items-center gap-2">
                  <span className="muted w-12 shrink-0 text-xs">{fmtDay(m.occurred_at.slice(0, 10)).replace(/ \d{4}$/, '')}</span>
                  <span className={'w-10 shrink-0 text-right font-bold tabular-nums ' + (m.cartons > 0 ? 'text-green-700 dark:text-green-400' : '')}>
                    {m.cartons > 0 ? '+' : ''}{m.cartons}
                  </span>
                  {f && <span className="px-1.5 rounded border text-xs font-semibold shrink-0" style={flavorStyle(f)}>{flavorName(f)}</span>}
                  <span className="flex-1 min-w-0 truncate">
                    {MOVE_LABEL[m.type]}
                    {m.events && (
                      <> · <Link to="/event/$id" params={{ id: m.events.id }} className="text-[var(--color-sky)]">{m.events.title}</Link></>
                    )}
                    {m.recipient && <span className="muted"> · {m.recipient}</span>}
                    {m.note && <span className="muted"> · {m.note}</span>}
                    {!m.counts_in_stock && <span className="muted"> · len štatistika</span>}
                  </span>
                  {isAdmin && (
                    <button onClick={() => remove(m)} className="muted px-2 shrink-0" aria-label="Zmazať pohyb">×</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!showAll && moves.length > list.length && (
          <button onClick={() => setShowAll(true)} className="mt-2 h-10 px-4 rounded-lg border line text-sm">Zobraziť všetkých {moves.length}</button>
        )}
      </Card>

      {isAdmin && <FlavorAdmin flavors={flavors} onChanged={() => setReload((r) => r + 1)} />}
    </section>
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
      <Card title="Prišlo / spotreba">
        {rows.length === 0 ? (
          <p className="muted text-sm">Žiadne dáta.</p>
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
                <tr key={r.f!.id} className="border-t line">
                  <td className="py-1.5">{flavorName(r.f!)}</td>
                  <td className="text-right tabular-nums">{r.in || '–'}</td>
                  <td className="text-right tabular-nums font-semibold">{r.used || '–'}</td>
                  <td className="text-right tabular-nums">{r.other || '–'}</td>
                </tr>
              ))}
              <tr className="border-t-2 line font-bold">
                <td className="py-1.5">Spolu</td>
                <td className="text-right tabular-nums">{sum.in}</td>
                <td className="text-right tabular-nums">{sum.used}</td>
                <td className="text-right tabular-nums">{sum.other}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Spotreba podľa oddelenia">
        {deptRows.length === 0 ? (
          <p className="muted text-sm">Žiadne dáta.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {deptRows.map(([d, n]) => {
              const pct = sum.used ? Math.round((n / sum.used) * 100) : 0
              return (
                <li key={d}>
                  <div className="flex justify-between">
                    <span>{d === 'none' ? 'Neurčené' : DEPT_LABEL[d as Department] ?? d}</span>
                    <span className="tabular-nums"><b>{Math.round(n * 10) / 10}</b> <span className="muted">({pct} %)</span></span>
                  </div>
                  <div className="h-2 rounded bg-[var(--line)] mt-1">
                    <div className="h-2 rounded bg-[var(--color-signal)]" style={{ width: pct + '%' }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs muted mt-2">Event s viacerými oddeleniami sa delí rovnakým dielom.</p>
      </Card>
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

  const input = 'w-full h-10 px-3 rounded-lg border line bg-transparent'
  return (
    <Card title="Príchute">
      <ul className="grid gap-1">
        {flavors.map((f) => (
          <li key={f.id}>
            <button onClick={() => setEdit(f)} className={'w-full flex items-center gap-2 text-left text-sm py-1 ' + (f.active ? '' : 'opacity-50')}>
              <span className="px-2 py-0.5 rounded border-2 font-semibold" style={flavorStyle(f)}>{flavorName(f)}</span>
              <span className="muted flex-1 truncate">{f.name}</span>
              {!f.active && <span className="muted text-xs">neaktívna</span>}
            </button>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="grid gap-3 mt-4 border-t line pt-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm"><span className="muted">Názov</span>
              <input className={input} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="grid gap-1 text-sm"><span className="muted">Krátky názov</span>
              <input className={input} value={edit.label ?? ''} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-4 gap-2 items-end">
            <ColorField label="Pozadie" value={edit.color_bg ?? '#ffffff'} onChange={(v) => setEdit({ ...edit, color_bg: v })} />
            <ColorField label="Text" value={edit.color_text ?? '#000000'} onChange={(v) => setEdit({ ...edit, color_text: v })} />
            <ColorField label="Okraj" value={edit.color_border ?? '#cccccc'} onChange={(v) => setEdit({ ...edit, color_border: v })} />
            <label className="grid gap-1 text-sm"><span className="muted">Poradie</span>
              <input type="number" inputMode="numeric" className={input} value={edit.sort_order ?? 999} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            Aktívna (ponúka sa pri pohyboch)
          </label>
          <div className="flex items-center gap-3">
            <span className="relative px-2 py-1 rounded border-2 font-semibold text-sm min-w-24 min-h-12 flex items-center" style={flavorStyle({ color_bg: edit.color_bg ?? null, color_text: edit.color_text ?? null, color_border: edit.color_border ?? null })}>
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
          {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} className="h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)]">Uložiť</button>
            <button onClick={() => { setEdit(null); setError(null) }} className="h-11 px-4 rounded-lg border line">Zrušiť</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit({ active: true, sort_order: 999 })} className="mt-3 h-10 px-4 rounded-lg border line text-sm">+ Nová príchuť</button>
      )}
    </Card>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="muted">{label}</span>
      <input type="color" className="w-full h-10 rounded-lg border line bg-transparent" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4 min-w-0">
      <h2 className="display text-xl font-bold mb-2">{title}</h2>
      {children}
    </div>
  )
}
