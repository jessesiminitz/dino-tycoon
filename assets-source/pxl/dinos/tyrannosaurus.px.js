// T-rex attempts in the Jurassic Park look: a deep boxy skull with a heavy brow, a thick S neck,
// a massive thigh, tiny two-fingered arms, a straight stiff tail; brown-grey hide with darker
// tiger stripes across the back and a slightly paler underside. Side view, facing right.
pal({
  k: "#16110c",                                   // outline
  d: "#33291f", D: "#4a3b2c", m: "#66533d", M: "#83704f", l: "#a28c64", L: "#bea97e",   // hide, dark -> light
  b: "#8a7558", B: "#a8936f",                     // underside
  e: "#e8a21c", E: "#fff0b0",                     // eye
  t: "#efe6c8", T: "#c9bc98",                     // teeth
  r: "#5a1a1e", R: "#9a3a3c",                     // mouth
})
ramps("kdDmMlL")

// a line through points, smoothed (Catmull-Rom), read as y at any x
function smooth(pts) {
  const ext = [pts[0], ...pts, pts[pts.length - 1]], out = []
  for (let i = 1; i < ext.length - 2; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]]
    out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t * t * t)))
  }
  out.push(pts[pts.length - 1])
  return out
}
function yAt(line, x) {
  if (x <= line[0][0]) return line[0][1]
  for (let i = 1; i < line.length; i++) if (x <= line[i][0]) { const [a, b] = [line[i - 1], line[i]], t = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * t }
  return line[line.length - 1][1]
}

// the body, tail tip to the base of the skull, in px at scale 1 (a 104 px animal)
const TOP = [[1, 23], [12, 21.5], [24, 19.5], [36, 16.5], [46, 14.5], [55, 15], [63, 17.5], [69, 20.5], [74, 21], [79, 18.5], [83, 16]]
const BOT = [[1, 24.5], [12, 25], [24, 26], [34, 28], [42, 32], [50, 36.5], [58, 37.5], [64, 35], [70, 31], [76, 28.5], [83, 27]]

