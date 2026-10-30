// Fotky z eventov: súkromný priečinok `event-photos` + tabuľka event_photos (cesta k súboru).
// Zobrazujú sa cez dočasné podpísané odkazy (platia 2 hodiny).
import { supabase } from './supabase'
import { prepareImage } from './media'

export const PHOTO_BUCKET = 'event-photos'

export type EventPhoto = { id: string; path: string; url: string }

/** Načíta fotky eventu s odkazmi na zobrazenie. Riadky, ktorých súbor chýba (staré zo starej appky), vynechá. */
export async function loadEventPhotos(eventId: string): Promise<EventPhoto[]> {
  const { data, error } = await supabase
    .from('event_photos')
    .select('id, path')
    .eq('event_id', eventId)
    .not('path', 'is', null)
    .order('created_at')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { id: string; path: string }[]
  if (rows.length === 0) return []
  const { data: signed, error: e2 } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.path), 7200)
  if (e2) throw new Error(e2.message)
  const urlOf = new Map((signed ?? []).filter((s) => s.signedUrl && !s.error).map((s) => [s.path, s.signedUrl]))
  return rows.flatMap((r) => (urlOf.has(r.path) ? [{ id: r.id, path: r.path, url: urlOf.get(r.path)! }] : []))
}

/** Nahrá fotku (zmenšenú na max 1600 px) a zapíše ju k eventu. */
export async function uploadEventPhoto(eventId: string, file: File): Promise<void> {
  const { blob, ext } = await prepareImage(file, 1600)
  const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg'),
    cacheControl: '31536000',
  })
  if (up.error) throw new Error(up.error.message)
  const ins = await supabase.from('event_photos').insert({ event_id: eventId, path })
  if (ins.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
    throw new Error(ins.error.message)
  }
}

/** Zmaže fotku zo zoznamu aj súbor. */
export async function deleteEventPhoto(p: Pick<EventPhoto, 'id' | 'path'>): Promise<void> {
  const del = await supabase.from('event_photos').delete().eq('id', p.id)
  if (del.error) throw new Error(del.error.message)
  await supabase.storage.from(PHOTO_BUCKET).remove([p.path])
}
