import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type SyncResult = { total: number; added: number; updated: number; unchanged: number; restored: number; removed: number }
type SyncRow = { last_synced_at: string | null; last_result: SyncResult | null; last_error: string | null }

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

export function SyncBox({ isAdmin, onSynced }: { isAdmin: boolean; onSynced: () => void }) {
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
  return (
    <div className="card p-4 mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">Basecamp sync</p>
        {!row?.last_synced_at ? (
          <p className="muted">Ešte neprebehol.</p>
        ) : row.last_error ? (
          <p className="text-[var(--color-signal)]">{fmtTime(row.last_synced_at)} · {row.last_error}</p>
        ) : (
          <p className="muted">
            {fmtTime(row.last_synced_at)} · {r?.total ?? 0} eventov v Basecampe, {r?.added ?? 0} nových, {r?.updated ?? 0} zmenených
          </p>
        )}
        <p className="muted text-xs">Beží automaticky každých 15 minút.</p>
        {msg && <p className="mt-1">{msg}</p>}
      </div>
      {isAdmin && (
        <button
          onClick={run}
          disabled={busy}
          className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60 shrink-0"
        >
          {busy ? 'Synchronizujem…' : 'Synchronizovať'}
        </button>
      )}
    </div>
  )
}
