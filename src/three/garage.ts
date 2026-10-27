// 3D garáž: Zubor a Sugga zaparkované v tmavej, mierne zadymenej garáži.
// Načíta sa len keď treba (dynamický import), aby appka ostala rýchla.
// Modely: public/models/*.glb (meshopt + webp, ~0,6 MB každý).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type GarageOptions = {
  /** Dá sa otáčať prstom/myšou a približovať (showroom). Na úvodnej obrazovke je len jemné samootáčanie. */
  interactive?: boolean
  onProgress?: (fraction: number) => void
  onReady?: () => void
  onError?: (message: string) => void
}

export type GarageHandle = { dispose: () => void }

// model je dlhý po osi X; otočíme ho, aby stál predkom ku kamere (+Z)
const CARS = [
  { name: 'Zubor', url: '/models/Zubor.glb', x: -1.75, rotY: Math.PI / 2 + 0.1 },
  { name: 'Sugga', url: '/models/Sugga.glb', x: 1.75, rotY: Math.PI / 2 - 0.1 },
]
const CAR_SCALE = 2.45 // model má ~1,9 m, reálne auto ~4,6 m

// Chladnička Red Bull: zatiaľ len náhrada (box so svietiacim čelom). Keď bude model, daj sem jeho URL.
const FRIDGE_URL: string | null = null

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Jemná betónová textúra podlahy (šum + spoje dlaždíc), generuje sa v prehliadači. */
function concreteTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#2a2a2d'
  g.fillRect(0, 0, S, S)
  const img = g.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n + 2
  }
  g.putImageData(img, 0, 0)
  // škvrny
  for (let i = 0; i < 40; i++) {
    const r = rand(20, 90)
    const grd = g.createRadialGradient(rand(0, S), rand(0, S), 0, rand(0, S), rand(0, S), r)
    grd.addColorStop(0, `rgba(0,0,0,${rand(0.05, 0.18)})`)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)
  }
  // spoje dlaždíc
  g.strokeStyle = 'rgba(0,0,0,0.45)'
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, S - 3, S - 3)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 10)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Mäkký kruh pre dym a iskry. */
function softDot(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

export function mountGarage(canvas: HTMLCanvasElement, opts: GarageOptions = {}): GarageHandle {
  const disposables: { dispose: () => void }[] = []
  let dead = false

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050507)
  // jemné odrazy na laku (bez nich je kovový lak úplne čierny)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.22
  pmrem.dispose()
  scene.fog = new THREE.FogExp2(0x07070a, 0.075)

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
  camera.position.set(4.2, 2.2, 7.2)
  const lookAt = new THREE.Vector3(0, 0.55, 0)

  const controls = new OrbitControls(camera, canvas)
  controls.target.copy(lookAt)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = 4.5
  controls.maxDistance = 12
  controls.minPolarAngle = 0.95
  controls.maxPolarAngle = 1.48
  controls.minAzimuthAngle = -1.05
  controls.maxAzimuthAngle = 1.05
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  controls.enableZoom = !!opts.interactive
  controls.enableRotate = !!opts.interactive
  controls.enabled = !!opts.interactive
  disposables.push(controls)
  // bez interakcie sa kamera sama jemne pohupuje okolo áut
  let camDist = 8.6
  let camBaseAz = 0.5
  let camPolar = 1.25
  let camAmp = 0.42

  // ---- miestnosť ----
  const floorTex = concreteTexture()
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6e6e72, roughness: 0.72, metalness: 0.1 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.95, metalness: 0 })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), wallMat)
  back.position.set(0, 3, -6.5)
  back.receiveShadow = true
  scene.add(back)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), wallMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = 4.6
  scene.add(ceiling)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), wallMat)
    side.rotation.y = -sx * Math.PI / 2
    side.position.set(sx * 9.5, 3, 0)
    scene.add(side)
  }
  // žltá čiara na podlahe medzi parkovacími miestami
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd9b84a, roughness: 0.9 })
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5.5), lineMat)
  line.rotation.x = -Math.PI / 2
  line.position.set(0, 0.002, 0)
  scene.add(line)

  // ---- svetlá ----
  scene.add(new THREE.AmbientLight(0x5566aa, 0.12))
  const hemi = new THREE.HemisphereLight(0x3a4466, 0x0a0a0c, 0.18)
  scene.add(hemi)
  // slabé stropné svetlo vzadu, aby bolo vidieť, že je to miestnosť
  const roomLight = new THREE.PointLight(0x8899bb, 14, 18, 1.8)
  roomLight.position.set(0, 4.2, -3)
  scene.add(roomLight)

  function spot(color: number, intensity: number, pos: [number, number, number], target: [number, number, number], angle = 0.5, shadow = true) {
    const s = new THREE.SpotLight(color, intensity, 16, angle, 0.55, 1.6)
    s.position.set(...pos)
    s.target.position.set(...target)
    s.castShadow = shadow
    if (shadow) {
      s.shadow.mapSize.set(1024, 1024)
      s.shadow.bias = -0.0005
      s.shadow.radius = 4
    }
    scene.add(s, s.target)
    return s
  }

  // ---- autá ----
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const carRoot = new THREE.Group()
  scene.add(carRoot)
  let loaded = 0
  const perCar: number[] = CARS.map(() => 0)
  const report = () => opts.onProgress?.(perCar.reduce((a, b) => a + b, 0) / CARS.length)

  CARS.forEach((c, i) => {
    loader.load(
      c.url,
      (gltf) => {
        if (dead) return
        const m = gltf.scene
        m.scale.setScalar(CAR_SCALE)
        // postav na podlahu
        const box = new THREE.Box3().setFromObject(m)
        m.position.set(c.x, -box.min.y, 0)
        m.rotation.y = c.rotY
        m.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh) return
          mesh.castShadow = true
          mesh.receiveShadow = true
          const mat = mesh.material as THREE.MeshStandardMaterial
          if (mat?.isMeshStandardMaterial) {
            mat.side = THREE.FrontSide
            // model prišiel bez mapy kov/drsnosť – nastavíme lak ručne
            if (!mat.metalnessMap) { mat.metalness = 0.35; mat.roughness = 0.45 }
            mat.envMapIntensity = 0.9
          }
        })
        carRoot.add(m)
        // hlavné svetlo: spredu zhora na predok auta a logo
        spot(0xfff2dc, 620, [c.x * 0.6, 4.3, 4.2], [c.x, 0.7, 1.4], 0.4)
        // bočné svetlo na logo na dverách
        spot(0xffe9cf, 360, [c.x + (i === 0 ? -3.6 : 3.6), 3.2, 0.6], [c.x, 0.85, 0], 0.4, false)
        perCar[i] = 1
        report()
        if (++loaded === CARS.length) opts.onReady?.()
      },
      (e) => { if (e.total) { perCar[i] = Math.min(0.95, e.loaded / e.total); report() } },
      () => opts.onError?.(`Model ${c.name} sa nepodarilo načítať.`),
    )
  })

  // ---- pokazená dióda vzadu na stene (bliká a iskrí) ----
  const dot = softDot()
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x9fbfff, emissive: 0xbfe0ff, emissiveIntensity: 0, roughness: 0.3 })
  const tube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), tubeMat)
  tube.position.set(-2.2, 3.7, -6.4)
  scene.add(tube)
  const tubeLight = new THREE.PointLight(0xcfe4ff, 0, 7, 1.8)
  tubeLight.position.set(-2.2, 3.55, -6.0)
  scene.add(tubeLight)
  let tubeOn = 0 // 0–1
  let tubeNext = 0

  const SPARKS = 80
  const sparkPos = new Float32Array(SPARKS * 3)
  const sparkVel = new Float32Array(SPARKS * 3)
  const sparkLife = new Float32Array(SPARKS) // 0 = mŕtva
  const sparkGeo = new THREE.BufferGeometry()
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
  const sparkMat = new THREE.PointsMaterial({ map: dot, color: 0xffb060, size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
  const sparks = new THREE.Points(sparkGeo, sparkMat)
  sparks.frustumCulled = false
  scene.add(sparks)
  for (let i = 0; i < SPARKS; i++) sparkPos[i * 3 + 1] = -10

  function burst(n: number) {
    for (let i = 0; i < SPARKS && n > 0; i++) {
      if (sparkLife[i] > 0) continue
      sparkLife[i] = rand(0.35, 0.9)
      sparkPos[i * 3] = tube.position.x - 0.72 + rand(-0.03, 0.03)
      sparkPos[i * 3 + 1] = tube.position.y - 0.02
      sparkPos[i * 3 + 2] = tube.position.z + 0.06
      sparkVel[i * 3] = rand(-1.4, 0.6)
      sparkVel[i * 3 + 1] = rand(-0.6, 1.2)
      sparkVel[i * 3 + 2] = rand(0.2, 1.6)
      n--
    }
  }

  // ---- chladnička vzadu (náhrada, kým nie je model) ----
  const fridge = new THREE.Group()
  fridge.position.set(4.6, 0, -5.4)
  fridge.rotation.y = -0.35
  scene.add(fridge)
  const fridgeLight = new THREE.PointLight(0x3b7bff, 0, 5, 1.8)
  fridgeLight.position.set(0, 1.1, 0.7)
  fridge.add(fridgeLight)
  let fridgeGlow = 0
  if (!FRIDGE_URL) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2c, roughness: 0.5, metalness: 0.4 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.95, 0.75), bodyMat)
    body.position.y = 0.975
    body.castShadow = true
    fridge.add(body)
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x1540b8, emissive: 0x1f55ff, emissiveIntensity: 1.1, roughness: 0.25 })
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.45), faceMat)
    face.position.set(0, 1.08, 0.378)
    fridge.add(face)
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xcc1133, emissive: 0xff2244, emissiveIntensity: 0.9 })
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.12), stripeMat)
    stripe.position.set(0, 1.88, 0.378)
    fridge.add(stripe)
    fridgeGlow = 1
  }

  // ---- dym pri podlahe ----
  const smokeMat = new THREE.SpriteMaterial({ map: dot, color: 0x8a8f9c, transparent: true, opacity: 0.07, depthWrite: false })
  const smokes: { s: THREE.Sprite; vx: number; vz: number; rot: number }[] = []
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(smokeMat)
    const sc = rand(2.5, 5)
    s.scale.set(sc, sc, 1)
    s.position.set(rand(-7, 7), rand(0.2, 0.9), rand(-5, 4))
    s.material.rotation = rand(0, Math.PI * 2)
    scene.add(s)
    smokes.push({ s, vx: rand(-0.05, 0.05), vz: rand(-0.03, 0.03), rot: rand(-0.03, 0.03) })
  }

  // ---- veľkosť ----
  let lastPortrait: boolean | null = null
  function resize() {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    const portrait = w / h < 0.85
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
    }
    if (portrait !== lastPortrait) {
      lastPortrait = portrait
      // na výšku je záber širší a kamera ďalej; na úvodnej obrazovke sú autá vyššie, aby pod nimi ostalo miesto na text
      camera.fov = portrait ? 54 : 38
      if (opts.interactive) {
        controls.target.set(0, 0.55, 0)
        camDist = portrait ? 11 : 8.6
        controls.minDistance = portrait ? 7 : 4.5
        controls.maxDistance = portrait ? 16 : 12
        camera.position.set(4.2, 2.2, 7.2).normalize().multiplyScalar(camDist).add(controls.target)
        controls.update()
      } else {
        controls.target.set(0, portrait ? -1.6 : -0.45, 0) // autá vyššie, dole je text
        camDist = portrait ? 14 : 8.6
        camBaseAz = portrait ? 0.2 : 0.5
        camAmp = portrait ? 0.2 : 0.42
      }
    }
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  // ---- slučka ----
  const clock = new THREE.Clock()
  let hidden = document.hidden
  const onVis = () => { hidden = document.hidden; if (!hidden) clock.getDelta() }
  document.addEventListener('visibilitychange', onVis)

  renderer.setAnimationLoop(() => {
    if (dead || hidden) return
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    // dióda: väčšinou slabo svieti, občas sa rozbliká a zaiskrí
    if (t > tubeNext) {
      const r = Math.random()
      if (r < 0.55) { tubeOn = rand(0, 0.25); tubeNext = t + rand(0.3, 1.6) }
      else if (r < 0.85) { tubeOn = rand(0.7, 1); tubeNext = t + rand(0.05, 0.25); if (Math.random() < 0.5) burst(Math.round(rand(4, 12))) }
      else { tubeOn = 0; tubeNext = t + rand(0.04, 0.12); burst(Math.round(rand(8, 18))) }
    }
    tubeMat.emissiveIntensity = tubeOn * 2.4
    tubeLight.intensity = tubeOn * 18

    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue
      sparkLife[i] -= dt
      sparkVel[i * 3 + 1] -= 4.5 * dt
      sparkPos[i * 3] += sparkVel[i * 3] * dt
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt
      if (sparkLife[i] <= 0 || sparkPos[i * 3 + 1] < 0.01) { sparkLife[i] = 0; sparkPos[i * 3 + 1] = -10 }
    }
    sparkGeo.attributes.position.needsUpdate = true

    if (fridgeGlow) fridgeLight.intensity = 5 + Math.sin(t * 1.3) * 1.2 + Math.sin(t * 7.1) * 0.3

    for (const sm of smokes) {
      sm.s.position.x += sm.vx * dt
      sm.s.position.z += sm.vz * dt
      sm.s.material.rotation += sm.rot * dt
      if (sm.s.position.x > 8) sm.s.position.x = -8
      if (sm.s.position.x < -8) sm.s.position.x = 8
    }

    if (opts.interactive) {
      controls.update()
    } else {
      const az = camBaseAz + (reduced ? 0 : Math.sin(t * 0.13) * camAmp)
      const pol = camPolar + (reduced ? 0 : Math.sin(t * 0.09 + 1) * 0.06)
      camera.position.set(
        controls.target.x + camDist * Math.sin(pol) * Math.sin(az),
        controls.target.y + camDist * Math.cos(pol),
        controls.target.z + camDist * Math.sin(pol) * Math.cos(az),
      )
      camera.lookAt(controls.target)
    }
    renderer.render(scene, camera)
  })

  return {
    dispose() {
      dead = true
      renderer.setAnimationLoop(null)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      for (const d of disposables) d.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        for (const mat of mats) {
          for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
          mat.dispose()
        }
      })
      renderer.dispose()
    },
  }
}
