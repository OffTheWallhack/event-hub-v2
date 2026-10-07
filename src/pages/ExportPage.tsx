import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { BusyOverlay } from '../components/BusyOverlay'
import { exportDrivers, exportEventCar, exportFinance, exportProduct, exportTechnika } from '../lib/exports'
import { eur, todayLocal } from '../lib/events'

type Result = { ok: boolean; text: string }

export function ExportPage() {
  const { isAdmin } = useAuth()
  const cur = todayLocal().slice(0, 7)
  const [from, setFrom] = useState(cur)
  const [to, setTo] = useState(cur)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const bad = !from || !to || from > to

  async function run(name: string, fn: () => Promise<string>) {
    setResult(null)
    setBusy(`Pripravujem ${name}`)
    try {
      setResult({ ok: true, text: await fn() })
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message || 'Export zlyhal.' })
    }
    setBusy(null)
  }

  const input = 'h-11 px-3 rounded-lg border line bg-transparent w-full'
  return (
    <section className="flex flex-col gap-4 min-w-0">
      {busy && <BusyOverlay title={busy} progress={null} />}
      <h1 className="display text-4xl font-bold">Export</h1>

      <div className="card p-4">
        <h2 className="display text-xl font-bold mb-2">Obdobie</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm"><span className="muted">Od mesiaca</span>
            <input type="month" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grid gap-1 text-sm"><span className="muted">Do mesiaca</span>
            <input type="month" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {bad && <p className="text-sm text-[var(--color-signal)] mt-2">Vyber obdobie, „od“ nesmie byť po „do“.</p>}
      </div>

      <div className="card p-4 grid gap-3">
        <div>
          <h2 className="display text-xl font-bold">Event Car</h2>
          <p className="text-sm muted">Hárky EVENT CAR, SUPPORT, ADHOC a TECHNIKA (po eventoch, súhrn po kusoch a po type). Bez financií, zrušené eventy sa nerátajú.</p>
          <button
            disabled={bad || !!busy}
            onClick={() => run('Event Car', async () => {
              const r = await exportEventCar(from, to)
              return `Hotovo: ${r.events} eventov. Súbor sa stiahol.`
            })}
            className="mt-2 h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-50"
          >
            Stiahnuť Event Car (.xlsx)
          </button>
        </div>

        <Block
          title="TECHNIKA"
          text="Samostatný súbor: kde bola ktorá technika, koľko kusov a dní, súhrn po kusoch a po type za mesiace."
          label="Stiahnuť TECHNIKA (.xlsx)"
          disabled={bad || !!busy}
          onClick={() => run('TECHNIKA', async () => {
            const r = await exportTechnika(from, to)
            return `Hotovo: ${r.events} eventov s technikou, ${r.pieces} kusov. Súbor sa stiahol.`
          })}
        />

        <Block
          title="PRODUCT"
          text="Kartóny: stav skladu, všetky pohyby, spotreba po príchutiach a podľa oddelenia."
          label="Stiahnuť PRODUCT (.xlsx)"
          disabled={bad || !!busy}
          onClick={() => run('PRODUCT', async () => {
            const r = await exportProduct(from, to)
            return `Hotovo: ${r.movements} pohybov. Súbor sa stiahol.`
          })}
        />

        {isAdmin && (
          <Block
            title="DRIVERS"
            text="Koľko peňazí ide ktorému vodičovi za mesiac (základ, 15 % daň, vyplatené / nevyplatené)."
            label="Stiahnuť DRIVERS (.xlsx)"
            disabled={bad || !!busy}
            onClick={() => run('DRIVERS', async () => {
              const r = await exportDrivers(from, to)
              return `Hotovo: ${r.payouts} výplat, spolu ${eur(r.total)}. Súbor sa stiahol.`
            })}
          />
        )}

        {isAdmin && (
          <div className="border-t line pt-3">
            <h2 className="display text-xl font-bold">FINANCE</h2>
            <p className="text-sm muted">Vyúčtovanie: jeden hárok na mesiac, výdavky aj brigádnici s 15 %, odkazy na bločky v Drive.</p>
            <button
              disabled={bad || !!busy}
              onClick={() => run('FINANCE', async () => {
                const r = await exportFinance(from, to)
                return `Hotovo: ${r.docs} riadkov, spolu ${eur(r.total)}. Súbor sa stiahol.`
              })}
              className="mt-2 h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-ink)] dark:bg-[var(--color-signal)] disabled:opacity-50"
            >
              Stiahnuť FINANCE (.xlsx)
            </button>
          </div>
        )}
      </div>

      {result && (
        <p className={'card p-3 text-sm ' + (result.ok ? '' : 'text-[var(--color-signal)]')}>{result.text}</p>
      )}
    </section>
  )
}

function Block({ title, text, label, disabled, onClick }: { title: string; text: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="border-t line pt-3">
      <h2 className="display text-xl font-bold">{title}</h2>
      <p className="text-sm muted">{text}</p>
      <button
        disabled={disabled}
        onClick={onClick}
        className="mt-2 h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-ink)] dark:bg-[var(--color-signal)] disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  )
}