function rex(o) {
  const s = o.scale ?? 1, oy = o.yOff ?? 0, P = (x, y) => [Math.round(x * s), Math.round((y + oy) * s)]
  const tailUp = o.tailUp ?? 0                     // px the tail tip rises
  const lift = o.lift ?? 0, gape = o.gape ?? 0      // head raised (radians), jaw dropped (radians)
  const stride = o.stride ?? 0                      // -1..1: near leg forward (+) or back (-)
  const top = smooth(TOP.map(([x, y]) => [x, y - (x < 40 ? tailUp * (40 - x) / 39 : 0)]))
  const bot = smooth(BOT.map(([x, y]) => [x, y - (x < 40 ? tailUp * (40 - x) / 39 : 0)]))
  const hinge = [83, 23]
  // the head turns about the back of the neck; the jaw about its hinge
  const rot = (p, c0, a) => { const dx = p[0] - c0[0], dy = p[1] - c0[1]; return [c0[0] + dx * Math.cos(a) + dy * Math.sin(a), c0[1] - dx * Math.sin(a) + dy * Math.cos(a)] }
  const HS = 1.3, grow = (p) => [80 + (p[0] - 80) * HS, 21 + (p[1] - 21) * HS]   // a big JP skull
  const head = (p) => rot(grow(p), [80, 21], lift)
  const jaw = (p) => head(rot(p, hinge, -gape))   // hinge is in unscaled head space
  const flat = (pts) => pts.flatMap((p) => P(...p))

  function leg(c, sd, ramp) {
    const st = stride * sd, hip = [48, 28]
    const knee = [55 + st * 5, 42 - Math.abs(st) * 1], ankle = [49 + st * 9, 52], toe = [ankle[0] + 2, 57.5 - Math.max(0, -st) * 1.5]
    c.capsule(...P(...knee), 4.2 * s, ...P(...ankle), 2.4 * s, ramp, { light: [-0.4, -1] })
    if (sd > 0) c.clip((x, y) => y > (hip[1] + oy - 1) * s && x > (hip[0] - 6) * s || y > (hip[1] + oy + 7) * s, () => c.capsule(...P(...hip), 10.5 * s, ...P(...knee), 6.5 * s, "d"))   // the thigh's contour, front and below
    c.capsule(...P(...hip), 9.5 * s, ...P(...knee), 5.5 * s, ramp, { light: [-0.4, -1] })
    if (sd > 0) c.line(...P(hip[0] - 9, hip[1] + 6), ...P(knee[0] - 5, knee[1] + 1), "d")   // the back of the thigh
    c.capsule(...P(...ankle), 2.4 * s, ...P(...toe), 1.6 * s, ramp, { light: [-0.4, -1] })
    c.capsule(...P(toe[0] - 3, toe[1]), 1.3 * s, ...P(toe[0] + 6, toe[1] + 0.5), 1 * s, ramp, { light: [-0.4, -1] })
    c.px(...P(toe[0] + 7, toe[1] + 0.5), "T")                  // the claw
  }

  return (c) => {
    leg(c, -1, "kdDm")                                     // far leg, in shade
    c.line(...P(67, 31), ...P(70, 35), "D", Math.max(1, Math.round(1.4 * s))); c.line(...P(70, 35), ...P(72, 34), "d")   // far arm
    // the body in slices: a lit back, hide, a paler underside; stripes darken the back
    for (let x = 1; x <= 84; x += 0.5 / s) {
      const ty = yAt(top, x), by = yAt(bot, x), n = Math.max(1, Math.ceil((by - ty) * s))
      const stripe = x > 8 && x < 76 && (((x + (ty - 15) * 0.8) / 7.5) % 1) < 0.32
      for (let i = 0; i <= n; i++) {
        const q = i / n
        let k = q < 0.12 ? "l" : q < 0.45 ? "M" : q < 0.72 ? "m" : q < 0.9 ? "b" : "D"
        if (stripe && q > 0.06 && q < 0.5) k = k === "l" ? "M" : "D"
        c.px(...P(x, ty + (by - ty) * q), k)
      }
    }
    // the lower jaw, then the mouth's inside, then the skull over it
    if (gape > 0.02) {
      c.poly(flat([hinge, head([86, 20]), jaw([99, 22]), jaw([99, 24])]), "r")
      c.poly(flat([jaw([84, 24]), jaw([92, 25.5]), jaw([98, 24.5])]), "R")      // the tongue
    }
    c.poly(flat([jaw([82, 22]), jaw([99, 22.5]), jaw([98, 25]), jaw([92, 27]), jaw([85, 28.5]), jaw([80, 27.5])]), "m")
    c.poly(flat([jaw([84, 25.5]), jaw([92, 25.5]), jaw([96, 24.5]), jaw([84, 27.5])]), "b")
    c.poly(flat([head([79, 15]), head([82, 12]), head([88, 11.5]), head([95, 12.5]), head([100, 14]), head([101.5, 15.5]), head([101.5, 21]), head([100, 22.5]), head([88, 23]), head([82, 23.5]), head([78.5, 22])]), "M")
    c.poly(flat([head([82, 12]), head([88, 11.5]), head([95, 12.5]), head([101, 15]), head([95, 13.6]), head([88, 12.8]), head([83, 13.2])]), "l")   // lit crown and snout
    c.poly(flat([head([83, 19]), head([100, 21]), head([100, 22.5]), head([82, 23.5])]), "m")   // upper lip in shade
    // teeth along both jaws
    c.line(...P(...head([84, 22.6])), ...P(...head([101, 21.6])), "D")   // the lip line
    for (const [x, n] of [[86, 1], [88.5, 2], [91, 1], [93.5, 2], [96, 1], [98.5, 1]]) { const p = P(...head([x, 22.8])); for (let i = 0; i < n; i++) c.px(p[0], p[1] + i, i ? "T" : "t"); if (gape > 0.02) c.px(...P(...jaw([x - 1, 22])), "T") }
    // the brow ridge over the eye, the eye, nostril, cheek fold
    c.line(...P(...head([84, 14.5])), ...P(...head([90, 15])), "D")
    const E = P(...head([87, 16.5])); c.px(E[0], E[1], "e"); c.px(E[0] + 1, E[1], "k"); if (s >= 1) c.px(E[0] - 1, E[1], "e")
    c.px(...P(...head([99, 16.5])), "d")
    c.line(...P(...head([81, 18])), ...P(...head([83, 22])), "D")
    leg(c, 1, "dDmMl")                                     // near leg
    c.line(...P(68, 31), ...P(71, 36), "m", Math.max(1, Math.round(1.6 * s))); c.line(...P(71, 36), ...P(73, 35), "M"); c.px(...P(74, 35), "T")   // near arm, two claws
  }
}

