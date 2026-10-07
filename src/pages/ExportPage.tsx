import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { BusyOverlay } from '../components/BusyOverlay'
import {
  type SheetPreview, exportDrivers, exportEventCar, exportFinance, exportProduct, exportTechnika, previewExport,
} from '../lib/exports'
import { eur, todayLocal } from '../lib/events'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const label = (m: string) => `${MONTH_SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

type Result = { ok: boolean; text: string }
type Kind = 'eventcar' | 'technika' | 'product' | 'drivers' | 'finance'

export function ExportPage() {
  const { isAdmin } = useAuth()
  const cur = todayLocal().slice(0, 7)
  const thisYear = Number(cur.slice(0, 4))
  const years = Array.from({ length: thisYear - 2024 + 1 }, (_, i) => thisYear - i)
  const [year, setYear] = useState(thisYear)
  const [picked, setPicked] = useState<string[]>([cur])
  const months = [...picked].sort()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [preview, setPreview] = useState<{ kind: Kind; sheets: SheetPreview[] } | null>(null)

  const bad = months.length === 0
  const toggle = (m: string) => { setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m])); setPreview(null) }
  const set = (list: string[]) => { setPicked(list); setPreview(null) }
  const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
  const lastThree = Array.from({ length: 3 }, (_, i) => { const d = new Date(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)) - 1 - i, 1); return ym(d.getFullYear(), d.getMonth() + 1) })

  const RUN: Record<Kind, () => Promise<string>> = {
    eventcar: async () => `Hotovo: ${(await exportEventCar(months)).events} eventov. Súbor sa stiahol.`,
    technika: async () => { const r = await exportTechnika(months); return `Hotovo: ${r.events} eventov s technikou, ${r.pieces} kusov. Súbor sa stiahol.` },
    product: async () => `Hotovo: ${(await exportProduct(months)).movements} pohybov. Súbor sa stiahol.`,
    drivers: async () => { const r = await exportDrivers(months); return `Hotovo: ${r.payouts} výplat, spolu ${eur(r.total)}. Súbor sa stiahol.` },
    finance: async () => { const r = await exportFinance(months); return `Hotovo: ${r.docs} riadkov, spolu ${eur(r.total)}. Súbor sa stiahol.` },
  }

  async function run(kind: Kind, label: string, mode: 'download' | 'preview') {
    setResult(null)
    setBusy(mode === 'preview' ? `Pripravujem náhľad ${label}` : `Pripravujem ${label}`)
    try {
      if (mode === 'preview') setPreview({ kind, sheets: await previewExport(RUN[kind]) })
      else setResult({ ok: true, text: await RUN[kind]() })
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message || 'Export zlyhal.' })
    }
    setBusy(null)
  }

  const input = 'h-11 px-3 rounded-lg border line bg-transparent w-full'
  const blocks: { kind: Kind; title: string; text: string; admin?: boolean; accent: string }[] = [
    { kind: 'eventcar', title: 'Event Car', accent: 'var(--color-signal)', text: 'Hárky EVENT CAR, SUPPORT, ADHOC a TECHNIKA (po eventoch, súhrn po kusoch a po type). Bez financií, zrušené eventy sa nerátajú.' },
    { kind: 'technika', title: 'TECHNIKA', accent: 'var(--color-sky)', text: 'Samostatný súbor: kde bola ktorá technika, koľko kusov a dní, súhrn po kusoch a po type za mesiace.' },
    { kind: 'product', title: 'PRODUCT', accent: 'var(--color-amber)', text: 'Kartóny: stav skladu, všetky pohyby, spotreba po príchutiach a podľa oddelenia.' },
    { kind: 'drivers', title: 'DRIVERS', admin: true, accent: '#7c3aed', text: 'Koľko peňazí ide ktorému vodičovi za mesiac (základ, 15 % daň, vyplatené / nevyplatené).' },
    { kind: 'finance', title: 'FINANCE', admin: true, accent: '#2e8b57', text: 'Vyúčtovanie: jeden hárok na mesiac, výdavky aj brigádnici s 15 %, odkazy na bločky v Drive.' },
  ]

  return (
    <section className="flex flex-col gap-4 min-w-0">
      {busy && <BusyOverlay title={busy} progress={null} />}
      <h1 className="display text-4xl font-bold">Export</h1>

      <div className="card p-4">
        <h2 className="display text-xl font-bold mb-2">Obdobie</h2>
        <div className="flex gap-1 mb-2">
          {years.map((y) => {
            const n = months.filter((m) => m.startsWith(String(y))).length
            return (
              <button key={y} onClick={() => setYear(y)} className={'h-10 px-4 rounded-lg border line font-semibold ' + (year === y ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)]' : '')}>
                {y}{n > 0 && <span className="ml-1 text-xs opacity-80">·{n}</span>}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_SHORT.map((label, i) => {
            const m = ym(year, i + 1)
            const on = picked.includes(m)
            return (
              <button
                key={m}
                onClick={() => toggle(m)}
                aria-pressed={on}
                className={'h-11 rounded-lg border font-semibold ' + (on ? 'bg-[var(--color-signal)] border-[var(--color-signal)] text-white' : 'line')}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <button onClick={() => set([cur])} className="h-9 px-3 rounded-lg border line text-xs font-medium">Tento mesiac</button>
          <button onClick={() => set(lastThree)} className="h-9 px-3 rounded-lg border line text-xs font-medium">Posledné 3</button>
          <button onClick={() => set(Array.from({ length: 12 }, (_, i) => ym(year, i + 1)))} className="h-9 px-3 rounded-lg border line text-xs font-medium">Celý {year}</button>
          <button onClick={() => set([])} className="h-9 px-3 rounded-lg border line text-xs font-medium muted">Vymazať výber</button>
        </div>
        <p className={'text-sm mt-2 ' + (bad ? 'text-[var(--color-signal)]' : 'muted')}>
          {bad ? 'Vyber aspoň jeden mesiac.' : `Vybrané: ${months.length} ${months.length === 1 ? 'mesiac' : months.length < 5 ? 'mesiace' : 'mesiacov'} (${months.length > 6 ? `${label(months[0])} … ${label(months[months.length - 1])}` : months.map(label).join(', ')})`}
        </p>
      </div>

      {blocks.filter((b) => !b.admin || isAdmin).map((b) => (
        <div key={b.kind} className="card p-4 border-l-4" style={{ borderLeftColor: b.accent }}>
          <h2 className="display text-xl font-bold">{b.title}</h2>
          <p className="text-sm muted">{b.text}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              disabled={bad || !!busy}
              onClick={() => run(b.kind, b.title, 'download')}
              className="h-11 px-5 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: b.accent }}
            >
              Stiahnuť (.xlsx)
            </button>
            <button
              disabled={bad || !!busy}
              onClick={() => (preview?.kind === b.kind ? setPreview(null) : run(b.kind, b.title, 'preview'))}
              className="h-11 px-4 rounded-lg border line font-medium disabled:opacity-50"
            >
              {preview?.kind === b.kind ? 'Skryť náhľad' : 'Náhľad'}
            </button>
          </div>
          {preview?.kind === b.kind && <Sheets sheets={preview.sheets} />}
        </div>
      ))}

      {result && <p className={'card p-3 text-sm ' + (result.ok ? '' : 'text-[var(--color-signal)]')}>{result.text}</p>}
    </section>
  )
}

function Sheets({ sheets }: { sheets: SheetPreview[] }) {
  if (sheets.length === 0 || sheets.every((s) => s.total === 0)) return <p className="muted text-sm mt-3">Za toto obdobie nie sú žiadne dáta.</p>
  return (
    <div className="mt-3 grid gap-3">
      {sheets.map((s) => (
        <div key={s.name}>
          <p className="text-xs font-semibold mb-1">Hárok „{s.name}“ <span className="muted font-normal">· {Math.max(0, s.total - 1)} riadkov</span></p>
          <div className="overflow-x-auto rounded-lg border line">
            <table className="text-[11px] min-w-max">
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className={i === 0 ? 'font-semibold bg-[var(--line)]/40' : 'border-t line'}>
                    {r.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap max-w-[220px] truncate">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.total > s.rows.length && <p className="text-[11px] muted mt-0.5">…a ďalšie riadky (prvých {s.rows.length} z {s.total})</p>}
        </div>
      ))}
    </div>
  )
}
