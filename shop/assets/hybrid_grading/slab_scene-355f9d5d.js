// The spinning slab's scene (hybrid_grading/shared/_spinning_slab), in WebGL:
// a housing's CAD model, the clear case's two halves in clear plastic wearing
// the scans of the real housing and the glass's metal frame wearing its own,
// the glass's panes clear and its corner magnets glossy black; the card
// wearing its front and back scans, and the two labels their prints.
// createSlabScene draws it on a canvas; render turns it to an angle.
import { GLTFLoader, RoomEnvironment, THREE, toCreasedNormals } from "three"
import { planarUV, splitBySide } from "hybrid_grading/slab_faces"

const FOV = 30
const CREASE = THREE.MathUtils.degToRad(40)
const CARD_EDGE = 0xcfc9bb
const FRAME_EDGE = 0x303030
// How strongly the clear parts reflect the room. Their reflections are added
// to the canvas's sRGB values rather than to linear light, which makes a faint
// reflection read far brighter: at full strength (1) the card behind a pane
// came out ~40 levels lighter, at 0.1 ~7, as three.js's transmission left it,
// with a turn still catching a glint. A calibration knob.
const REFLECTIVITY = 0.1
// Dead front on, the panes throw the room's light straight back over the
// label, so the room is turned rather than the slab: the slab rests front-on,
// exactly under the slab picture that fades out over it. A slab turned some angle
// swings its reflections twice as far, so this is the slab turned 10°.
const ROOM_TURN = new THREE.Euler(0, THREE.MathUtils.degToRad(20), 0)

// Clear plastic or glass: what lies behind it (the card, the labels, the page
// beneath the canvas) is drawn as it is, and only the room's reflections,
// added over it, give the surface away. Not three.js's transmission, which
// draws what lies behind from a blurred copy and left the card several times
// softer than its scan; a flat pane bends nothing worth showing. Black, so
// all it adds is what it reflects, and it covers the canvas as far as it
// lights it: its alpha, its brightest channel, is added like its colour. The
// canvas is premultiplied, and WebGL leaves a pixel brighter than its alpha to
// each browser's compositor; WebKit drew such pixels over the clear windows,
// where nothing lies behind, as black speckle.
// It carries the room itself, turned: three.js reads envMapIntensity only off
// a material with its own envMap, which then ignores the scene's turn.
const reflections = (room) => {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03,
    envMap: room, envMapIntensity: REFLECTIVITY, envMapRotation: ROOM_TURN,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>",
      "#include <dithering_fragment>\n\tgl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));")
  }
  return material
}

// A clear case half's scan, by its own transparency: clear over the card and
// the label, the rims and embossing moulded into the plastic elsewhere.
const moulding = (map) => new THREE.MeshStandardMaterial({ map, metalness: 0, roughness: 0.3, transparent: true, depthWrite: false })

// A clear part as its meshes: its scan, if any, under its reflections of the room.
const clear = (geometry, room, map = null) => [...(map ? [moulding(map)] : []), reflections(room)].map((material) => new THREE.Mesh(geometry, material))

// The Poly photos show clear windows but denser, rounded rims. A face scan
// projected down a wall stretches into streaks and leaves its thickness almost
// invisible. Keep it on the faces; light the walls as translucent plastic.
// This avoids a transmission pass over the card and its small label text.
const polyShell = (geometry, room, map, mirror) => {
  const { front, back, edge } = splitBySide(geometry.attributes.position.array, geometry.attributes.normal.array)
  const faces = new THREE.BufferGeometry()
  const walls = new THREE.BufferGeometry()
  for (const [attribute, source] of [["position", "positions"], ["normal", "normals"]]) {
    const joined = new Float32Array(front[source].length + back[source].length)
    joined.set(front[source])
    joined.set(back[source], front[source].length)
    faces.setAttribute(attribute, new THREE.BufferAttribute(joined, 3))
    walls.setAttribute(attribute, new THREE.BufferAttribute(edge[source], 3))
  }
  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0xa9b2b2, metalness: 0, roughness: 0.2, ior: 1.58,
    clearcoat: 0.35, clearcoatRoughness: 0.16,
    envMap: room, envMapIntensity: 0.7, envMapRotation: ROOM_TURN,
    transparent: true, opacity: 0.55, depthWrite: false
  })
  return [...clear(dress(faces, geometry.boundingBox, mirror), room, map), new THREE.Mesh(walls, plastic)]
}