const OPTS = { outline: "k", pivot: "bottom" }
sprite("trex_stand_v1", { w: 110, h: 62, ...OPTS }, rex({}))
sprite("trex_roar_v1", { w: 108, h: 70, ...OPTS }, rex({ lift: 0.6, gape: 0.8, tailUp: 4, yOff: 10 }))
sprite("trex_stalk_v1", { w: 110, h: 62, ...OPTS }, rex({ lift: -0.18, stride: 0.8, tailUp: -1 }))
// a darker, greener hide like the Lost World pair
sprite("trex_dark_v1", { base: "trex_stand_v1", swap: { d: "#1f2420", D: "#2f3a30", m: "#435242", M: "#5b6a55", l: "#7a8a6c", L: "#98a884", b: "#6f7258", B: "#8c8e70" } })
// small, the size it is at the park's furthest zoom
sprite("trex_small_v1", { w: 66, h: 38, ...OPTS }, rex({ scale: 0.6 }))

// ---- v2, drawn from references (refs/): proportions traced from a side-view restoration
// (refs/profile.png, Steveoc86, CC BY-SA, shrunk to 104 px: the tail is half the length, the back level
// with the head, long legs), bulk, head and colours from the Jurassic Park maquette and the Universal
// prop (refs/maquette.jpg): a deep blunt snout, a brow knob over a high eye, the upper teeth hanging
// over a deep lower jaw, warm red-brown back with darker stripes, tan flanks.
pal({
  p: "#1a110b", q: "#3a2415", Q: "#56351f", n: "#77492b", N: "#97633a", o: "#b5824f", O: "#d0a26b",   // JP hide
  f: "#a07c56", F: "#c09a6c",                     // tan flank and belly
  y: "#d9c56a", Y: "#f4ecb0",                     // pale yellow eye
  u: "#b8606a", U: "#7c3038",                     // mouth
  w: "#f6f1e2",                                   // the white of the eye
})
ramps("pqQnNoO")

const TOP2 = [[2, 25], [8, 21.5], [14, 19.2], [22, 18], [32, 17.2], [42, 15.6], [50, 13.8], [58, 12.6], [64, 12.8], [70, 13.6], [75, 15], [79, 15.2], [82, 13.5]]
const BOT2 = [[2, 25.6], [8, 23.5], [16, 21.4], [26, 20.6], [36, 21.2], [44, 22.6], [52, 25.6], [60, 28], [67, 27.6], [72, 25.4], [77, 23], [81, 22]]

