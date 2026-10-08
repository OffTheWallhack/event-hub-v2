// Animované pozadie na canvase (vlny, mriežka, matrix, hviezdy, bubliny). Aura je čisté CSS (styles.css).
export type FxMode = 'none' | 'aura' | 'waves' | 'grid' | 'matrix' | 'stars' | 'bubbles'
export type FxOpts = { mode: FxMode; colors: [string, string, string]; speed: number; int: number }

let canvas: HTMLCanvasElement | null = null
let raf = 0
let stop: (() => void) | null = null

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function ensureCanvas() {
  if (canvas && document.body.contains(canvas)) return canvas
  canvas = document.createElement('canvas')
  canvas.id = 'fx'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)
  return canvas
}

export function setFx(o: FxOpts) {
  cancelAnimationFrame(raf)
  stop?.(); stop = null
  const canvasModes: FxMode[] = ['waves', 'grid', 'matrix', 'stars', 'bubbles']
  if (!canvasModes.includes(o.mode)) { if (canvas) canvas.style.display = 'none'; return }
  const cv = ensureCanvas()
  cv.style.display = 'block'
  cv.style.opacity = String(0.15 + 0.85 * o.int)
  const ctx = cv.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, o.mode === 'matrix' ? 1 : 1.5)
  let w = 0, h = 0
  const resize = () => {
    w = Math.round(window.innerWidth * dpr); h = Math.round(window.innerHeight * dpr)
    cv.width = w; cv.height = h
  }
  resize()
  window.addEventListener('resize', resize)
  const [c1, c2, c3] = o.colors
  const cols = [c1, c2, c3]
  const rnd = Math.random

  // stav jednotlivých režimov
  const fs = 16 * dpr
  let drops: number[] = []
  let stars: { x: number; y: number; z: number; c: string }[] = []
  let bubbles: { x: number; y: number; r: number; v: number; p: number; c: string }[] = []
  let stepAcc = 0
  const initStars = () => { stars = Array.from({ length: Math.round(60 + o.int * 260) }, (_, i) => ({ x: (rnd() - 0.5) * 2, y: (rnd() - 0.5) * 2, z: rnd(), c: cols[i % 3] })) }
  const initBubbles = () => { bubbles = Array.from({ length: Math.round(8 + o.int * 22) }, (_, i) => ({ x: rnd(), y: rnd(), r: (0.02 + rnd() * 0.06), v: 0.02 + rnd() * 0.05, p: rnd() * 6, c: cols[i % 3] })) }
  if (o.mode === 'stars') initStars()
  if (o.mode === 'bubbles') initBubbles()
  const initDrops = () => { drops = Array.from({ length: Math.ceil(w / fs) }, () => Math.floor(rnd() * -40)) }
  initDrops()

  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉ0123456789ABCDEF<>/+*'
  let t = 0
  let last = performance.now()

  const draw = (dt: number) => {
    if (o.mode === 'waves') {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      const amp = h * 0.07
      for (let i = 0; i < 5; i++) {
        const base = h * (0.28 + 0.1 * i)
        for (let pass = 0; pass < 3; pass++) {
          const th = (h * 0.05 + i * 6 * dpr) * (1 + pass * 0.9)
          const g = ctx.createLinearGradient(0, 0, w, 0)
          const col = cols[i % 3]
          g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, 0.38 / (pass + 1))); g.addColorStop(1, rgba(col, 0))
          ctx.fillStyle = g
          ctx.beginPath()
          const step = 10 * dpr
          const xs: number[] = []
          for (let x = 0; x <= w + step; x += step) xs.push(x)
          const top = xs.map((x) => base + Math.sin(x * 0.0035 / dpr * (1 + i * 0.25) + t * (0.5 + i * 0.17) + i * 2) * amp + Math.sin(x * 0.009 / dpr - t * 0.45 + i) * amp * 0.4)
          xs.forEach((x, n) => (n === 0 ? ctx.moveTo(x, top[n]) : ctx.lineTo(x, top[n])))
          for (let n = xs.length - 1; n >= 0; n--) {
            ctx.lineTo(xs[n], top[n] + th * (0.55 + 0.45 * Math.sin(xs[n] * 0.003 / dpr + t * 0.8 + i)))
          }
          ctx.closePath(); ctx.fill()
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    } else if (o.mode === 'grid') {
      ctx.clearRect(0, 0, w, h)
      const hz = h * 0.5
      const R = Math.min(w, h) * 0.3
      const sun = ctx.createLinearGradient(0, hz - R, 0, hz)
      sun.addColorStop(0, rgba(c1, 0.95)); sun.addColorStop(1, rgba(c2, 0.95))
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hz); ctx.clip()
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(w / 2, hz, R, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      for (let i = 1; i < 6; i++) { const y = hz - R * (i / 6.5); ctx.fillRect(w / 2 - R, y, R * 2, i * 1.2 * dpr) }
      ctx.restore()
      ctx.strokeStyle = rgba(c3, 0.85); ctx.lineWidth = 1.3 * dpr
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(w, hz); ctx.stroke()
      for (let k = -14; k <= 14; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * 6 * dpr, hz); ctx.lineTo(w / 2 + k * w * 0.14, h); ctx.stroke() }
      for (let i = 0; i < 12; i++) {
        const z = ((i + t * 0.6) % 12) / 12
        const y = hz + (h - hz) * z * z
        ctx.globalAlpha = Math.min(1, z * 2)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }
      ctx.globalAlpha = 1
    } else if (o.mode === 'matrix') {
      stepAcc += dt * 14 * Math.max(o.speed, 0.0001)
      if (o.speed <= 0) return
      while (stepAcc >= 1) {
        stepAcc -= 1
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
        ctx.font = `${fs}px ui-monospace, Menlo, monospace`
        for (let i = 0; i < drops.length; i++) {
          if (drops[i] < 0) { drops[i]++; continue }
          const ch = glyphs[Math.floor(rnd() * glyphs.length)]
          ctx.fillStyle = rgba(c2, 0.9); ctx.fillText(ch, i * fs, drops[i] * fs)
          ctx.fillStyle = rgba(c1, 1); ctx.fillText(glyphs[Math.floor(rnd() * glyphs.length)], i * fs, (drops[i] + 1) * fs)
          drops[i]++
          if (drops[i] * fs > h && rnd() > 0.96) drops[i] = Math.floor(rnd() * -20)
        }
      }
    } else if (o.mode === 'stars') {
      ctx.clearRect(0, 0, w, h)
      const f = Math.min(w, h) * 0.6
      for (const s of stars) {
        s.z -= dt * 0.12 * o.speed
        if (s.z <= 0.02) { s.z = 1; s.x = (rnd() - 0.5) * 2; s.y = (rnd() - 0.5) * 2 }
        const sx = w / 2 + (s.x / s.z) * f * 0.5
        const sy = h / 2 + (s.y / s.z) * f * 0.5
        if (sx < 0 || sx > w || sy < 0 || sy > h) { s.z = 1; continue }
        ctx.fillStyle = rgba(s.c, 0.35 + 0.65 * (1 - s.z))
        ctx.beginPath(); ctx.arc(sx, sy, (0.4 + (1 - s.z) * 2.2) * dpr, 0, Math.PI * 2); ctx.fill()
      }
    } else if (o.mode === 'bubbles') {
      ctx.clearRect(0, 0, w, h)
      for (const b of bubbles) {
        b.y -= dt * b.v * o.speed
        b.p += dt * 0.8 * o.speed
        if (b.y < -0.15) { b.y = 1.15; b.x = rnd() }
        const x = (b.x + Math.sin(b.p) * 0.03) * w, y = b.y * h, r = b.r * Math.min(w, h) * 1.6
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
        g.addColorStop(0, rgba('#ffffff', 0.55)); g.addColorStop(0.35, rgba(b.c, 0.3)); g.addColorStop(1, rgba(b.c, 0.06))
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(b.c, 0.35); ctx.lineWidth = dpr; ctx.stroke()
      }
    }
  }

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    if (now - last < 32) return
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    t += dt * o.speed
    draw(dt)
  }
  draw(0)
  raf = requestAnimationFrame(frame)
  stop = () => window.removeEventListener('resize', resize)
}
