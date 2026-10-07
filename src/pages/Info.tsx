import { useCallback, useEffect, useState } from 'react'
import { SUPABASE_URL, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CHANGELOG, NOT_YET } from '../lib/changelog'

type State = 'ok' | 'warn' | 'bad' | 'wait'
type Check = { key: string; label: string; state: State; detail: string }

const COLOR: Record<State, string> = { ok: '#2e8b57', warn: 'var(--color-amber)', bad: 'var(--color-signal)', wait: '#8f99aa' }
const FUNCTIONS = [
  ['ics-sync', 'Synchronizácia Basecampu'],
  ['drive', 'Google Drive (nahrávanie)'],
  ['brief', 'Odkaz pre vodiča'],
  ['import-files', 'Import súborov'],
] as const

const ago = (iso: string | number) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'práve teraz'
  if (min < 60) return `pred ${min} min`
  if (min < 48 * 60) return `pred ${Math.round(min / 60)} h`
  return `pred ${Math.round(min / 1440)} dňami`
}
const when = (iso: string) => new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

async function timed<T>(fn: () => Promise<T>): Promise<[T | null, number, string | null]> {
  const t = performance.now()
  try { return [await fn(), Math.round(performance.now() - t), null] } catch (e) { return [null, Math.round(performance.now() - t), (e as Error).message] }
}