// A print as it was photographed: unlit, so it keeps the picture's own colours.
const printed = (map) => new THREE.MeshBasicMaterial({ map })

// Black anodised metal, lit so its sheen moves as it turns; a face wears its
// scan (the metal's grain, the printed logo), an edge the bare colour.
const metal = (map = null) => new THREE.MeshStandardMaterial({
  color: map ? 0xffffff : FRAME_EDGE, map, metalness: 0.4, roughness: 0.45
})

// The magnets in the glass's corners: glossy black, glossier than the frame's
// metal, so the room's lights glint off them as they turn.
const glossyBlack = () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0, roughness: 0.2 })

// The room's reflections, drawn on the GPU.
const roomReflections = (renderer) => {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  return texture
}

const loadTexture = async (loader, url, anisotropy) => {
  const texture = await loader.loadAsync(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

// A body's geometry in the slab's millimetres, with normals creased at its
// edges (the CAD exports none).
const bake = (mesh) => {
  const geometry = toCreasedNormals(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), CREASE)
  geometry.computeBoundingBox()
  return geometry
}

const dress = (geometry, box, mirror) => {
  geometry.setAttribute("uv", new THREE.BufferAttribute(planarUV(geometry.attributes.position.array, box, { mirror }), 2))
  return geometry
}

// The CAD draws the card as a square-cornered block, so the card is drawn
// here instead: a rounded rectangle filling that block's box, its front face
// at the box's front.
export const cardGeometry = (box, radius) => {
  const [w, h] = [box.max.x - box.min.x, box.max.y - box.min.y]
  const [x, y] = [w / 2 - radius, h / 2 - radius]
  const outline = new THREE.Shape()
  outline.moveTo(-x, -h / 2)
  outline.absarc(x, -y, radius, -Math.PI / 2, 0)
  outline.absarc(x, y, radius, 0, Math.PI / 2)
  outline.absarc(-x, y, radius, Math.PI / 2, Math.PI)
  outline.absarc(-x, -y, radius, Math.PI, Math.PI * 1.5)

  const geometry = new THREE.ExtrudeGeometry(outline, { depth: box.max.z - box.min.z, bevelEnabled: false, curveSegments: 8 })
  const centre = box.getCenter(new THREE.Vector3())
  return geometry.translate(centre.x, centre.y, box.min.z)
}

// A body as three meshes by the way its triangles face: its front and its back
// each wearing their picture across the body's whole footprint (the back's
// mirrored, to read right from behind), and its edge bare.
const sideMeshes = (geometry, [front, back, edge]) => {
  const sides = splitBySide(geometry.attributes.position.array, geometry.attributes.normal.array)
  const mesh = ({ positions, normals }, material, mirror) => {
    const face = new THREE.BufferGeometry()
    face.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    face.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
    if (mirror !== undefined) dress(face, geometry.boundingBox, mirror)
    return new THREE.Mesh(face, material)
  }

  return [mesh(sides.front, front, false), mesh(sides.back, back, true), mesh(sides.edge, edge)]
}

// The card: its front and back faces wearing their scans, its edge plain stock,
// its corners cut to `cornerRadius` millimetres.
const cardMeshes = (block, front, back, cornerRadius) => {
  const geometry = cardGeometry(block.boundingBox, cornerRadius)
  geometry.computeBoundingBox()
  return sideMeshes(geometry, [printed(front), printed(back), new THREE.MeshStandardMaterial({ color: CARD_EDGE, roughness: 0.8 })])
}

// The glass's frame: every face toward the viewer wears the front scan, at
// whatever depth it lies (the rim, the floor round the window, the label wall),
// since the scan shows each as seen straight on; the back likewise.
export const frameMeshes = (geometry, front, back) => sideMeshes(geometry, [metal(front), metal(back), metal()])

// How each body of a housing's model is drawn, by its name (PARTS lists the
// bodies each model holds), from the textures createSlabScene loads and the
// card's corner radius in millimetres.
export const DRESS = {
  shell_front: (geometry, maps) => polyShell(geometry, maps.room, maps.caseFront, false),
  shell_back: (geometry, maps) => polyShell(geometry, maps.room, maps.caseBack, true),
  label_plate: (geometry, maps) => clear(geometry, maps.room),
  frame: (geometry, maps) => frameMeshes(geometry, maps.caseFront, maps.caseBack),
  window_front: (geometry, maps) => clear(geometry, maps.room),
  window_back: (geometry, maps) => clear(geometry, maps.room),
  magnets: (geometry) => [new THREE.Mesh(geometry, glossyBlack())],
  card: (geometry, maps, cardCornerRadius) => cardMeshes(geometry, maps.cardFront, maps.cardBack, cardCornerRadius),
  label_front: (geometry, maps) => [new THREE.Mesh(dress(geometry, geometry.boundingBox, false), printed(maps.labelFront))],
  label_back: (geometry, maps) => [new THREE.Mesh(dress(geometry, geometry.boundingBox, true), printed(maps.labelBack))]
}

// @param cardCornerRadius [Number] millimetres, read off the card's scan (Hga::Showcase::Card#corner_radius)
export async function createSlabScene(canvas, urls, cardCornerRadius) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.environment = roomReflections(renderer)
  scene.environmentRotation.copy(ROOM_TURN)
  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(150, 250, 400)
  scene.add(key)

  const loader = new THREE.TextureLoader()
  const anisotropy = renderer.capabilities.getMaxAnisotropy()
  const [gltf, caseFront, caseBack, cardFront, cardBack, labelFront, labelBack] = await Promise.all([
    new GLTFLoader().loadAsync(urls.model),
    ...[urls.caseFront, urls.caseBack, urls.cardFront, urls.cardBack, urls.labelFront, urls.labelBack]
      .map((url) => loadTexture(loader, url, anisotropy))
  ])

  const maps = { caseFront, caseBack, cardFront, cardBack, labelFront, labelBack, room: scene.environment }
  gltf.scene.updateMatrixWorld(true)
  const slab = new THREE.Group()
  gltf.scene.traverse((object) => { if (object.isMesh) slab.add(...DRESS[object.name](bake(object), maps, cardCornerRadius)) })
  scene.add(slab)

  // Far enough back that the slab stays in frame at every angle of its turn.
  const size = new THREE.Box3().setFromObject(slab).getSize(new THREE.Vector3())
  const distance = size.length() / 2 / Math.sin(THREE.MathUtils.degToRad(FOV / 2))
  const camera = new THREE.PerspectiveCamera(FOV, 1, distance / 20, distance * 4)
  camera.position.set(0, 0, distance)

  const draw = () => renderer.render(scene, camera)
  // The canvas takes its size from the slab picture beneath it, which has no
  // height until it loads; a zero-sized drawing buffer only makes WebGL errors.
  const observer = new ResizeObserver(() => {
    if (!canvas.clientWidth || !canvas.clientHeight) return
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
    draw()
  })
  observer.observe(canvas)

  // A drawing the browser took away comes back blank. three.js uploads the
  // models and pictures again by itself (its own listener runs first, added
  // with the renderer), but not the reflections it drew on the GPU, which the
  // scene and the clear parts' own reflections both wear.
  const restored = () => {
    const room = roomReflections(renderer)
    slab.traverse((object) => { if (object.material?.envMap) object.material.envMap = room })
    scene.environment = room
    draw()
  }
  canvas.addEventListener("webglcontextrestored", restored)

  return {
    // @param degrees [Number] the turn about the slab's upright axis
    render(degrees) {
      slab.rotation.y = THREE.MathUtils.degToRad(degrees)
      draw()
    },
    dispose() {
      observer.disconnect()
      canvas.removeEventListener("webglcontextrestored", restored)
      renderer.dispose()
    }
  }
}
