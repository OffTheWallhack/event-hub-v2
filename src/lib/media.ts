import { SUPABASE_URL, supabase } from './supabase'

export type MediaKind = 'flavor-photos' | 'equipment-photos' | 'vehicle-photos'

/** Verejná adresa obrázka v priečinku `media` (kind = podpriečinok, path = cesta uložená v databáze). */
export const mediaUrl = (kind: MediaKind, path: string | null | undefined) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/media/${kind}/${path.split('/').map(encodeURIComponent).join('/')}` : null

/** Zmenší obrázok (dlhšia strana max `max` px). PNG/WebP/AVIF ostanú PNG kvôli priehľadnosti (logá), fotky idú ako JPEG. */
export async function prepareImage(file: File, max = 1000): Promise<{ blob: Blob; ext: 'png' | 'jpg' }> {
  const alpha = /png|webp|avif|gif/.test(file.type)
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, alpha ? 'image/png' : 'image/jpeg', 0.85))
    if (blob) return { blob, ext: alpha ? 'png' : 'jpg' }
  } catch { /* spadne na originál */ }
  return { blob: file, ext: file.type.includes('png') ? 'png' : 'jpg' }
}

/** Nahrá obrázok a vráti cestu na uloženie do databázy: `<id>/<čas>.<prípona>`. */
export async function uploadMedia(kind: MediaKind, id: string, file: File): Promise<string> {
  const { blob, ext } = await prepareImage(file)
  const path = `${id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('media').upload(`${kind}/${path}`, blob, {
    contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : 'png'}`,
    cacheControl: '31536000',
  })
  if (error) throw new Error(error.message)
  return path
}
