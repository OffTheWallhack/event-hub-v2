import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'

/** Fotku zmenší (dlhšia strana max 1800 px, JPEG) – nahrá sa rýchlejšie a doklad je stále čitateľný. PDF a chyby nechá tak. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export type DriveFile = { id: string; name: string; url: string }

/** Nahrá doklad do Drive cez Edge Function s hlásením priebehu (0–100) pri odosielaní na server. */
export async function uploadReceipt(
  file: File,
  meta: { date: string; amount: number; shop: string },
  onProgress: (sent: number) => void,
): Promise<DriveFile> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Si odhlásený. Prihlás sa znova.')

  const fd = new FormData()
  fd.append('file', file)
  fd.append('date', meta.date)
  fd.append('amount', String(meta.amount))
  fd.append('shop', meta.shop)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/functions/v1/drive`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_KEY)
    xhr.timeout = 120_000
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.upload.onload = () => onProgress(100)
    xhr.onerror = () => reject(new Error('Spojenie sa prerušilo. Súbor v Drive už mohol vzniknúť, skontroluj priečinok. Skús znova.'))
    xhr.ontimeout = () => reject(new Error('Nahrávanie trvalo príliš dlho. Súbor v Drive už mohol vzniknúť, skontroluj priečinok. Skús znova.'))
    xhr.onload = () => {
      let body: { id?: string; name?: string; url?: string; error?: string } = {}
      try { body = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve({ id: body.id!, name: body.name!, url: body.url })
      else reject(new Error(body.error ?? `Nahrávanie zlyhalo (${xhr.status}).`))
    }
    xhr.send(fd)
  })
}

export const driveId = (url: string | null | undefined) => url?.match(/\/d\/([\w-]+)/)?.[1] ?? null
