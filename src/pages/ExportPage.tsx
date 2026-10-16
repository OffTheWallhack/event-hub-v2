import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { Eye, EyeOff, FileDown } from 'lucide-react'
import { BusyOverlay } from '../components/BusyOverlay'
import { PageHeader, Section, Seg } from '../components/ui'
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

  const blocks: { kind: Kind; title: string; text: string; admin?: boolean; accent: string }[] = [
    { kind: 'eventcar', title: 'Event Car', accent: 'var(--color-signal)', text: 'Hárky EVENT CAR, SUPPORT, ADHOC a TECHNIKA (po eventoch, súhrn po kusoch a po type). Bez financií, zrušené eventy sa nerátajú.' },
    { kind: 'technika', title: 'Technika', accent: 'var(--color-sky)', text: 'Kde bola ktorá technika, koľko kusov a dní, súhrn po kusoch a po type za mesiace.' },
    { kind: 'product', title: 'Product', accent: 'var(--color-amber)', text: 'Kartóny: stav skladu, všetky pohyby, spotreba po príchutiach a podľa oddelenia.' },
    { kind: 'drivers', title: 'Drivers', admin: true, accent: '#7c3aed', text: 'Koľko peňazí ide ktorému vodičovi za mesiac (základ, 15 % daň, vyplatené / nevyplatené).' },
    { kind: 'finance', title: 'Finance', admin: true, accent: '#2e8b57', text: 'Vyúčtovanie: jeden hárok na mesiac, výdavky aj brigádnici s 15 %, odkazy na bločky v Drive.' },
  ]

  return (
    <div className="page">
      {busy && <BusyOverlay title={busy} progress={null} />}
      <PageHeader title="Export" sub="Excel súbory v tvojich formátoch tabuliek." />

      <Section title="Obdobie">
        <Seg className="mb-3" options={years.map((y) => {
          const n = months.filter((m) => m.startsWith(String(y))).length
          return [String(y), <>{y}{n > 0 && <span className="ml-1 text-xs opacity-60">·{n}</span>}</>] as const
        })} value={String(year)} onChange={(y) => setYear(Number(y))} />
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_SHORT.map((label, i) => {
            const m = ym(year, i + 1)
            const on = picked.includes(m)
            return (
              <button key={m} type="button" onClick={() => toggle(m)} aria-pressed={on} className="chip justify-center !h-10">
                {label}
              </button>
            )
          })}
        </div>
        <div className="chips mt-3">
          <button onClick={() => set([cur])} className="btn btn-sm">Tento mesiac</button>
          <button onClick={() => set(lastThree)} className="btn btn-sm">Posledné 3</button>
          <button onClick={() => set(Array.from({ length: 12 }, (_, i) => ym(year, i + 1)))} className="btn btn-sm">Celý {year}</button>
          <button onClick={() => set([])} className="btn btn-sm btn-quiet muted">Vymazať</button>
        </div>
        <p className={'text-sm mt-3 ' + (bad ? 'err' : 'muted')}>
          {bad ? 'Vyber aspoň jeden mesiac.' : `Vybrané: ${months.length} ${months.length === 1 ? 'mesiac' : months.length < 5 ? 'mesiace' : 'mesiacov'} (${months.length > 6 ? `${label(months[0])} … ${label(months[months.length - 1])}` : months.map(label).join(', ')})`}
        </p>
      </Section>

      {blocks.filter((b) => !b.admin || isAdmin).map((b) => (
        <Section key={b.kind} title={<span className="flex items-center gap-2"><span className="dot" style={{ background: b.accent }} />{b.title}</span>}>
          <p className="text-sm muted -mt-1">{b.text}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button disabled={bad || !!busy} onClick={() => run(b.kind, b.title, 'download')} className="btn btn-primary">
              <FileDown aria-hidden />Stiahnuť .xlsx
            </button>
            <button
              disabled={bad || !!busy}
              onClick={() => (preview?.kind === b.kind ? setPreview(null) : run(b.kind, b.title, 'preview'))}
              className="btn"
            >
              {preview?.kind === b.kind ? <><EyeOff aria-hidden />Skryť náhľad</> : <><Eye aria-hidden />Náhľad</>}
            </button>
          </div>
          {preview?.kind === b.kind && <Sheets sheets={preview.sheets} />}
        </Section>
      ))}

      {result && <p className={'card section text-sm ' + (result.ok ? '' : 'err')}>{result.text}</p>}
    </div>
  )
}

function Sheets({ sheets }: { sheets: SheetPreview[] }) {
  if (sheets.length === 0 || sheets.every((s) => s.total === 0)) return <p className="empty mt-3">Za toto obdobie nie sú žiadne dáta.</p>
  return (
    <div className="mt-4 grid gap-4">
      {sheets.map((s) => (
        <div key={s.name}>
          <p className="text-xs font-semibold mb-1.5">Hárok „{s.name}“ <span className="muted font-normal">· {Math.max(0, s.total - 1)} riadkov</span></p>
          <div className="overflow-x-auto rounded-[var(--ctl-r)] border">
            <table className="text-[11px] min-w-max">
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className={i === 0 ? 'font-semibold bg-[var(--fill-2)]' : 'border-t'}>
                    {r.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap max-w-[220px] truncate">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.total > s.rows.length && <p className="text-[11px] muted mt-1">…a ďalšie riadky (prvých {s.rows.length} z {s.total})</p>}
        </div>
      ))}
    </div>
  )
}