function rex2(o) {
  const s = o.scale ?? 1, oy = o.yOff ?? 0, P = (x, y) => [Math.round(x * s), Math.round((y + oy) * s)]
  const lift = o.lift ?? 0, gape = o.gape ?? 0, stride = o.stride ?? 0, tailUp = o.tailUp ?? 0, crouch = o.crouch ?? 0
  const wave = o.arms ?? 0   // the little arms swing about the shoulder (+ up)
  const bend = (x, y) => [x, y + crouch - (x < 46 ? tailUp * (46 - x) / 44 : 0)]
  const top = smooth(TOP2.map((p) => bend(...p))), bot = smooth(BOT2.map((p) => bend(...p)))
  const rot = (p, c0, a) => { const dx = p[0] - c0[0], dy = p[1] - c0[1]; return [c0[0] + dx * Math.cos(a) + dy * Math.sin(a), c0[1] - dx * Math.sin(a) + dy * Math.cos(a)] }
  const NECK = [79, 17 + crouch], HINGE = [83, 20]
  const head = (p) => rot([p[0], p[1] + crouch], NECK, lift)
  const jaw = (p) => head(rot(p, HINGE, -gape))
  const flat = (pts) => pts.flatMap((p) => P(...p))
  const L = { light: [-0.3, -1] }
  const arm = (x, y) => P(...rot([x, y + crouch], [72, 24.5 + crouch], wave))

  // a leg standing: the knee ahead of the hip, the shin raked back, the long foot bone forward to
  // three toes (the JP maquette's stance); stride swings it about the hip
  // one leg's stride and foot lift (px) can be set on its own: nearStride, nearUp, farStride, farUp
  function leg(c, sd, ramp, dx) {
    const st = (sd > 0 ? o.nearStride : o.farStride) ?? stride * sd, up = (sd > 0 ? o.nearUp : o.farUp) ?? 0, hip = [59 + dx, 19 + crouch]
    const ankle = [57 + dx + st * 11 + up * 0.3, 41 - (o.flat ? 0 : Math.max(0, st) * 1.5) - up], knee = [62 + dx + st * 5 + up * 0.5, 31.5 + crouch * 0.6 - up * 0.6]
    const toe = [ankle[0] + 3, 46 - (o.flat ? 0 : Math.max(0, st) * 1.5) - up]
    c.capsule(...P(...knee), 3.4 * s, ...P(...ankle), 2.2 * s, ramp, L)
    c.capsule(...P(...ankle), 2 * s, ...P(...toe), 1.6 * s, ramp, L)
    c.capsule(...P(toe[0] - 2, toe[1]), 1.2 * s, ...P(toe[0] + 5, toe[1] + 0.3), 0.9 * s, ramp, L)
    c.px(...P(toe[0] + 6, toe[1] + 0.3), "T")
    if (sd > 0) c.clip((x, y) => y > (hip[1] + oy - 1) * s && x > (hip[0] - 4) * s || y > (hip[1] + oy + 5) * s, () => c.capsule(...P(...hip), 8 * s, ...P(...knee), 4.6 * s, "q"))
    c.capsule(...P(...hip), 7.5 * s, ...P(...knee), 3.8 * s, ramp, L)
  }

  return (c) => {
    leg(c, -1, "pqQn", -3)                                 // far leg, in shade
    c.line(...arm(72, 25), ...arm(74, 29), "Q"); c.line(...arm(74, 29), ...arm(76, 28.5), "q")   // far arm
    // the body in slices: lit back, red-brown hide, tan flank, a shaded belly edge; stripes over the back
    for (let x = 2; x <= 82; x += 0.5 / s) {
      const ty = yAt(top, x), by = yAt(bot, x), n = Math.max(1, Math.ceil((by - ty) * s))
      const stripe = x > 10 && x < 78 && (((x + (ty - 13) * 0.9) / 6.5) % 1) < 0.3
      for (let i = 0; i <= n; i++) {
        const q = i / n
        let k = q < 0.14 ? "o" : q < 0.42 ? "N" : q < 0.7 ? "f" : q < 0.88 ? "n" : "Q"
        if (stripe && q > 0.08 && q < 0.55) k = k === "o" ? "N" : "Q"
        c.px(...P(x, ty + (by - ty) * q), k)
      }
    }
    // the lower jaw (deep, its chin curving up), the mouth inside, then the skull over it
    if (gape > 0.02) {
      c.poly(flat([HINGE, head([86, 18]), jaw([100, 19]), jaw([100, 20.5])]), "U")
      c.poly(flat([jaw([84, 21]), jaw([93, 21.8]), jaw([99, 20.6])]), "u")
    }
    c.poly(flat([jaw([81, 19.2]), jaw([100, 18.8]), jaw([100.5, 21]), jaw([96, 23.6]), jaw([88, 24.6]), jaw([82, 24]), jaw([78.5, 21.5])]), "N")
    c.poly(flat([jaw([83, 22.5]), jaw([96, 22.2]), jaw([88, 24.6]), jaw([82, 24])]), "n")
    c.poly(flat([head([78, 12.5]), head([81, 10.2]), head([84.5, 9]), head([88, 8.8]), head([92, 9.6]), head([96, 10.8]), head([100, 12]), head([102, 13.5]), head([102.5, 17.5]), head([100, 19]), head([86, 19.6]), head([81, 20]), head([77.5, 18.5])]), "N")
    c.poly(flat([head([81, 10.2]), head([84.5, 9]), head([88, 8.8]), head([92, 9.6]), head([96, 10.8]), head([100, 12]), head([102, 13.5]), head([96, 12]), head([89, 10.6]), head([83, 11])]), "o")   // lit crown
    c.poly(flat([head([84, 17]), head([101, 16.8]), head([100, 19]), head([86, 19.6]), head([82, 19.6])]), "n")             // the upper lip in shade
    c.line(...P(...head([83.5, 19.4])), ...P(...head([100.5, 18.6])), "q")                                               // the mouth line
    for (const [x, n] of [[86, 1], [88, 2], [90.5, 2], [93, 1], [95.5, 2], [98, 1], [100, 1]]) {
      const p = P(...head([x, 19.6])); for (let i = 0; i < n; i++) c.px(p[0], p[1] + i, i ? "T" : "t")
      if (gape > 0.02) c.px(...P(...jaw([x - 1, 19])), "T")
    }
    // the brow knob over the eye, the eye under it, a fold behind it, the nostril at the snout's corner
    c.line(...P(...head([85, 10.5])), ...P(...head([89, 11.5])), "Q")
    // the eye: white behind a dark pupil that looks forward; shut (a wink), a dark lid line
    const E = P(...head([86.5, 12.6])), shut = (o.shut ?? 0) > 0.5
    c.px(E[0], E[1], shut ? "q" : "w"); c.px(E[0] + 1, E[1], shut ? "q" : "p"); if (s >= 1) c.px(E[0] - 1, E[1], shut ? "q" : "w")
    c.px(...P(...head([100.5, 13.6])), "q")
    c.line(...P(...head([80.5, 14])), ...P(...head([82, 19])), "Q")
    leg(c, 1, "qQnNo", 0)                                  // near leg
    c.line(...arm(73, 25), ...arm(75, 29.5), "N"); c.line(...arm(75, 29.5), ...arm(77, 29), "o"); c.px(...arm(78, 29), "T")   // near arm, two claws
  }
}

