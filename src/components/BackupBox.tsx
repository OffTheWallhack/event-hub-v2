import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Last = { at: string; ok: boolean; name?: string; url?: string; tables?: number; rows?: number; kb?: number; error?: string }

async function call(action: string) {
  const { data, error } = await supabase.functions.invoke('backup', { body: { action } })
  if (error) {
    let detail = error.message
    try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return data as { last: Last | null }
}

const fmt = (iso: string) => new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Nastavenia → Zálohy. Automaticky o 0:00 a 12:00, tu je posledná záloha a tlačidlo „Zálohovať teraz“. */
export function BackupBox() {
  const [last, setLast] = useState<Last | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { call('status').then((r) => setLast(r.last)).catch((e) => setErr(e.message)) }, [])

  async function run() {
    setBusy(true); setErr(null)
    try { setLast((await call('run')).last) } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="card p-4 mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">Zálohy dát na Google Drive</p>
        {!last ? (
          <p className="muted">Ešte žiadna záloha.</p>
        ) : last.ok ? (
          <p className="muted">
            {fmt(last.at)} · {last.tables} tabuliek, {last.rows} riadkov, {last.kb} kB
            {last.url && <> · <a href={last.url} target="_blank" rel="noreferrer" className="underline">otvoriť</a></>}
          </p>
        ) : (
          <p className="text-[var(--color-signal)]">{fmt(last.at)} · zlyhala: {last.error}</p>
        )}
        <p className="muted text-xs">Automaticky každý deň o 0:00 a o 12:00 (Drive: Event Hub / Zálohy). Fotky v súbore nie sú.</p>
        {err && <p className="text-[var(--color-signal)]">{err}</p>}
      </div>
      <button onClick={run} disabled={busy} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60 shrink-0">
        {busy ? 'Zálohujem…' : 'Zálohovať teraz'}
      </button>
    </div>
  )
}
