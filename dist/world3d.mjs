import { buildDistrictWorld } from './district-worlds.mjs';

// Original miniature scenery, built from flat-shaded, vertex-coloured triangles.
// Each static island is one mesh. The windmill rotor and floating boats move separately.
const TAU = Math.PI * 2;
const C = {
  deep: '#49575c',
  rock: '#798287',
  lightRock: '#a7a59a',
  shale: '#586b73',
  sand: '#d4be8e',
  turf: '#879c62',
  moss: '#647f52',
  top: '#9aa96a',
  fern: '#627e4b',
  pine: '#3c6b59',
  fir: '#537a5b',
  oak: '#5b493b',
  timber: '#886545',
  timberLight: '#b28c60',
  ink: '#354044',
  glass: '#668e91',
  plaster: '#e6d3aa',
  cream: '#f1e2c0',
  stone: '#b8ac92',
  roof: '#aa5643',
  ridge: '#cb7553',
  gold: '#dcb65e',
  snow: '#e5f2ed',
  ice: '#afd7d7',
  foam: '#99d6cd',
  water: '#4fa7a5',
};
let seed;
function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const between = (a, b) => a + (b - a) * rand();
const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);
const add = (a, b) => a.map((n, i) => n + b[i]);
const times = (a, s) => a.map((n) => n * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(a) {
  const len = Math.hypot(...a);
  return a.map((n) => n / (len || 1));
}
function rotationY(x, z, yaw) {
  return [Math.cos(yaw) * x + Math.sin(yaw) * z, -Math.sin(yaw) * x + Math.cos(yaw) * z];
}

class Model {
  constructor(THREE, material, colours) {
    this.THREE = THREE;
    this.material = material;
    this.colours = colours;
    this.positions = [];
    this.colors = [];
    this.frame = [0, 0, 0, 1, 0];
  }
  point([x, y, z]) {
    const [ox, oy, oz, c, s] = this.frame;
    return [ox + x * c + z * s, oy + y, oz - x * s + z * c];
  }
  at(x, y, z, yaw, draw) {
    const old = this.frame,
      [ox, oy, oz] = this.point([x, y, z]),
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    this.frame = [ox, oy, oz, old[3] * c - old[4] * s, old[4] * c + old[3] * s];
    draw();
    this.frame = old;
  }
  tri(a, b, c, tone, shade = 1) {
    if (!this.colours.has(tone)) this.colours.set(tone, new this.THREE.Color(tone));
    const rgb = this.colours.get(tone);
    for (const p of [a, b, c]) {
      this.positions.push(...this.point(p));
      this.colors.push(rgb.r * shade, rgb.g * shade, rgb.b * shade);
    }
  }
  quad(a, b, c, d, tone, shade = 1) {
    this.tri(a, b, c, tone, shade);
    this.tri(a, c, d, tone, shade);
  }
  box(x, y, z, w, h, d, tone) {
    const low = [
      [-w, -d],
      [w, -d],
      [w, d],
      [-w, d],
    ].map(([dx, dz]) => [x + dx / 2, y, z + dz / 2]);
    const high = low.map(([px, py, pz]) => [px, py + h, pz]);
    this.quad(high[0], high[3], high[2], high[1], tone, 1.04);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(low[i], high[i], high[j], low[j], tone);
    }
    this.quad(low[0], low[1], low[2], low[3], tone, 0.85);
  }
  beam(a, b, w, d, tone) {
    const dir = unit(b.map((n, i) => n - a[i]));
    const side = unit(cross(dir, Math.abs(dir[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]));
    const face = unit(cross(side, dir));
    const offsets = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => add(times(side, (w * i) / 2), times(face, (d * j) / 2)));
    const low = offsets.map((v) => add(a, v)),
      high = offsets.map((v) => add(b, v));
    this.quad(high[0], high[1], high[2], high[3], tone);
    this.quad(low[3], low[2], low[1], low[0], tone);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(low[i], low[j], high[j], high[i], tone);
    }
  }
  rings(x, z, rings, sides, angle = 0) {
    let last;
    for (const [y, rx, rz, tone] of rings) {
      const ring = Array.from({ length: sides }, (_, i) => [
        x + Math.cos(angle + (i * TAU) / sides) * rx,
        y,
        z + Math.sin(angle + (i * TAU) / sides) * rz,
      ]);
      if (last)
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides;
          this.quad(last[i], ring[i], ring[j], last[j], tone);
        }
      last = ring;
    }
    const [y, , , tone] = rings.at(-1);
    for (let i = 0; i < sides; i++) this.tri([x, y, z], last[(i + 1) % sides], last[i], tone);
  }
  mesh(name) {
    const three = this.THREE,
      geometry = new three.BufferGeometry();
    geometry.setAttribute('position', new three.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new three.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new three.Mesh(geometry, this.material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function ripple(m, x, z, w, d, yaw = 0, tone = C.foam) {
  m.at(x, 0.017, z, yaw, () =>
    m.quad([-w / 2, 0, 0], [-w * 0.2, 0, d * 0.55], [w / 2, 0, 0], [w * 0.12, 0, -d * 0.4], tone),
  );
}
function boulder(m, x, y, z, w, h, d, tone = C.rock) {
  const phase = rand() * TAU,
    n = 5 + Math.floor(rand() * 3);
  const corners = Array.from({ length: n }, (_, i) => [
    Math.cos(phase + (i * TAU) / n) * between(0.8, 1),
    Math.sin(phase + (i * TAU) / n) * between(0.84, 1),
  ]);
  const foot = corners.map(([a, b]) => [x + w * a * 0.47, y, z + d * b * 0.47]);
  const shoulder = corners.map(([a, b]) => [x + w * a * 0.52, y + h * between(0.32, 0.53), z + d * b * 0.52]);
  const brow = corners.map(([a, b]) => [
    x + w * (a * 0.31 + 0.04),
    y + h * between(0.69, 0.91),
    z + d * (b * 0.3 - 0.04),
  ]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad(foot[i], shoulder[i], shoulder[j], foot[j], tone, between(0.7, 0.9));
    m.tri(shoulder[i], brow[i], shoulder[j], tone, between(0.86, 1.06));
    m.tri(shoulder[j], brow[i], brow[j], tone, between(0.89, 1.08));
    m.tri([x + 0.03 * w, y + h, z], brow[j], brow[i], tone, between(0.97, 1.08));
  }
}
function isle(m, x, z, rx, rz, h, patch = false, grass = C.turf) {
  const n = patch ? 16 : 32,
    phase = between(0, 0.5),
    coast = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n + phase,
      v = 1 + 0.055 * Math.sin(a * 3 + 0.7) + 0.045 * Math.sin(a * 5 + 1.3) + between(-0.05, 0.045);
    coast.push([Math.cos(a) * rx * v, Math.sin(a) * rz * v]);
  }
  const layers = patch
    ? [
        [0.28, 1.05, C.shale],
        [h - 0.095, 1, C.lightRock],
        [h - 0.04, 0.98, C.moss],
        [h, 0.96, C.top],
      ]
    : [
        [-0.105, 1.045, C.deep],
        [0.035, 1.03, C.sand],
        [0.085, 0.986, C.sand],
        [0.13, 0.955, C.deep],
        [h - 0.095, 0.929, C.rock],
        [h - 0.054, 0.919, C.lightRock],
        [h - 0.035, 0.91, C.fern],
        [h, 0.907, grass],
      ];
  let prev;
  for (const [y, k, tone] of layers) {
    const row = coast.map(([dx, dz]) => [x + dx * k, y + between(-0.009, 0.009), z + dz * k]);
    if (prev)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        m.tri(prev[i], row[i], row[j], tone, between(0.86, 1.07));
        m.tri(prev[i], row[j], prev[j], tone, between(0.84, 1.04));
      }
    prev = row;
  }
  const mid = prev.map((p) => [x + (p[0] - x) * 0.53, h + 0.008, z + (p[2] - z) * 0.53]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.quad(prev[i], mid[i], mid[j], prev[j], patch ? C.top : grass, between(0.96, 1.045));
    m.tri([x, h + 0.011, z], mid[j], mid[i], patch ? C.top : grass, between(0.97, 1.04));
    if (patch) continue;
    const p = coast[i],
      next = coast[j],
      shape = Math.atan2(next[1] - p[1], next[0] - p[0]);
    if (i % 4 !== 2) {
      const k = between(1.025, 1.065);
      ripple(m, x + p[0] * k, z + p[1] * k, between(0.13, 0.39), between(0.018, 0.031), -shape);
    }
    if (i % 3 !== 0) {
      const far = i % 5 === 0 ? 1.047 : 0.954;
      boulder(
        m,
        x + p[0] * far,
        -0.05,
        z + p[1] * far,
        between(0.17, 0.43),
        h * between(0.6, 1.02),
        between(0.13, 0.33),
        i % 4 ? C.rock : C.lightRock,
      );
    }
  }
}
function path(m, points, width, tone = C.sand) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      len = Math.hypot(dx, dz),
      off = [((-dz / len) * width) / 2, 0, ((dx / len) * width) / 2];
    m.quad(add(a, off), add(b, off), add(b, times(off, -1)), add(a, times(off, -1)), tone);
  }
}
function pine(m, x, y, z, h, snow = false) {
  const w = h * between(0.24, 0.3),
    n = 7,
    a = rand() * TAU;
  m.rings(
    x,
    z,
    [
      [y, 0.04 * h, 0.04 * h, C.oak],
      [y + h * 0.53, 0.025 * h, 0.025 * h, C.timber],
    ],
    6,
    a,
  );
  for (let tier = 0; tier < 3; tier++) {
    const ry = y + h * (0.19 + tier * 0.18),
      peak = y + h * (0.62 + tier * 0.19),
      r = w * (1 - tier * 0.21);
    const ring = Array.from({ length: n }, (_, i) => {
      const ang = a + tier * 0.4 + (i * TAU) / n;
      return [x + Math.cos(ang) * r, ry + between(-0.043, 0.037) * h, z + Math.sin(ang) * r];
    });
    const tip = [x + 0.018 * h, peak, z - 0.008 * h];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        tone = tier === 2 ? '#66855a' : tier === 1 ? C.fir : C.pine;
      m.tri(ring[i], tip, ring[j], tone, between(0.84, 1.1));
      m.tri([x, ry + 0.045 * h, z], ring[i], ring[j], C.pine, 0.72);
      if (snow && (tier === 2 || (i + tier) % 3 === 0)) {
        const a = mix(tip, ring[i], 0.58),
          b = mix(tip, ring[j], 0.48);
        a[1] += 0.012;
        b[1] += 0.012;
        m.tri(a, [tip[0], tip[1] + 0.014, tip[2]], b, C.snow, 0.97);
      }
    }
  }
}
function oak(m, x, y, z, h) {
  m.beam([x, y, z], [x + 0.04 * h, y + h * 0.64, z], 0.082 * h, 0.09 * h, C.oak);
  for (const [dx, dz, dy, s] of [
    [-0.13, 0.02, 0.44, 0.45],
    [0.15, -0.04, 0.48, 0.4],
    [0.02, 0.12, 0.55, 0.42],
    [0, -0.04, 0.64, 0.45],
  ]) {
    m.beam(
      [x, y + h * 0.31, z],
      [x + h * dx, y + h * (dy + 0.07), z + h * dz],
      0.043 * h,
      0.04 * h,
      C.timber,
    );
    boulder(m, x + h * dx, y + h * dy, z + h * dz, s * h, h * 0.33, s * h, dy > 0.54 ? '#a0ad5b' : '#829b53');
  }
}
function fence(m, points, height = 0.13) {
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    m.box(x, y, z, 0.035, height, 0.035, C.timber);
    if (i)
      for (const k of [0.42, 0.78])
        m.beam(add(points[i - 1], [0, k * height, 0]), [x, y + k * height, z], 0.019, 0.023, C.timberLight);
  }
}