const OPTS2 = { outline: "p", pivot: "bottom" }
sprite("tyrannosaurus", { w: 106, h: 48, ...OPTS2 }, rex2({ stride: -0.45 }))
sprite("trex_roar", { w: 106, h: 56, ...OPTS2 }, rex2({ lift: 0.55, gape: 0.75, tailUp: 3, yOff: 8, stride: -0.45 }))
sprite("trex_stalk", { w: 112, h: 48, ...OPTS2 }, rex2({ lift: -0.15, stride: 0.8, crouch: 1 }))
sprite("trex_small", { w: 66, h: 30, ...OPTS2 }, rex2({ scale: 0.6, stride: -0.45 }))

// ---- animations of the same model (the roar ends on #5's pose, trex_roar in trex.px.js)
const ANIM2 = { w: 106, h: 56, ...OPTS2 }
const ease = (t) => t * t * (3 - 2 * t)
// a walk: the legs swing on opposite strides, the body dips at each passing step, the head nods against it
anim("tyrannosaurus_walk", { ...ANIM2, frames: 8, fps: 8 }, (c) => {
  const a = c.phase * Math.PI * 2
  rex2({ yOff: 8, stride: Math.sin(a) * 0.8, crouch: (1 - Math.cos(2 * a)) * 0.5, lift: Math.cos(2 * a) * 0.04, tailUp: Math.sin(2 * a) * 0.8 })(c)
})
// standing: breathing, the tail drifting
anim("tyrannosaurus_idle", { ...ANIM2, frames: 8, fps: 6 }, (c) => {
  const a = c.phase * Math.PI * 2
  rex2({ yOff: 8, stride: -0.45, crouch: (1 - Math.cos(a)) * 0.4, lift: Math.sin(a) * 0.04, tailUp: Math.sin(a) * 0.8 })(c)
})
// a roar: a wind-up with the head down, rearing up into #5's pose, holding it, settling back
const ROAR = [[0, 0, 0], [-0.12, 0.05, -0.5], [-0.18, 0.1, -0.8], [0.2, 0.4, 1.2], [0.5, 0.7, 2.6], [0.55, 0.75, 3], [0.57, 0.78, 3], [0.55, 0.75, 3], [0.4, 0.55, 2.2], [0.2, 0.25, 1.2], [0.06, 0.06, 0.4], [0, 0, 0]]
anim("tyrannosaurus_roar", { ...ANIM2, frames: ROAR.length, fps: 8 }, (c) => {
  const [lift, gape, tailUp] = ROAR[c.frame]
  rex2({ yOff: 8, stride: -0.45, lift, gape, tailUp, crouch: tailUp < 0 ? 0.6 : 0 })(c)
})
// eating: the head swings down, bites twice and tugs, comes back up
const EAT = [[0, 0], [-0.35, 0], [-0.75, 0.35], [-0.85, 0.05], [-0.75, 0.35], [-0.85, 0.05], [-0.65, 0], [-0.3, 0]]
anim("tyrannosaurus_eat", { ...ANIM2, frames: EAT.length, fps: 6 }, (c) => {
  const [lift, gape] = EAT[c.frame]
  rex2({ yOff: 8, stride: -0.45, lift, gape, crouch: -lift * 3, tailUp: -lift * 2.5 })(c)
})

