import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Section } from './ui'

type SyncResult = { total: number; added: number; updated: number; unchanged: number; restored: number; removed: number }
type SyncRow = { last_synced_at: string | null; last_result: SyncResult | null; last_error: string | null }

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'práve teraz' : min < 60 ? `pred ${min} min` : min < 48 * 60 ? `pred ${Math.round(min / 60)} h` : fmtTime(iso)
}

/** Stav synchronizácie s Basecampom. compact = jeden riadok (pod kalendárom). */
export function SyncBox({ isAdmin, onSynced, compact }: { isAdmin: boolean; onSynced: () => void; compact?: boolean }) {
  const [row, setRow] = useState<SyncRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('sync_status').select('last_synced_at, last_result, last_error').eq('key', 'basecamp_ical').maybeSingle()
    setRow((data as SyncRow) ?? null)
  }
  useEffect(() => { load() }, [])

  async function run() {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.functions.invoke('ics-sync', { method: 'POST' })
    setBusy(false)
    if (error) {
      // pri chybe funkcia vracia { error } v tele odpovede
      let detail = error.message
      try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail } catch { /* ignore */ }
      setMsg(detail)
    } else if (data?.result) {
      const r = data.result as SyncResult
      setMsg(`Hotovo: ${r.added} nových, ${r.updated} zmenených, ${r.removed} zmiznutých z Basecampu.`)
      onSynced()
    }
    load()
  }

  const r = row?.last_result
  const status = !row?.last_synced_at
    ? <span className="muted">Ešte neprebehla.</span>
    : row.last_error
      ? <span className="err">{fmtTime(row.last_synced_at)} · {row.last_error}</span>
      : <span className="muted">{compact ? `Basecamp synchronizovaný ${ago(row.last_synced_at)}` : `${fmtTime(row.last_synced_at)} · ${r?.total ?? 0} eventov v Basecampe, ${r?.added ?? 0} nových, ${r?.updated ?? 0} zmenených`}</span>

  const button = isAdmin && (
    <button onClick={run} disabled={busy} className={compact ? 'btn btn-sm btn-quiet' : 'btn btn-sm'} title="Synchronizovať teraz">
      <RefreshCw className={busy ? 'animate-spin' : ''} aria-hidden />{compact ? (busy ? 'Synchronizujem…' : 'Teraz') : busy ? 'Synchronizujem…' : 'Synchronizovať'}
    </button>
  )

  if (compact) {
    return (
      <div className="text-sm">
        <div className="flex items-center gap-2 min-h-9">
          <p className="flex-1 min-w-0 truncate">{status}</p>
          {button}
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    )
  }
  return (
    <Section title="Basecamp" sub="Synchronizuje sa automaticky každých 15 minút." action={button}>
      <p className="text-sm">{status}</p>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </Section>
  )
}