function windowPane(m, x, y, z, w, h) {
  m.box(x, y, z, w * 1.26, h * 1.13, 0.026, C.timber);
  m.box(x, y + 0.014, z + 0.015, w, h * 0.87, 0.018, C.glass);
  m.box(x, y + 0.016, z + 0.029, w * 0.095, h * 0.84, 0.009, C.plaster);
  m.box(x, y + h * 0.52, z + 0.03, w, 0.012, 0.009, C.plaster);
  m.box(x, y - 0.008, z + 0.023, w * 1.36, 0.023, 0.044, C.stone);
}
function roof(m, w, d, eave, rise, tone) {
  const x = w * 0.55,
    z = d * 0.57,
    rows = 4,
    columns = Math.max(4, Math.round(w * 8)),
    ridge = eave + rise;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const a = row / rows,
        b = (row + 1) / rows;
      const y0 = eave + (1 - a) * rise,
        y1 = eave + (1 - b) * rise;
      const cuts = [-x];
      for (let i = 1; i <= columns; i++) {
        const px = -x + ((i - (row % 2) * 0.5) * 2 * x) / columns;
        if (px < x - 0.001) cuts.push(px);
      }
      cuts.push(x);
      for (let i = 1; i < cuts.length; i++) {
        const l = cuts[i - 1],
          r = cuts[i];
        m.quad(
          [l, y0, z * a * side],
          [r, y0, z * a * side],
          [r, y1, z * b * side],
          [l, y1, z * b * side],
          tone,
          between(0.87, 1.12),
        );
      }
    }
    m.beam([-x, eave, z * side], [x, eave, z * side], 0.026, 0.04, C.oak);
  }
  m.beam([-x - 0.01, ridge + 0.007, 0], [x + 0.01, ridge + 0.007, 0], 0.038, 0.034, C.ridge);
  for (const side of [-1, 1]) {
    const xx = side * w * 0.5;
    m.tri([xx, eave, -d * 0.5], [xx, ridge, 0], [xx, eave, d * 0.5], C.plaster);
  }
}
function house(m, x, y, z, w, h, d, yaw = 0, options = {}) {
  m.at(x, y, z, yaw, () => {
    const foot = 0.062,
      rise = d * 0.34,
      eave = foot + h;
    const wall = options.wall || C.plaster;
    m.box(0, 0, 0, w * 1.04, foot, d * 1.04, C.stone);
    m.box(0, foot, 0, w, h, d, wall);
    for (const sign of [-1, 1]) m.box(sign * (w * 0.5 - 0.011), foot, d * 0.505, 0.026, h, 0.018, C.stone);
    roof(m, w, d, eave, rise, options.roof || C.roof);
    const dz = d * 0.51,
      doorW = Math.min(w * 0.22, 0.15),
      doorH = Math.min(h * 0.75, 0.28),
      doorX = options.doorCenter ? 0 : -w * 0.22;
    m.box(doorX, foot, dz, doorW * 1.2, doorH * 1.08, 0.03, C.stone);
    m.box(doorX, foot, dz + 0.018, doorW, doorH, 0.025, C.oak);
    m.box(doorX + doorW * 0.32, foot + doorH * 0.52, dz + 0.035, 0.013, 0.014, 0.009, C.gold);
    m.box(doorX, 0.012, dz + 0.043, doorW * 1.65, 0.039, 0.12, C.lightRock);
    const winW = Math.min(w * 0.17, 0.13),
      winH = Math.min(h * 0.38, 0.145);
    const positions = options.doorCenter ? [-w * 0.32, w * 0.32] : [w * 0.21];
    for (const wx of positions) windowPane(m, wx, foot + h * 0.34, dz, winW, winH);
    for (const side of [-1, 1])
      m.at(side * w * 0.505, foot + h * 0.34, 0, (side * Math.PI) / 2, () =>
        windowPane(m, 0, 0, 0, winW * 0.86, winH * 0.89),
      );
    m.at(0, foot + h * 0.34, -d * 0.51, Math.PI, () => windowPane(m, 0, 0, 0, winW, winH));
    if (options.chimney !== false) {
      const cx = w * 0.27,
        cz = -d * 0.18;
      m.box(cx, eave + 0.04, cz, 0.075, rise + 0.067, 0.085, C.stone);
      m.box(cx, eave + rise + 0.096, cz, 0.095, 0.025, 0.1, C.oak);
    }
    if (options.awning) {
      const aw = w * 0.66,
        top = foot + h * 0.71;
      for (let i = 0; i < 7; i++) {
        const l = -aw / 2 + (i * aw) / 7,
          r = l + aw / 7,
          tone = i % 2 ? C.cream : options.awning;
        m.quad([l, top, dz], [r, top, dz], [r, top - 0.062, dz + 0.152], [l, top - 0.062, dz + 0.152], tone);
        m.quad(
          [l, top - 0.062, dz + 0.152],
          [r, top - 0.062, dz + 0.152],
          [r, top - 0.092, dz + 0.152],
          [l, top - 0.092, dz + 0.152],
          tone,
        );
      }
      for (const side of [-1, 1])
        m.box(side * aw * 0.48, 0.035, dz + 0.145, 0.018, top - 0.095, 0.018, C.timber);
    }
  });
}
function dock(m, x, z, yaw, w = 0.36, length = 0.61, deck = 0.24) {
  m.at(x, 0, z, yaw, () => {
    m.box(0, deck - 0.071, 0, w - 0.035, 0.06, length, C.oak);
    const n = Math.ceil(length / 0.074);
    for (let i = 0; i < n; i++)
      m.box(
        0,
        deck - 0.017,
        -length / 2 + ((i + 0.5) * length) / n,
        w,
        0.034,
        length / n - 0.007,
        i % 3 === 0 ? C.timberLight : '#9b7751',
      );
    for (const sign of [-1, 1])
      for (const k of [-0.37, 0.37]) {
        const ax = sign * (w / 2 + 0.012),
          az = k * length;
        m.rings(
          ax,
          az,
          [
            [-0.07, 0.038, 0.038, C.oak],
            [deck + 0.095, 0.036, 0.036, C.timber],
            [deck + 0.106, 0.036, 0.036, C.timberLight],
          ],
          7,
        );
        m.rings(
          ax,
          az,
          [
            [deck + 0.02, 0.038, 0.038, C.ink],
            [deck + 0.037, 0.038, 0.038, C.ink],
          ],
          7,
        );
      }
  });
}
function crate(m, x, y, z, s) {
  m.box(x, y, z, s, s * 0.85, s * 0.87, C.timberLight);
  for (const side of [-1, 1]) m.box(x + s * 0.36 * side, y, z + s * 0.445, s * 0.11, s * 0.85, 0.012, C.oak);
  m.beam(
    [x - s * 0.4, y + s * 0.07, z + s * 0.46],
    [x + s * 0.4, y + s * 0.79, z + s * 0.46],
    0.023,
    0.018,
    C.timber,
  );
}
function lighthouse(m, x, y, z) {
  m.at(x, y, z, -0.14, () => {
    m.rings(
      0,
      0,
      [
        [0, 0.435, 0.435, C.stone],
        [0.07, 0.43, 0.43, C.stone],
        [0.077, 0.36, 0.36, C.cream],
        [0.14, 0.35, 0.35, C.stone],
      ],
      12,
    );
    const profile = [
      [0.14, 0.274, C.cream],
      [0.46, 0.256, '#f3e5c6'],
      [0.76, 0.231, '#b63f32'],
      [0.99, 0.211, '#f3e5c6'],
      [1.257, 0.19, '#b63f32'],
      [1.36, 0.18, '#f1dfbc'],
    ];
    m.rings(
      0,
      0,
      profile.map(([v, r, c]) => [v, r, r, c]),
      12,
      Math.PI / 12,
    );
    for (const [v, r] of [
      [0.53, 0.254],
      [1.02, 0.213],
    ])
      m.rings(
        0,
        0,
        [
          [v - 0.015, r, r, C.stone],
          [v + 0.009, r, r, C.stone],
        ],
        12,
        Math.PI / 12,
      );
    m.box(0, 0.14, 0.258, 0.11, 0.217, 0.046, C.oak);
    m.box(0, 0.37, 0.251, 0.145, 0.024, 0.04, C.stone);
    for (const [v, angle, r] of [
      [0.57, -0.4, 0.245],
      [0.84, 0.4, 0.22],
      [1.1, -0.15, 0.199],
      [0.89, 2.6, 0.22],
    ]) {
      m.at(0, v, 0, angle, () => windowPane(m, 0, 0, r, 0.05, 0.077));
    }
    m.rings(
      0,
      0,
      [
        [1.34, 0.2, 0.2, C.oak],
        [1.38, 0.29, 0.29, C.ink],
        [1.425, 0.29, 0.29, C.stone],
      ],
      12,
    );
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12,
        b = ((i + 1) * TAU) / 12,
        r = 0.272,
        p = [Math.cos(a) * r, 1.425, Math.sin(a) * r];
      m.box(p[0], p[1], p[2], 0.016, 0.119, 0.016, C.ink);
      m.beam(add(p, [0, 0.111, 0]), [Math.cos(b) * r, 1.536, Math.sin(b) * r], 0.018, 0.019, C.ink);
    }
    m.rings(
      0,
      0,
      [
        [1.426, 0.165, 0.165, C.gold],
        [1.454, 0.172, 0.172, C.ink],
        [1.654, 0.16, 0.16, '#ffcc70'],
        [1.681, 0.19, 0.19, C.ink],
      ],
      10,
    );
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      m.box(Math.cos(a) * 0.164, 1.451, Math.sin(a) * 0.164, 0.014, 0.211, 0.014, C.ink);
    }
    m.rings(
      0,
      0,
      [
        [1.675, 0.229, 0.229, '#d66243'],
        [1.711, 0.222, 0.222, '#ad4031'],
        [1.804, 0.147, 0.147, '#b74d35'],
        [1.868, 0.043, 0.043, C.ridge],
        [1.943, 0.012, 0.012, C.gold],
      ],
      12,
    );
  });
}
function mountain(m, x, y, z, rx, rz, height) {
  const count = 10,
    a = rand(),
    top = [x + rx * 0.15, y + height, z - rz * 0.09];
  const rings = [[], [], [], []];
  for (let i = 0; i < count; i++) {
    const theta = a + (TAU * i) / count,
      dx = Math.cos(theta) * rx * between(0.87, 1.06),
      dz = Math.sin(theta) * rz * between(0.87, 1.05);
    const rockLine = between(0.26, 0.39),
      snowLine = between(0.5, 0.74),
      spine = between(0.76, 0.91);
    for (const [k, level] of [0, rockLine, snowLine, spine].entries()) {
      const r = (1 - level) * (k === 1 ? 1.15 : k === 2 ? 1.08 : 1);
      rings[k].push([
        x + dx * r + (top[0] - x) * level,
        y + height * level,
        z + dz * r + (top[2] - z) * level,
      ]);
    }
  }
  for (let k = 1; k < 4; k++)
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count,
        l = rings[k - 1],
        u = rings[k];
      const tone = k === 3 ? (i % 4 === 1 ? C.ice : C.snow) : i % 3 === 1 ? '#63747e' : C.rock;
      m.tri(l[i], u[i], u[j], tone, between(0.84, 1.11));
      m.tri(l[i], u[j], l[j], k === 3 ? C.snow : tone, between(0.84, 1.14));
      if (k === 2 && i % 3 !== 1) {
        const tip = mix(u[j], l[i], i % 3 === 0 ? 0.62 : 0.32);
        tip[0] += (l[i][0] - x) * 0.009;
        tip[2] += (l[i][2] - z) * 0.009;
        tip[1] += 0.008;
        const a = add(u[i], [0, 0.013, 0]),
          b = add(u[j], [0, 0.013, 0]);
        m.tri(a, b, tip, C.snow, 0.97);
      }
    }
  for (let i = 0; i < count; i++)
    m.tri(rings[3][i], top, rings[3][(i + 1) % count], i % 4 ? C.snow : C.ice, between(0.94, 1.1));
}
function mine(m, x, y, z) {
  m.at(x, y, z, -0.12, () => {
    boulder(m, 0, -0.02, -0.18, 1.12, 0.68, 0.67, C.shale);
    m.box(0, 0.01, 0.144, 0.437, 0.32, 0.035, C.ink);
    m.tri([-0.218, 0.32, 0.164], [0, 0.45, 0.164], [0.218, 0.32, 0.164], C.ink);
    for (const side of [-1, 1]) {
      m.box(side * 0.244, 0, 0.174, 0.067, 0.37, 0.09, C.timber);
      m.beam([side * 0.244, 0.34, 0.174], [0, 0.472, 0.174], 0.068, 0.084, C.timberLight);
      m.beam([side * 0.233, 0.23, 0.226], [side * 0.125, 0.355, 0.226], 0.033, 0.027, C.oak);
    }
    m.box(0, 0.34, 0.198, 0.53, 0.058, 0.063, C.timberLight);
    for (let i = 0; i < 8; i++) m.box(i * 0.018, 0, 0.2 + i * 0.079, 0.34, 0.025, 0.042, C.timber);
    for (const side of [-1, 1])
      m.beam([side * 0.109, 0.028, 0.14], [0.136 + side * 0.109, 0.028, 0.82], 0.024, 0.024, C.ink);
    m.at(0.085, 0.045, 0.55, 0.14, () => {
      m.box(0, 0, 0, 0.215, 0.04, 0.23, C.ink);
      m.box(0, 0.042, 0, 0.25, 0.116, 0.24, C.oak);
      m.box(0, 0.137, 0, 0.267, 0.024, 0.25, C.ink);
      for (let i = 0; i < 5; i++)
        boulder(m, between(-0.067, 0.069), 0.15, between(-0.064, 0.06), 0.09, 0.055, 0.077, C.deep);
    });
  });
}