// ---- fun moves, the same five as the Blender clips (scripts/art/fun_motion.py): each a few keyed poses,
// eased between, eight frames. Taller canvas: 16 px over the head for the hop.
const FUN = { w: 106, h: 64, ...OPTS2 }
function keyed(rows) {
  return (i) => Object.fromEntries(Object.entries(rows).map(([name, keys]) => {
    const b = keys.filter((k) => k[0] <= i).at(-1), a = keys.find((k) => k[0] >= i) ?? b
    const t = a[0] === b[0] ? 0 : ease((i - b[0]) / (a[0] - b[0]))
    return [name, b[1] + (a[1] - b[1]) * t]
  }))
}
const MOVES = {
  // knee up high, a stamp that jolts the whole body, the jaw snapping
  stomp: [6, { nearUp: [[0, 0], [2, 7], [3, 8], [4, 0]], nearStride: [[0, -0.45], [2, 0.3], [3, 0.35], [4, 0.35], [7, -0.45]],
    crouch: [[0, 0], [2, -1], [3, -1], [4, 3.5], [5, 1.2], [7, 0]], lift: [[0, 0], [2, 0.12], [4, -0.22], [5, -0.05], [7, 0]],
    tailUp: [[0, 0], [2, 3], [4, -3], [5, 1.5], [7, 0]], gape: [[0, 0], [3, 0.2], [4, 0.4], [6, 0]], arms: [[0, 0], [3, 0.4], [4, -0.4], [7, 0]] }],
  // bouncing, the tail wagging, the arms waving, little alternating steps
  dance: [8, { crouch: [[0, 0], [1, 3], [2, 0], [3, 3], [4, 0], [5, 3], [6, 0], [7, 3]],
    tailUp: [[0, 5], [2, -3.5], [4, 5], [6, -3.5], [7, 1]], arms: [[0, 0.7], [2, -0.4], [4, 0.7], [6, -0.4], [7, 0.2]],
    lift: [[0, 0.18], [2, -0.1], [4, 0.18], [6, -0.1], [7, 0.04]], gape: [[0, 0.3], [2, 0.05], [4, 0.3], [6, 0.05], [7, 0.15]],
    nearUp: [[0, 0], [1, 4], [2, 0]], nearStride: [[0, -0.45], [1, -0.1], [2, 0], [5, 0], [7, -0.45]],
    farUp: [[0, 0], [4, 0], [5, 4], [6, 0]], farStride: [[0, 0.45], [3, 0.45], [5, 0.1], [7, 0.45]] }],
  // crouch, spring off the ground with the legs tucked, land and absorb it
  hop: [8, { crouch: [[0, 0], [1, 4], [2, 0], [5, 0], [6, 4], [7, 0]], yOff: [[0, 16], [1, 16], [2, 8], [3, 5], [4, 8], [5, 16], [7, 16]],
    nearUp: [[0, 0], [2, 4], [3, 6], [4, 4], [5, 0]], farUp: [[0, 0], [2, 4], [3, 6], [4, 4], [5, 0]],
    tailUp: [[0, 0], [1, -2.5], [3, 4], [5, -3], [7, 0]], arms: [[0, 0], [2, 0.7], [4, 0.7], [6, -0.3], [7, 0]],
    lift: [[0, 0], [1, -0.1], [3, 0.12], [6, -0.1], [7, 0]] }],
  // a cheeky wink: the head cocks, the eye shuts for two frames, a little grin and a tail flick
  wink: [8, { shut: [[0, 0], [2, 0], [3, 1], [4, 1], [5, 0], [7, 0]], lift: [[0, 0], [2, 0.08], [3, 0.12], [4, 0.12], [5, 0.06], [7, 0]],
    gape: [[0, 0], [2, 0.08], [3, 0.14], [4, 0.14], [5, 0.05], [7, 0]], tailUp: [[0, 0], [2, 2], [3, 3], [4, 3], [5, 1], [7, 0]],
    crouch: [[0, 0], [3, 0.6], [4, 0.6], [6, 0]] }],
  // a breath in with the head going up, then achoo: snapped down, the jaw open, a little shake
  sneeze: [6, { lift: [[0, 0], [1, 0.15], [2, 0.28], [3, 0.36], [4, -0.38], [5, -0.18], [6, -0.26], [7, 0]],
    gape: [[0, 0], [2, 0.2], [3, 0.35], [4, 0.7], [5, 0.1], [6, 0.2], [7, 0]], crouch: [[0, 0], [3, -1], [4, 3], [5, 1.2], [7, 0]],
    tailUp: [[0, 0], [3, 3], [4, -2.5], [6, 1], [7, 0]], arms: [[0, 0], [3, 0.3], [4, -0.4], [7, 0]] }],
}
for (const [name, [fps, rows]] of Object.entries(MOVES)) {
  const at = keyed(rows)
  anim("tyrannosaurus_" + name, { ...FUN, frames: 8, fps }, (c) => rex2({ yOff: 16, stride: -0.45, ...at(c.frame) })(c))
}
// the roar and the walk at the same size, to sit beside them
anim("tyrannosaurus_roar_tall", { ...FUN, frames: ROAR.length, fps: 8 }, (c) => {
  const [lift, gape, tailUp] = ROAR[c.frame]
  rex2({ yOff: 16, stride: -0.45, lift, gape, tailUp, crouch: tailUp < 0 ? 0.6 : 0 })(c)
})

