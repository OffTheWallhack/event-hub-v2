import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Empty, ErrorText } from './ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { type Flavor, flavorName, flavorStyle } from '../lib/cartons'

export type EventCartonRow = { id: string; flavor_id: string; cartons: number }

/**
 * Kartóny na evente. Admin ťuká − / + pri každej príchuti a ukladá sa to samo (po chvíli od posledného ťuknutia).
 * Vzadu je to stále záznam pohybu „Na event“ (záporný = výdaj zo skladu), takže sklad sa prepočíta sám:
 * ťuknutie upraví existujúci záznam tej príchute na evente, nové riadky vznikajú len pri prvom kuse.
 */
export function EventCartons({ eventId, day, isAdmin, rows, onChanged }: {
  eventId: string
  day: string
  isAdmin: boolean
  rows: EventCartonRow[]
  onChanged: () => Promise<void> | void
}) {
  const { session } = useAuth()
  const [flavors, setFlavors] = useState<Flavor[]>([])
  const [local, setLocal] = useState<Record<string, number>>({}) // zobrazená hodnota, kým sa neuloží
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<Record<string, number>>({})
  const chain = useRef<Promise<void>>(Promise.resolve())
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    supabase
      .from('flavors')
      .select('id, name, label, color_bg, color_text, color_border, sort_order, active, photo_path')
      .order('sort_order')
      .then(({ data }) => setFlavors((data ?? []) as Flavor[]))
  }, [])
  useEffect(() => () => { Object.values(timers.current).forEach((t) => window.clearTimeout(t)) }, [])

  const saved = (fid: string) => rows.filter((r) => r.flavor_id === fid).reduce((s, r) => s - r.cartons, 0)
  const shown = (fid: string) => local[fid] ?? saved(fid)

  function set(fid: string, n: number) {
    const v = Math.max(0, Math.min(n, 999))
    setLocal((l) => ({ ...l, [fid]: v }))
    window.clearTimeout(timers.current[fid])
    timers.current[fid] = window.setTimeout(() => {
      chain.current = chain.current.then(() => commit(fid, v))
    }, 500)
  }

  async function commit(fid: string, target: number) {
    const mine = rowsRef.current.filter((r) => r.flavor_id === fid)
    const cur = mine.reduce((s, r) => s - r.cartons, 0)
    let err: { message: string } | null = null
    if (target > cur) {
      const add = target - cur
      const res = mine.length
        ? await supabase.from('carton_movements').update({ cartons: mine[0].cartons - add }).eq('id', mine[0].id)
        : await supabase.from('carton_movements').insert({
            flavor_id: fid, cartons: -add, type: 'event', event_id: eventId,
            occurred_at: day + 'T12:00:00Z', created_by: session?.user.id ?? null,
          })
      err = res.error
    } else if (target < cur) {
      let rest = cur - target
      for (const r of [...mine].reverse()) {
        if (rest <= 0) break
        const have = -r.cartons
        const take = Math.min(rest, have)
        const res = take === have
          ? await supabase.from('carton_movements').delete().eq('id', r.id)
          : await supabase.from('carton_movements').update({ cartons: r.cartons + take }).eq('id', r.id)
        if (res.error) { err = res.error; break }
        rest -= take
      }
    }
    setError(err ? err.message : null)
    await onChanged()
    setLocal((l) => {
      if (l[fid] !== target) return l // medzitým sa ťuklo znova, to ešte čaká na uloženie
      const { [fid]: _drop, ...rest } = l
      return rest
    })
  }

  const list = flavors.filter((f) => shown(f.id) > 0 || (isAdmin && f.active))

  if (!isAdmin) {
    const used = list.filter((f) => shown(f.id) > 0)
    return used.length === 0 ? (
      <Empty>Žiadne.</Empty>
    ) : (
      <ul className="chips">
        {used.map((f) => (
          <li key={f.id} className="chip pointer-events-none"><b className="num">{shown(f.id)}×</b> {flavorName(f)}</li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <ErrorText>{error}</ErrorText>
      {list.length === 0 ? (
        <Empty>Žiadne príchute.</Empty>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((f) => {
            const n = shown(f.id)
            return (
              <div key={f.id} className={'rounded-[var(--ctl-r)] border-2 px-3 py-2 ' + (n === 0 ? 'opacity-60' : '')} style={flavorStyle(f)}>
                <span className="block font-semibold text-sm leading-tight truncate">{flavorName(f)}</span>
                <span className="flex items-center justify-between gap-2 mt-1.5">
                  <button type="button" onClick={() => set(f.id, n - 1)} disabled={n === 0} className="w-9 h-9 rounded-full grid place-items-center bg-black/55 text-white disabled:opacity-30" aria-label="Menej"><Minus className="w-4 h-4" aria-hidden /></button>
                  <b className="num text-lg">{n}</b>
                  <button type="button" onClick={() => set(f.id, n + 1)} className="w-9 h-9 rounded-full grid place-items-center bg-black/55 text-white" aria-label="Viac"><Plus className="w-4 h-4" aria-hidden /></button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