function clockTower(m, x, y, z) {
  m.at(x, y, z, -0.11, () => {
    m.box(0, 0, 0, 0.37, 0.12, 0.35, C.stone);
    m.box(0, 0.11, 0, 0.301, 0.88, 0.296, C.plaster);
    for (const h of [0.39, 0.71, 0.95]) m.box(0, h, 0, 0.335, 0.042, 0.321, C.stone);
    for (let i = 0; i < 4; i++)
      m.at(0, 0, 0, (i * Math.PI) / 2, () => {
        m.box(0, 0.732, 0.15, 0.114, 0.188, 0.015, C.ink);
        m.box(0, 0.731, 0.162, 0.014, 0.187, 0.012, C.stone);
        const p = [0, 0.568, 0.157],
          r = 0.07;
        for (let k = 0; k < 12; k++) {
          const a = (k * TAU) / 12,
            b = ((k + 1) * TAU) / 12;
          m.tri(
            p,
            [Math.cos(a) * r, 0.568 + Math.sin(a) * r, 0.157],
            [Math.cos(b) * r, 0.568 + Math.sin(b) * r, 0.157],
            C.cream,
          );
        }
        m.beam([0, 0.568, 0.163], [0, 0.611, 0.163], 0.012, 0.012, C.ink);
        m.beam([0, 0.568, 0.163], [0.032, 0.552, 0.163], 0.014, 0.012, C.ink);
      });
    m.rings(
      0,
      0,
      [
        [0.976, 0.264, 0.264, C.timber],
        [1.015, 0.26, 0.26, C.ridge],
        [1.193, 0.034, 0.034, C.roof],
        [1.25, 0.01, 0.01, C.gold],
      ],
      4,
      Math.PI / 4,
    );
  });
}
function harborCrane(m, x, y, z) {
  m.at(x, y, z, -0.42, () => {
    m.box(0, 0, 0, 0.27, 0.055, 0.245, C.oak);
    const mast = [0, 0.66, 0],
      tip = [-0.015, 0.79, 0.38];
    m.beam([0, 0.03, 0], mast, 0.068, 0.074, C.timber);
    m.beam([0, 0.43, 0], tip, 0.047, 0.047, C.timberLight);
    m.beam(mast, tip, 0.045, 0.046, C.timber);
    m.beam([0, 0.23, -0.085], [0, 0.61, 0], 0.039, 0.039, C.oak);
    m.beam(tip, [-0.015, 0.26, 0.38], 0.008, 0.008, C.ink);
    crate(m, -0.015, 0.12, 0.38, 0.13);
    for (let i = 0; i < 4; i++)
      m.beam(
        [-0.062, 0.24, -0.085],
        [-0.062, 0.24 + Math.cos((i * Math.PI) / 2) * 0.097, -0.085 + Math.sin((i * Math.PI) / 2) * 0.097],
        0.017,
        0.017,
        C.oak,
      );
  });
}
function wharfWall(m, x, y, z, width, yaw) {
  m.at(x, y, z, yaw, () => {
    m.box(0, -0.035, 0, width, 0.255, 0.2, C.shale);
    for (let j = 0; j < 2; j++) {
      const n = Math.ceil(width / 0.24),
        step = (width - 0.02) / n;
      for (let i = 0; i < n; i++)
        m.box(
          -width * 0.5 + step * (i + 0.5),
          j * 0.105 + 0.002,
          0.11,
          step - 0.015,
          0.091,
          0.043,
          (i + j) % 3 === 1 ? C.lightRock : C.stone,
        );
    }
    m.box(0, 0.205, 0, width + 0.03, 0.042, 0.241, C.stone);
  });
}
function marketStall(m, x, y, z, yaw) {
  m.at(x, y, z, yaw, () => {
    for (const dx of [-0.17, 0.17])
      for (const dz of [-0.09, 0.1]) m.box(dx, 0, dz, 0.021, 0.25, 0.022, C.oak);
    const tone = ['#a34c3b', '#ead3a2'];
    for (let i = 0; i < 7; i++) {
      const l = -0.213 + i * 0.061,
        r = l + 0.061;
      m.quad([l, 0.276, -0.142], [r, 0.276, -0.142], [r, 0.305, -0.015], [l, 0.305, -0.015], tone[i % 2]);
      m.quad([l, 0.305, -0.015], [r, 0.305, -0.015], [r, 0.247, 0.156], [l, 0.247, 0.156], tone[i % 2]);
      m.quad([l, 0.247, 0.156], [r, 0.247, 0.156], [r, 0.214, 0.156], [l, 0.214, 0.156], tone[i % 2]);
    }
    m.box(0, 0.03, 0.065, 0.324, 0.079, 0.1, C.timberLight);
    for (const [xx, c] of [
      [-0.09, '#bb6041'],
      [0, '#b49d58'],
      [0.09, '#d0ac67'],
    ])
      m.box(xx, 0.112, 0.062, 0.074, 0.024, 0.065, c);
  });
}
function rowingBoat(m, x, z, yaw) {
  m.at(x, 0.025, z, yaw, () => {
    const shape = [
      [0, -0.261],
      [0.081, -0.141],
      [0.093, 0.061],
      [0.057, 0.18],
      [0, 0.276],
      [-0.057, 0.18],
      [-0.093, 0.061],
      [-0.081, -0.141],
    ];
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i],
        b = shape[(i + 1) % shape.length],
        pa = [a[0], 0.067, a[1]],
        pb = [b[0], 0.067, b[1]];
      m.quad([a[0] * 0.69, -0.014, a[1] * 0.84], pa, pb, [b[0] * 0.69, -0.014, b[1] * 0.84], '#9a4d3d');
      m.beam(pa, pb, 0.014, 0.012, C.cream);
      m.tri([0, 0.041, 0], pb, pa, C.timber);
    }
    for (const zz of [-0.08, 0.068]) m.box(0, 0.066, zz, 0.14, 0.013, 0.029, C.timberLight);
    m.beam([-0.093, 0.081, -0.14], [0.069, 0.092, 0.163], 0.011, 0.009, C.oak);
  });
}
function windTower(m, x, y, z, yaw) {
  m.at(x, y, z, yaw, () => {
    m.rings(
      0,
      0,
      [
        [0, 0.319, 0.319, C.stone],
        [0.088, 0.308, 0.308, C.stone],
        [0.92, 0.211, 0.211, C.plaster],
        [1.02, 0.206, 0.206, C.cream],
      ],
      10,
      Math.PI / 10,
    );
    m.rings(
      0,
      0,
      [
        [0.98, 0.245, 0.245, C.oak],
        [1.026, 0.247, 0.247, C.ridge],
        [1.165, 0.146, 0.146, C.roof],
        [1.245, 0.021, 0.021, C.ridge],
      ],
      10,
    );
    m.box(0, 0.075, 0.289, 0.11, 0.227, 0.037, C.timber);
    m.box(0, 0.286, 0.289, 0.134, 0.024, 0.04, C.oak);
    windowPane(m, -0.053, 0.56, 0.246, 0.073, 0.109);
    m.at(0.226, 0.55, 0, Math.PI / 2, () => windowPane(m, 0, 0, 0, 0.065, 0.095));
    m.beam([0, 0.949, 0.078], [0, 0.949, 0.321], 0.086, 0.085, C.oak);
  });
}
function blades(m) {
  for (let i = 0; i < 4; i++) {
    const angle = 0.43 + (i * Math.PI) / 2,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const pt = (x, y, z) => [x * 1.23 * c - y * 1.02 * s, x * 1.23 * s + y * 1.02 * c, z];
    m.beam(pt(0, 0, 0), pt(0, 0.804, 0), 0.037, 0.047, C.oak);
    for (let band = 0; band < 6; band++) {
      const a = 0.271 + band * 0.082,
        b = a + 0.075,
        wa = 0.082 + (a - 0.25) * 0.105,
        wb = 0.082 + (b - 0.25) * 0.105;
      m.quad(
        pt(0.006, a, 0.003),
        pt(wa, a, 0.003),
        pt(wb, b, 0.003),
        pt(0.006, b, 0.003),
        band % 3 === 0 ? '#d4bf91' : C.cream,
      );
      m.beam(pt(-0.018, a, 0.013), pt(wa + 0.013, a, 0.013), 0.013, 0.015, C.timber);
    }
    m.beam(pt(0.094, 0.27, 0.012), pt(0.153, 0.765, 0.012), 0.014, 0.015, C.timber);
  }
  m.box(0, -0.054, 0, 0.109, 0.109, 0.08, C.ridge);
}
function field(m, x, y, z, w, d, yaw) {
  m.at(x, y, z, yaw, () => {
    m.box(0, 0.006, 0, w, 0.027, d, '#946e44');
    const rows = Math.max(3, Math.round(w / 0.13)),
      plants = Math.max(4, Math.round(d / 0.11));
    for (let i = 0; i < rows; i++) {
      const xx = -w / 2 + ((i + 0.5) * w) / rows;
      m.box(xx, 0.034, 0, 0.064, 0.026, d - 0.015, '#c69b46');
      for (let j = 0; j < plants; j++) {
        const zz = -d / 2 + ((j + 0.5) * d) / plants + between(-0.012, 0.012),
          h = between(0.092, 0.158),
          lean = between(-0.016, 0.016);
        const p = [xx, 0.039, zz],
          mid = [xx + lean * 0.5, 0.038 + h * 0.58, zz],
          tip = [xx + lean, 0.039 + h, zz];
        m.tri(p, [xx + 0.024, 0.04, zz + 0.003], tip, '#c89b39');
        m.tri(mid, [tip[0] - 0.029, tip[1] - 0.023, zz + 0.02], tip, '#f0ca61');
        m.tri(mid, [tip[0] + 0.033, tip[1] - 0.016, zz - 0.018], tip, '#eab349');
      }
    }
  });
}
function vessel(m, size, sailTone, flagTone) {
  const shape = [
    [0, -0.58],
    [0.142, -0.38],
    [0.172, 0.08],
    [0.125, 0.378],
    [0, 0.62],
    [-0.125, 0.378],
    [-0.172, 0.08],
    [-0.142, -0.38],
  ];
  const layer = (f, y) =>
    shape.map(([x, z]) => [x * f * size, (y + Math.abs(z) * 0.055) * size, z * f * size]);
  const keel = layer(0.64, -0.053),
    skin = layer(1, 0.084),
    rim = layer(1.01, 0.111);
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length;
    m.quad(keel[i], skin[i], skin[j], keel[j], i % 3 ? C.timber : C.oak);
    m.quad(skin[i], rim[i], rim[j], skin[j], C.cream);
    m.tri([0, 0.113 * size, 0], rim[j], rim[i], C.timberLight);
  }
  const p = (x, y, z) => [x * size, y * size, z * size];
  m.beam(p(0, 0.09, -0.07), p(0, 1, -0.071), 0.022 * size, 0.022 * size, C.oak);
  m.beam(p(0, 0.205, -0.085), p(0.09, 0.213, -0.507), 0.017 * size, 0.018 * size, C.oak);
  const top = p(0, 0.91, -0.078),
    foot = p(0, 0.239, -0.08),
    corner = p(0.09, 0.229, -0.496),
    billow = p(0.1, 0.455, -0.235);
  m.tri(top, billow, foot, sailTone);
  m.tri(top, corner, billow, sailTone, 0.94);
  m.tri(foot, billow, corner, sailTone, 1.07);
  const jibTop = p(0, 0.824, -0.052),
    jibFoot = p(0.015, 0.225, 0.014),
    jibBow = p(0.03, 0.209, 0.47),
    curve = p(0.074, 0.403, 0.165);
  m.tri(jibTop, jibFoot, curve, C.cream);
  m.tri(jibTop, curve, jibBow, C.cream, 0.97);
  m.tri(jibFoot, jibBow, curve, C.cream, 1.04);
  m.beam(p(0, 0.978, -0.07), p(0, 0.134, 0.57), 0.008, 0.008, C.oak);
  m.beam(p(0, 0.959, -0.07), p(0, 0.137, -0.54), 0.008, 0.008, C.oak);
  m.tri(p(0, 1.01, -0.071), p(0.01, 0.937, -0.07), p(0.024, 0.98, -0.235), flagTone);
  m.box(0, 0.138 * size, 0.05 * size, 0.163 * size, 0.023 * size, 0.037 * size, C.oak);
}
function flowers(m, x, y, z, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = TAU * rand(),
      r = Math.sqrt(rand()) * spread,
      px = x + Math.cos(a) * r,
      pz = z + Math.sin(a) * r,
      h = between(0.027, 0.067);
    m.tri([px - 0.007, y, pz], [px + 0.007, y, pz], [px + 0.007, y + h, pz + 0.009], C.fern);
    const col = i % 4 === 1 ? '#eee3ca' : '#d7b958';
    m.tri(
      [px - 0.014, y + h - 0.014, pz],
      [px + 0.014, y + h - 0.014, pz],
      [px, y + h + 0.01, pz + 0.004],
      col,
    );
  }
}

