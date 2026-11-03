// The housings' CAD models (app/assets/models/hga/<housing>.glb) and how their
// faces wear their pictures. Each model's root stands the slab up in
// millimetres, label end up, front toward +Z; its bodies are named for what
// they are. The clear case is two halves and a label plate with the two labels
// thin prints either side of it; the glass is a metal frame with a pane either
// side and a magnet in each corner, the two labels thin prints either side of
// the frame's label wall.
export const PARTS = {
  clear_case: ["shell_front", "shell_back", "card", "label_plate", "label_front", "label_back"],
  glass: ["frame", "window_front", "window_back", "magnets", "card", "label_front", "label_back"]
}

// A picture laid flat across a face: each vertex takes the spot of the picture
// under it, by where it sits in the footprint `box`. A face seen from behind
// wears its picture mirrored, so it reads the right way round from there.
export const planarUV = (positions, { min, max }, { mirror }) => {
  const uv = new Float32Array((positions.length / 3) * 2)
  for (let i = 0; i < positions.length / 3; i++) {
    const u = (positions[3 * i] - min.x) / (max.x - min.x)
    uv[2 * i] = mirror ? 1 - u : u
    uv[2 * i + 1] = (positions[3 * i + 1] - min.y) / (max.y - min.y)
  }
  return uv
}

// A body's triangles (unindexed, with per-vertex normals) sorted by the way
// they face: toward the viewer, away, or round the edge, so a card can wear its
// front and back scans on its two faces and plain stock round its edge.
export const splitBySide = (positions, normals) => {
  const sides = { front: { positions: [], normals: [] }, back: { positions: [], normals: [] }, edge: { positions: [], normals: [] } }
  for (let t = 0; t < positions.length; t += 9) {
    const nz = (normals[t + 2] + normals[t + 5] + normals[t + 8]) / 3
    const side = sides[nz > 0.5 ? "front" : nz < -0.5 ? "back" : "edge"]
    side.positions.push(...positions.subarray(t, t + 9))
    side.normals.push(...normals.subarray(t, t + 9))
  }
  for (const side of Object.values(sides)) {
    side.positions = new Float32Array(side.positions)
    side.normals = new Float32Array(side.normals)
  }
  return sides
}
