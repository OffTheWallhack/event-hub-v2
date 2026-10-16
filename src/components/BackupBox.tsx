import { useEffect, useState } from 'react'
import { DatabaseBackup } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Section } from './ui'

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
    <Section
      title="Zálohy na Google Drive"
      sub="Automaticky každý deň o 0:00 a 12:00 (Event Hub / Zálohy). Fotky v zálohe nie sú."
      action={<button onClick={run} disabled={busy} className="btn btn-sm"><DatabaseBackup aria-hidden />{busy ? 'Zálohujem…' : 'Zálohovať'}</button>}
    >
      <div className="text-sm">
        {!last ? (
          <p className="muted">Ešte žiadna záloha.</p>
        ) : last.ok ? (
          <p>
            Posledná {fmt(last.at)} <span className="muted">· {last.tables} tabuliek, {last.rows} riadkov, {last.kb} kB</span>
            {last.url && <> · <a href={last.url} target="_blank" rel="noreferrer" className="link">otvoriť</a></>}
          </p>
        ) : (
          <p className="err">{fmt(last.at)} · zlyhala: {last.error}</p>
        )}
        {err && <p className="err mt-1">{err}</p>}
      </div>
    </Section>
  )
}
