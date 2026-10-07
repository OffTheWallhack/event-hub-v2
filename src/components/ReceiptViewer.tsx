import { useState } from 'react'
import { driveId } from '../lib/receipt'

/**
 * Náhľad dokladu: malý pás hore (ostáva viditeľný pri písaní údajov), ťuknutím sa otvorí na celú obrazovku
 * s tlačidlami + / − a posúvaním. Pre PDF alebo nenačítaný obrázok sa ukáže odkaz.
 */
export function ReceiptViewer({ localUrl, isPdf, driveUrl }: { localUrl: string | null; isPdf: boolean; driveUrl: string | null }) {
  const [full, setFull] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [broken, setBroken] = useState(false)

  const id = driveId(driveUrl)
  const src = localUrl && !isPdf ? localUrl : id ? `https://drive.google.com/thumbnail?id=${id}&sz=w2000` : null
  if (!src && !driveUrl && !localUrl) return null

  const link = driveUrl && (
    <a href={driveUrl} target="_blank" rel="noreferrer" className="text-[var(--color-sky)] text-sm font-semibold">Otvoriť doklad v Drive ↗</a>
  )
  if (!src || broken || isPdf) {
    return <div className="card p-3 text-sm">{isPdf && localUrl ? 'PDF doklad je vybraný.' : 'Náhľad nie je k dispozícii.'} {link}</div>
  }

  const close = () => { setFull(false); setZoom(1) }
  return (
    <>
      <div className="sticky top-14 z-10 -mx-1 px-1 py-1" style={{ background: 'var(--card)' }}>
        <button onClick={() => setFull(true)} className="relative block w-full h-36 rounded-xl overflow-hidden border line bg-black/5" aria-label="Zväčšiť doklad">
          <img src={src} alt="Doklad" className="w-full h-full object-contain" onError={() => setBroken(true)} />
          <span className="absolute bottom-1 right-1 px-2 py-1 rounded-lg bg-black/70 text-white text-xs font-semibold">🔍 Zväčšiť</span>
        </button>
      </div>

      {full && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex items-center gap-2 p-2">
            <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="w-12 h-12 rounded-xl bg-white/15 text-white text-2xl" aria-label="Oddialiť">−</button>
            <span className="text-white text-sm w-14 text-center">{Math.round(zoom * 100)} %</span>
            <button onClick={() => setZoom((z) => Math.min(5, z + 0.5))} className="w-12 h-12 rounded-xl bg-white/15 text-white text-2xl" aria-label="Priblížiť">+</button>
            <button onClick={close} className="ml-auto h-12 px-5 rounded-xl bg-white text-black font-semibold">Zavrieť</button>
          </div>
          <div className="flex-1 overflow-auto" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
            <img src={src} alt="Doklad" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="block mx-auto" onClick={() => setZoom((z) => (z >= 2 ? 1 : z + 1))} />
          </div>
          <p className="text-white/60 text-xs text-center p-2">Ťuknutím na doklad priblížiš, dvoma prstami môžeš aj hýbať a približovať.</p>
        </div>
      )}
      {link && <div className="text-xs">{link}</div>}
    </>
  )
}