export function Info() {
  const { isAdmin, profile } = useAuth()
  const [checks, setChecks] = useState<Check[]>([])
  const [counts, setCounts] = useState<{ label: string; n: number }[]>([])
  const [newer, setNewer] = useState<{ version: string; commit: string; builtAt: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)

  const run = useCallback(async () => {
    setRunning(true)
    const out: Check[] = []
    const add = (key: string, label: string, state: State, detail: string) => out.push({ key, label, state, detail })

    // webová stránka + či je nasadená novšia verzia
    const [ver, vms, verr] = await timed(async () => {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return (await r.json()) as { version: string; commit: string; builtAt: string }
    })
    if (ver) {
      const isNew = ver.commit !== __APP_COMMIT__ || ver.builtAt !== __APP_BUILT_AT__
      setNewer(isNew ? ver : null)
      add('web', 'Web (Cloudflare)', 'ok', `beží, odpoveď ${vms} ms`)
    } else add('web', 'Web (Cloudflare)', 'warn', `verzia sa nedá overiť (${verr})`)

    // databáza
    const [db, dms, derr] = await timed(async () => {
      const { data, error } = await supabase.from('sync_status').select('key, last_synced_at, last_result, last_error').eq('key', 'basecamp_ical').maybeSingle()
      if (error) throw error
      return data as { last_synced_at: string | null; last_result: Record<string, number> | null; last_error: string | null } | null
    })
    add('db', 'Databáza (Supabase)', derr ? 'bad' : dms > 2500 ? 'warn' : 'ok', derr ? `chyba: ${derr}` : `beží, odpoveď ${dms} ms`)

    // prihlásenie
    const [u, , uerr] = await timed(async () => (await supabase.auth.getUser()).data.user)
    add('auth', 'Prihlásenie', u ? 'ok' : 'bad', u ? `${u.email}` : `nie si prihlásený (${uerr ?? ''})`)

    // Basecamp sync
    if (db?.last_synced_at) {
      const min = (Date.now() - new Date(db.last_synced_at).getTime()) / 60000
      const r = db.last_result
      const detail = db.last_error
        ? `posledný beh ${ago(db.last_synced_at)} skončil chybou: ${db.last_error}`
        : `posledný beh ${ago(db.last_synced_at)} (${when(db.last_synced_at)})${r ? `, v Basecampe ${r.total} eventov, ${r.added} nových, ${r.updated} zmenených` : ''}`
      add('sync', 'Synchronizácia Basecampu', db.last_error ? 'bad' : min > 45 ? 'warn' : 'ok', min > 45 && !db.last_error ? `${detail} – má bežať každých 15 minút` : detail)
    } else add('sync', 'Synchronizácia Basecampu', 'warn', 'ešte nikdy nebežala')

    // Edge Functions – OPTIONS bez prihlásenia
    for (const [fn, label] of FUNCTIONS) {
      const [res, ms, err] = await timed(async () => fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS' }))
      add(`fn-${fn}`, label, res?.ok ? 'ok' : 'bad', res?.ok ? `funkcia beží, odpoveď ${ms} ms` : `nedostupná (${err ?? res?.status})`)
    }

    // Google Drive (admin)
    if (isAdmin) {
      const { data, error } = await supabase.functions.invoke('drive', { body: { action: 'status' } })
      add('drive', 'Google Drive prepojenie', error ? 'bad' : data?.connected ? 'ok' : 'warn', error ? 'stav sa nepodarilo načítať' : data?.connected ? `prepojené${data.email ? ` (${data.email})` : ''}` : 'nie je prepojené')
    }

    setChecks(out)
    setCheckedAt(Date.now())
    setRunning(false)
  }, [isAdmin])

  useEffect(() => { run() }, [run])

  useEffect(() => {
    Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'planned'),
      supabase.from('todos').select('id', { count: 'exact', head: true }).neq('status', 'done'),
      supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('carton_movements').select('id', { count: 'exact', head: true }),
    ]).then(([a, b, c, d, e]) =>
      setCounts([
        { label: 'Eventov spolu', n: a.count ?? 0 },
        { label: 'Plánovaných', n: b.count ?? 0 },
        { label: 'Otvorených úloh', n: c.count ?? 0 },
        { label: 'Položiek techniky', n: d.count ?? 0 },
        { label: 'Pohybov kartónov', n: e.count ?? 0 },
      ]),
    )
  }, [])

  const bad = checks.filter((c) => c.state === 'bad').length
  const warn = checks.filter((c) => c.state === 'warn').length

  return (
    <section className="flex flex-col gap-4 min-w-0">
      <h1 className="display text-4xl font-bold">Info</h1>

      {newer && (
        <div className="card p-3 border-2 border-[var(--color-amber)] text-sm">
          <b>K dispozícii je novšia verzia ({newer.version}, {newer.commit}).</b>{' '}
          <button onClick={() => window.location.reload()} className="underline font-semibold text-[var(--color-sky)]">Obnoviť stránku</button>
        </div>
      )}

      <div className="card p-4">
        <p className="text-[11px] uppercase tracking-wider font-semibold muted">Táto verzia</p>
        <p className="display text-4xl font-bold leading-tight">v{__APP_VERSION__}</p>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm mt-2">
          <dt className="muted">Nasadené</dt><dd>{when(__APP_BUILT_AT__)} <span className="muted">({ago(__APP_BUILT_AT__)})</span></dd>
          <dt className="muted">Zmena</dt><dd className="break-words">{__APP_COMMIT_MSG__ || '–'}</dd>
          <dt className="muted">Commit</dt><dd className="font-mono text-xs">{__APP_COMMIT__}</dd>
          <dt className="muted">Prihlásený</dt><dd>{profile?.email} · {profile?.role}</dd>
        </dl>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="display text-xl font-bold flex-1">Stav služieb</h2>
          <button onClick={run} disabled={running} className="h-9 px-3 rounded-lg border line text-sm font-medium disabled:opacity-60">{running ? 'Kontrolujem…' : 'Skontrolovať'}</button>
        </div>
        {checks.length > 0 && (
          <p className="text-sm mb-2" style={{ color: bad ? COLOR.bad : warn ? COLOR.warn : COLOR.ok }}>
            <b>{bad ? `${bad} problém${bad > 1 ? 'y' : ''}` : warn ? `${warn} upozornenie` : 'Všetko beží'}</b>
            {checkedAt && <span className="muted"> · skontrolované {ago(checkedAt)}</span>}
          </p>
        )}
        <ul className="divide-y line text-sm">
          {checks.map((c) => (
            <li key={c.key} className="py-2 flex gap-2">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR[c.state] }} />
              <span className="min-w-0">
                <span className="font-semibold">{c.label}</span>
                <span className="block text-xs muted break-words">{c.detail}</span>
              </span>
            </li>
          ))}
          {checks.length === 0 && <li className="py-2 muted">Kontrolujem…</li>}
        </ul>
      </div>

      {counts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {counts.map((c) => (
            <div key={c.label} className="card p-3">
              <p className="text-[11px] muted leading-tight">{c.label}</p>
              <p className="display text-2xl font-bold">{c.n}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <h2 className="display text-xl font-bold mb-2">Čo ešte nie je</h2>
        <ul className="grid gap-1 text-sm list-disc pl-5">{NOT_YET.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>

      <div className="card p-4">
        <h2 className="display text-xl font-bold mb-2">Zoznam zmien</h2>
        <div className="grid gap-2">
          {CHANGELOG.map((e, i) => (
            <details key={e.version} open={i < 2} className="rounded-lg border line px-3 py-2">
              <summary className="cursor-pointer text-sm">
                <b>v{e.version}</b> <span className="muted">· {e.date}</span> · {e.title}
              </summary>
              <ul className="mt-2 grid gap-1 text-sm list-disc pl-5">{e.items.map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