// ---- the park's T-rex: every clip the game plays, eight frames each, drawn straight at the size the park
// shows it (scripts/art/convert_rex.mjs reads these). One canvas for all clips, 16 px over the head for the
// hop; GAME_SCALE matches the Blender T-rex's length in the park.
const GAME_SCALE = 0.713
const REST = keyed({ crouch: [[0, 9], [4, 9.6], [7, 9]], lift: [[0, -0.12], [4, -0.16], [7, -0.12]], tailUp: [[0, -2.5], [4, -2], [7, -2.5]] })
const ROAR8 = keyed({ lift: [[0, 0], [1, -0.15], [2, 0.3], [3, 0.55], [4, 0.57], [5, 0.55], [6, 0.25], [7, 0.03]],
  gape: [[0, 0], [1, 0.08], [2, 0.5], [3, 0.75], [4, 0.78], [5, 0.72], [6, 0.3], [7, 0.03]],
  tailUp: [[0, 0], [1, -0.8], [2, 1.8], [3, 3], [5, 3], [6, 1.2], [7, 0.2]], crouch: [[0, 0], [1, 0.6], [2, 0]] })
const STRIDE = 0.6
function GAIT(phase) {
  phase %= 1
  if (phase < 2 / 3) return [STRIDE * (1 - 3 * phase), 0]
  const swing = (phase - 2 / 3) * 3
  return [STRIDE * (-1 + 2 * swing), Math.sin(swing * Math.PI) * 3]
}
const GAME_POSES = {
  // a planted gait for the park: each foot slides back flat on the ground for two thirds of the cycle
  // (the ground going by), then swings forward lifted; the far leg half a cycle behind
  walk: (i) => {
    const a = i / 8 * Math.PI * 2, foot = (phase) => GAIT(phase)
    const [ns, nu] = foot(i / 8), [fs, fu] = foot(i / 8 + 0.5)
    return { flat: true, nearStride: ns, nearUp: nu, farStride: fs, farUp: fu, crouch: (1 - Math.cos(2 * a)) * 0.5, lift: Math.cos(2 * a) * 0.04, tailUp: Math.sin(2 * a) * 0.8 }
  },
  idle: (i) => { const a = i / 8 * Math.PI * 2; return { crouch: (1 - Math.cos(a)) * 0.4, lift: Math.sin(a) * 0.04, tailUp: Math.sin(a) * 0.8 } },
  eat: (i) => { const [lift, gape] = EAT[i]; return { lift, gape, crouch: -lift * 3, tailUp: -lift * 2.5 } },
  rest: REST, roar: ROAR8,
  ...Object.fromEntries(Object.entries(MOVES).map(([name, [, rows]]) => [name, keyed(rows)])),
}
for (const [size, s] of [["adult", GAME_SCALE], ["baby", GAME_SCALE * 0.6]])
  for (const [clip, pose] of Object.entries(GAME_POSES))
    anim(`game_${size}_${clip}`, { w: Math.ceil(106 * s), h: Math.ceil(64 * s), ...OPTS2, frames: 8, fps: 8 },
      (c) => rex2({ yOff: 16, stride: -0.45, ...pose(c.frame), scale: s })(c))
// the same T-rex standing, at the native size of the menus, catalog and guide (and a hatchling's)
const STILL_SCALE = 0.842
for (const [size, s] of [["adult", STILL_SCALE], ["baby", STILL_SCALE * 0.6]])
  anim(`game_${size}_still`, { w: Math.ceil(106 * s), h: Math.ceil(48 * s), ...OPTS2, frames: 1, fps: 1 }, rex2({ stride: -0.45, scale: s }))
