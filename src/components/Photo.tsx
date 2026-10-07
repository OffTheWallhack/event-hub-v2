import { useState } from 'react'
import { type MediaKind, mediaUrl, uploadMedia } from '../lib/media'

/** Obrázok z priečinka media. Ak chýba alebo sa nenačíta, ukáže sa `fallback` (napr. ikonka). */
export function Photo({ kind, path, alt, className, fallback }: {
  kind: MediaKind; path: string | null | undefined; alt: string; className?: string; fallback?: React.ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const url = mediaUrl(kind, path)
  if (!url || broken) return <>{fallback ?? null}</>
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)} />
}

/** Tlačidlo na nahratie / výmenu obrázka (admin). Po nahratí zavolá onUploaded s novou cestou. */
export function PhotoUpload({ kind, id, onUploaded, label = 'Nahrať obrázok' }: {
  kind: MediaKind; id: string; onUploaded: (path: string) => void | Promise<void>; label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    setError(null)
    try { await onUploaded(await uploadMedia(kind, id, f)) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  return (
    <span className="grid gap-1">
      <label className={'inline-flex items-center justify-center h-10 px-4 rounded-lg border line text-sm font-medium cursor-pointer ' + (busy ? 'opacity-60 pointer-events-none' : '')}>
        {busy ? 'Nahrávam…' : label}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {error && <span className="text-xs text-[var(--color-signal)]">{error}</span>}
    </span>
  )
}