function lighthouseBay(m) {
  const h = 0.31;
  isle(m, -3.49, -1.85, 2.4, 1.22, h, false, '#819757');
  isle(m, -3.13, -2.12, 1.3, 0.69, 0.545, true);
  lighthouse(m, -3.04, 0.555, -2.13);
  house(m, -3.74, 0.553, -2.03, 0.44, 0.3, 0.32, 0.14, { roof: '#a64e3e' });
  house(m, -4.0, h + 0.012, -1.17, 0.57, 0.34, 0.39, 0.23);
  house(m, -2.72, h + 0.012, -1.09, 0.46, 0.28, 0.34, -0.3, { roof: '#a96d4c' });
  path(
    m,
    [
      [-4.42, 0.337, -1.04],
      [-3.96, 0.337, -0.92],
      [-3.47, 0.337, -1.0],
      [-2.91, 0.337, -1.0],
      [-2.38, 0.337, -0.99],
    ],
    0.116,
  );
  path(
    m,
    [
      [-3.47, 0.337, -1.0],
      [-3.39, 0.337, -1.37],
    ],
    0.13,
  );
  for (let i = 0; i < 6; i++)
    m.box(-3.41 + i * 0.009, 0.326 + i * 0.037, -1.34 - i * 0.065, 0.182, 0.042, 0.082, C.stone);
  dock(m, -2.72, -0.56, -0.23, 0.27, 0.54, 0.211);
  for (const [x, z, size] of [
    [-5.0, -2.11, 0.84],
    [-4.79, -2.48, 0.98],
    [-4.47, -2.53, 0.73],
    [-5.24, -1.89, 0.66],
    [-4.82, -1.82, 0.88],
    [-4.5, -2.12, 0.81],
    [-4.33, -1.67, 0.6],
    [-2.25, -2.53, 0.65],
    [-1.95, -2.18, 0.71],
    [-1.71, -1.81, 0.63],
    [-2.09, -1.64, 0.61],
    [-4.95, -1.48, 0.64],
    [-2.68, -2.75, 0.56],
  ]) {
    pine(m, x, h, z, size);
  }
  fence(
    m,
    [
      [-3.95, h + 0.013, -1.53],
      [-3.76, h + 0.013, -1.47],
      [-3.55, h + 0.013, -1.42],
    ],
    0.12,
  );
  fence(
    m,
    [
      [-2.75, 0.553, -1.73],
      [-2.55, 0.553, -1.86],
      [-2.45, 0.553, -2.05],
    ],
    0.093,
  );
  for (const [a, b] of [
    [
      [-3.99, 0.558, -1.91],
      [-3.75, 0.558, -1.72],
    ],
    [
      [-3.74, 0.558, -1.72],
      [-3.49, 0.558, -1.66],
    ],
    [
      [-3.24, 0.558, -1.64],
      [-2.88, 0.558, -1.68],
    ],
  ]) {
    m.beam(add(a, [0, 0.03, 0]), add(b, [0, 0.03, 0]), 0.06, 0.065, C.stone);
    m.box(a[0], a[1], a[2], 0.07, 0.097, 0.07, C.lightRock);
  }
  for (const [x, z] of [
    [-4.63, -1.31],
    [-2.06, -1.31],
    [-4.58, -2.46],
    [-3.24, -1.13],
  ])
    flowers(m, x, h + 0.015, z, 13, 0.16);
}
function blueReef(m) {
  const h = 0.332;
  isle(m, 3.4, -1.83, 2.55, 1.31, h, false, '#879a68');
  mountain(m, 3.14, h, -2.04, 1.25, 0.86, 1.44);
  mountain(m, 4.26, h, -2.19, 1.1, 0.86, 1.17);
  mountain(m, 3.64, h, -2.18, 1.23, 0.87, 2.16);
  mountain(m, 2.6, h, -2.03, 0.63, 0.63, 1.07);
  mine(m, 4.43, h + 0.008, -1.65);
  house(m, 5.06, h + 0.012, -1.38, 0.39, 0.27, 0.3, -0.2, { roof: '#8b5741' });
  path(
    m,
    [
      [3.62, 0.359, -0.91],
      [4.15, 0.359, -0.98],
      [4.72, 0.359, -0.91],
      [5.05, 0.359, -1.13],
    ],
    0.131,
    '#b5a282',
  );
  // A little mountain stream breaks through the dark lip of the south-facing cliff.
  const channel = [
    [2.64, 0.703, -1.48],
    [2.61, 0.444, -1.28],
    [2.52, 0.363, -1.12],
    [2.53, 0.359, -0.935],
    [2.44, 0.351, -0.865],
    [2.41, 0.07, -0.825],
    [2.39, 0.028, -0.77],
  ];
  path(m, channel, 0.126, '#70b7b5');
  path(
    m,
    channel.map(([x, y, z]) => [x - 0.025, y + 0.003, z]),
    0.027,
    '#bce0d8',
  );
  for (const [x, z, size, snow] of [
    [1.64, -1.72, 0.76, true],
    [1.93, -1.99, 0.91, true],
    [2.18, -1.57, 0.76, true],
    [2.72, -1.37, 0.64, true],
    [3.17, -1.18, 0.72, true],
    [3.39, -0.97, 0.44, false],
    [5.08, -2.26, 0.77, true],
    [5.37, -1.93, 0.64, true],
    [4.79, -2.62, 0.58, true],
    [2.2, -2.55, 0.57, true],
    [3.16, -2.77, 0.55, true],
    [4.36, -2.85, 0.65, true],
  ])
    pine(m, x, h, z, size, snow);
  for (let i = 0; i < 10; i++)
    boulder(
      m,
      3.75 + i * 0.059,
      h,
      between(-1.18, -1.08),
      between(0.14, 0.23),
      between(0.08, 0.16),
      between(0.12, 0.22),
      i % 2 ? C.shale : C.rock,
    );
  fence(
    m,
    [
      [4.04, h + 0.014, -0.92],
      [4.26, h + 0.014, -0.79],
      [4.5, h + 0.014, -0.8],
    ],
    0.13,
  );
  for (const [x, z] of [
    [1.81, -1.5],
    [5.23, -1.72],
    [2.7, -0.99],
  ])
    flowers(m, x, h + 0.015, z, 9, 0.135);
}
function copperQuay(m) {
  const h = 0.322;
  isle(m, -3.49, 1.71, 2.46, 1.23, h, false, '#a3a06a');
  isle(m, -3.71, 1.39, 1.36, 0.62, 0.47, true);
  path(
    m,
    [
      [-4.92, 0.346, 2.1],
      [-4.38, 0.346, 2.26],
      [-3.75, 0.346, 2.3],
      [-3.11, 0.346, 2.23],
      [-2.48, 0.346, 2.27],
      [-1.96, 0.346, 2.06],
    ],
    0.182,
    '#c7b593',
  );
  path(
    m,
    [
      [-3.59, 0.346, 2.27],
      [-3.59, 0.346, 1.94],
    ],
    0.135,
  );
  for (let i = 0; i < 4; i++) m.box(-3.59, 0.336 + i * 0.034, 1.99 - i * 0.067, 0.22, 0.043, 0.077, C.stone);
  house(m, -3.72, 0.482, 1.33, 0.83, 0.44, 0.44, -0.1, { doorCenter: true, roof: '#a44c3b' });
  clockTower(m, -4.24, 0.475, 1.22);
  house(m, -3.01, 0.474, 1.28, 0.45, 0.32, 0.35, -0.1);
  house(m, -4.55, h + 0.012, 1.77, 0.51, 0.36, 0.35, 0.21, { roof: '#b66649' });
  house(m, -4.89, h + 0.012, 1.41, 0.42, 0.31, 0.33, -0.21);
  house(m, -5.17, h + 0.012, 1.89, 0.43, 0.3, 0.29, 0.32, { roof: '#ae6747' });
  house(m, -4.06, h + 0.012, 1.99, 0.45, 0.28, 0.3, -0.15, { awning: '#a5513b' });
  house(m, -3.19, h + 0.012, 1.93, 0.53, 0.32, 0.32, 0.095, { awning: '#789775' });
  house(m, -2.55, h + 0.012, 1.64, 0.46, 0.38, 0.32, -0.25, { roof: '#b96448' });
  house(m, -2.12, h + 0.012, 1.86, 0.4, 0.285, 0.29, -0.29, { awning: '#ae6b43' });
  house(m, -2.6, h + 0.012, 2.4, 0.59, 0.27, 0.29, 0.04, { doorCenter: true, roof: '#9e5942' });
  for (const [x, z, s] of [
    [-4.96, 1.16, 0.57],
    [-4.55, 1.0, 0.63],
    [-2.64, 1.08, 0.68],
    [-1.9, 1.59, 0.57],
    [-3.14, 0.96, 0.46],
    [-4.84, 2.13, 0.41],
  ])
    oak(m, x, h, z, s);
  wharfWall(m, -3.44, 0.04, 2.68, 1.6, 0.085);
  wharfWall(m, -2.4, 0.034, 2.55, 0.66, 0.27);
  wharfWall(m, -4.45, 0.034, 2.49, 0.67, -0.27);
  dock(m, -3.97, 2.83, 0.15, 0.36, 0.77);
  dock(m, -3.15, 2.91, -0.07, 0.28, 0.83);
  harborCrane(m, -3.78, 0.31, 2.54);
  house(m, -4.6, h + 0.012, 2.15, 0.36, 0.246, 0.26, 0.22, { roof: '#9d5642', chimney: false });
  marketStall(m, -4.28, h + 0.015, 2.34, 0.29);
  marketStall(m, -2.1, h + 0.015, 2.21, -0.22);
  rowingBoat(m, -4.3, 2.91, 0.21);
  for (const [x, z, s] of [
    [-4.21, 2.49, 0.1],
    [-4.32, 2.5, 0.103],
    [-3.84, 2.57, 0.115],
    [-3.13, 2.52, 0.115],
    [-2.84, 2.55, 0.09],
  ])
    crate(m, x, 0.31, z, s);
  m.rings(
    -3.57,
    2.55,
    [
      [0.303, 0.049, 0.048, C.oak],
      [0.327, 0.054, 0.054, C.ink],
      [0.411, 0.058, 0.056, C.timberLight],
      [0.43, 0.05, 0.05, C.ink],
    ],
    8,
  );
}
function windmillIsle(m) {
  const h = 0.298;
  isle(m, 3.41, 1.72, 2.42, 1.19, h, false, '#9da651');
  isle(m, 4.11, 1.43, 1.05, 0.6, 0.48, true);
  const mill = { x: 4.17, y: 0.492, z: 1.36, yaw: -0.26 };
  windTower(m, mill.x, mill.y, mill.z, mill.yaw);
  house(m, 4.87, h + 0.014, 1.53, 0.48, 0.29, 0.34, -0.23, { roof: '#996041' });
  house(m, 2.1, h + 0.012, 1.75, 0.51, 0.32, 0.35, 0.22, { roof: '#a2573d' });
  house(m, 3.3, h + 0.012, 2.48, 0.46, 0.25, 0.3, -0.19, { roof: '#b46647' });
  path(
    m,
    [
      [1.82, 0.325, 2.01],
      [2.2, 0.325, 2.06],
      [2.72, 0.325, 2.28],
      [3.22, 0.325, 2.29],
      [3.83, 0.325, 2.22],
      [4.27, 0.325, 1.96],
      [4.8, 0.325, 1.91],
    ],
    0.118,
  );
  for (let i = 0; i < 4; i++) m.box(4.1, 0.31 + i * 0.042, 1.99 - i * 0.064, 0.158, 0.05, 0.065, C.stone);
  field(m, 2.8, h + 0.019, 1.55, 0.82, 0.68, 0.14);
  field(m, 3.5, h + 0.022, 1.94, 0.57, 0.41, 0.06);
  field(m, 4.55, h + 0.018, 2.29, 0.82, 0.43, -0.13);
  field(m, 2.5, h + 0.018, 2.28, 0.62, 0.33, 0.23);
  for (const [x, z, size] of [
    [1.78, 1.44, 0.7],
    [2.13, 1.13, 0.79],
    [2.57, 0.98, 0.65],
    [5.21, 1.85, 0.72],
    [5.25, 1.44, 0.67],
    [4.94, 2.13, 0.47],
    [1.78, 1.87, 0.49],
    [3.33, 0.91, 0.63],
    [4.71, 1.07, 0.61],
  ])
    oak(m, x, h, z, size);
  fence(
    m,
    [
      [2.28, h + 0.018, 1.3],
      [2.35, h + 0.018, 1.61],
      [2.39, h + 0.018, 1.9],
      [2.68, h + 0.018, 1.96],
      [2.98, h + 0.018, 1.98],
    ],
    0.12,
  );
  fence(
    m,
    [
      [4.05, h + 0.018, 2.46],
      [4.34, h + 0.018, 2.49],
      [4.63, h + 0.018, 2.5],
      [4.91, h + 0.018, 2.48],
    ],
    0.13,
  );
  for (const [x, z] of [
    [1.8, 1.96],
    [2.92, 2.49],
    [4.71, 1.94],
    [5.08, 1.76],
    [3.93, 1.75],
  ])
    flowers(m, x, h + 0.021, z, 15, 0.15);
  return mill;
}
export function buildWorld(THREE, group, map) {
  seed = map?.id === 'skyrail' ? 0xc0457a32 : map?.id === 'saffron' ? 0x7d3c012e : 0x145e73af;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const colours = new Map(),
    make = () => new Model(THREE, material, colours);
  if (map?.id === 'skyrail' || map?.id === 'saffron') {
    return buildDistrictWorld(THREE, group, map, {
      make,
      house,
      oak,
      pine,
      boulder,
      crate,
      field,
      marketStall,
      clockTower,
      rand,
      between,
    });
  }
  let mill, farm;
  const islands = [
    ['灯塔湾', lighthouseBay, -3.49, -1.85, 1.1, 1.13],
    ['蓝礁港', blueReef, 3.14, -1.83, 1.08, 1.13],
    ['铜帆埠', copperQuay, -3.49, 1.71, 1.09, 1.12],
    ['风车原', windmillIsle, 3.41, 1.72, 1.1, 1.16],
  ];
  for (const [name, draw, cx, cz, sx, sz] of islands) {
    const island = new THREE.Group();
    island.position.set(cx * (1 - sx), 0, cz * (1 - sz));
    island.scale.set(sx, 1, sz);
    const part = make(),
      place = draw(part);
    if (place) {
      mill = place;
      farm = island;
    }
    island.name = name + '场景';
    island.add(part.mesh(name));
    group.add(island);
  }
  const coast = make();
  for (const [x, z, s] of [
    [-6.05, -2.62, 0.41],
    [-5.74, -0.77, 0.34],
    [-1.12, -2.58, 0.37],
    [0.05, -1.66, 0.25],
    [1.15, -2.87, 0.34],
    [5.79, -2.86, 0.3],
    [-5.94, 2.46, 0.32],
    [-1.02, 2.49, 0.36],
    [0.82, 2.76, 0.27],
    [5.82, 2.46, 0.35],
    [0.4, 0.32, 0.29],
  ]) {
    boulder(coast, x, -0.056, z, s, s * 0.56, s * 0.72, C.shale);
    boulder(coast, x + s * 0.54, -0.047, z + s * 0.11, s * 0.45, s * 0.32, s * 0.42, C.rock);
    ripple(coast, x, z + s * 0.4, s * 0.95, 0.035, -0.15);
    ripple(coast, x - s * 0.36, z - s * 0.31, s * 0.41, 0.025, -0.18);
  }
  for (const [x, z] of [
    [-0.6, -0.85],
    [0.68, -1.62],
    [0.43, -2.87],
    [-0.38, 2.82],
    [0.69, 2.01],
    [-1.41, 0.24],
    [-2.95, 0.12],
    [-4.03, 0.22],
    [1.68, 0.11],
    [3.28, 0.11],
    [5.23, 0.18],
    [5.78, -3.12],
    [-5.66, -3.09],
  ]) {
    for (let i = 0; i < 3; i++)
      ripple(
        coast,
        x + between(-0.17, 0.17),
        z + i * 0.077,
        between(0.13, 0.32),
        between(0.013, 0.021),
        between(-0.12, 0.12),
        i % 2 ? C.water : '#76b8b0',
      );
  }
  group.add(coast.mesh('群岛浅礁'));
  const wheel = make();
  blades(wheel);
  const rotor = wheel.mesh('风车叶轮'),
    hub = new THREE.Group(),
    [dx, dz] = rotationY(0, 0.332, mill.yaw);
  hub.position.set(mill.x + dx, mill.y + 0.949, mill.z + dz);
  hub.rotation.y = mill.yaw;
  hub.add(rotor);
  farm.add(hub);
  const boats = [];
  for (const [x, z, size, yaw, tone] of [
    [-0.39, -1.66, 0.7, -1.04, '#d8b37a'],
    [-0.35, 1.58, 0.69, 0.84, '#d0b48b'],
    [-3.48, 3.22, 0.54, -0.27, '#bc7c58'],
    [0.85, -0.36, 0.43, -1.19, '#e7cc9a'],
  ]) {
    const boat = make();
    vessel(boat, size, tone, '#bc5943');
    const mesh = boat.mesh('帆船');
    mesh.position.set(x, 0.047, z);
    mesh.rotation.y = yaw;
    group.add(mesh);
    boats.push({ mesh, yaw, phase: rand() * TAU, x, z });
  }
  return (elapsed) => {
    rotor.rotation.z = elapsed * 0.43;
    for (const { mesh, yaw, phase, x, z } of boats) {
      const t = elapsed * 0.76 + phase;
      mesh.position.set(
        x + 0.014 * Math.cos(t * 0.68),
        0.047 + 0.012 * Math.sin(t),
        z + 0.014 * Math.sin(t * 0.61),
      );
      mesh.rotation.set(0.017 * Math.sin(t), yaw + 0.021 * Math.sin(t * 0.43), 0.032 * Math.cos(t));
    }
  };
}
