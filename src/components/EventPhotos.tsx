import { useEffect, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Empty, ErrorText } from './ui'
import { type EventPhoto, deleteEventPhoto, loadEventPhotos, uploadEventPhoto } from '../lib/eventPhotos'

/** Fotky z eventu: admin nahrá naraz aj viac fotiek a môže ich zmazať, ostatní ich len vidia. */
export function EventPhotos({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const [photos, setPhotos] = useState<EventPhoto[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<EventPhoto | null>(null)

  async function load() {
    try { setPhotos(await loadEventPhotos(eventId)) } catch (e) { setError((e as Error).message); setPhotos([]) }
  }
  useEffect(() => { setPhotos(null); setError(null); load() }, [eventId])

  async function add(files: FileList | null) {
    const list = [...(files ?? [])]
    if (list.length === 0) return
    setError(null)
    let failed = 0
    let last = ''
    for (let i = 0; i < list.length; i++) {
      setBusy(list.length > 1 ? `Nahrávam ${i + 1}/${list.length}…` : 'Nahrávam…')
      try { await uploadEventPhoto(eventId, list[i]) } catch (e) { failed++; last = (e as Error).message }
    }
    if (failed) setError(`Nenahralo sa ${failed} z ${list.length} (${last}).`)
    setBusy(null)
    load()
  }

  async function remove(p: EventPhoto) {
    if (!window.confirm('Zmazať túto fotku?')) return
    setError(null)
    setPhotos((l) => l?.filter((x) => x.id !== p.id) ?? l)
    try { await deleteEventPhoto(p) } catch (e) { setError((e as Error).message); load() }
  }

  return (
    <div className="grid gap-3">
      <ErrorText>{error}</ErrorText>
      {photos === null ? (
        <p className="text-sm muted">Načítavam…</p>
      ) : photos.length === 0 ? (
        <Empty>Zatiaľ žiadne fotky.</Empty>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square">
              <button type="button" onClick={() => setOpen(p)} className="block w-full h-full" aria-label="Zväčšiť fotku">
                <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover rounded-[var(--ctl-r)] bg-[var(--fill)]" />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full grid place-items-center bg-black/60 text-white"
                  aria-label="Zmazať fotku"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && (
        <label className={'btn btn-sm justify-self-start cursor-pointer ' + (busy ? 'opacity-60 pointer-events-none' : '')}>
          <ImagePlus aria-hidden />{busy ?? 'Pridať fotky'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        </label>
      )}

      {open && (
        <button type="button" onClick={() => setOpen(null)} className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-3" aria-label="Zavrieť">
          <img src={open.url} alt="" className="max-w-full max-h-full object-contain rounded-[var(--ctl-r)]" />
        </button>
      )}
    </div>
  )
}
