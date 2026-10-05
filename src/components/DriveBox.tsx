import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Status = { configured: boolean; connected: boolean; email: string | null }

/** Nastavenia → prepojenie Google Drive (doklady sa ukladajú do Event Hub / Účty / YYYY-MM). */
export function DriveBox() {
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(() => {
    const r = new URLSearchParams(window.location.search).get('drive')
    return r === 'ok' ? 'Google Drive je prepojený.' : r === 'chyba' ? 'Prepojenie zlyhalo, skús znova.' : null
  })

  async function load() {
    const { data, error } = await supabase.functions.invoke('drive', { body: { action: 'status' } })
    if (error) setMsg('Stav Drive sa nepodarilo načítať.')
    else setSt(data as Status)
  }
  useEffect(() => { load() }, [])

  async function connect() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('drive', { body: { action: 'start' } })
    if (error || !data?.url) { setBusy(false); setMsg('Nepodarilo sa začať prepojenie.'); return }
    window.location.href = data.url
  }

  async function disconnect() {
    if (!confirm('Odpojiť Google Drive? Súbory v Drive ostanú.')) return
    await supabase.functions.invoke('drive', { body: { action: 'disconnect' } })
    load()
  }

  return (
    <div className="card p-4 mt-6">
      <h2 className="display text-2xl font-bold">Google Drive</h2>
      <p className="text-sm muted">Doklady sa ukladajú do priečinka Event Hub / Účty / mesiac.</p>
      {!st ? (
        <p className="muted text-sm mt-2">Načítavam…</p>
      ) : !st.configured ? (
        <p className="text-sm mt-2 text-[var(--color-signal)]">Chýbajú secrets GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET v Supabase.</p>
      ) : st.connected ? (
        <div className="flex items-center gap-3 mt-3">
          <p className="flex-1 text-sm">Prepojené{st.email ? <> s <b>{st.email}</b></> : ''}.</p>
          <button onClick={disconnect} className="h-10 px-4 rounded-lg border line text-sm">Odpojiť</button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy} className="mt-3 h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">
          {busy ? 'Presmerovávam…' : 'Prepojiť Google Drive'}
        </button>
      )}
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  )
}
