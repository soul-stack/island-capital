import * as THREE from './vendor/three.module.js';
import { palette } from './art.mjs';

// Merge street furniture by material. A per-triangle title ID makes the roof,
// front gate and curb selectable without a separate draw call for each plot.
class Batch {
  constructor() {
    this.vertices = [];
    this.colors = [];
    this.ids = [];
    this.inks = new Map();
    this.id = -1;
  }
  tri(a, b, c, paint) {
    let ink = this.inks.get(paint);
    if (!ink) {
      ink = new THREE.Color(paint);
      this.inks.set(paint, ink);
    }
    this.vertices.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.colors.push(ink.r, ink.g, ink.b);
    this.ids.push(this.id);
  }
  quad(a, b, c, d, ink) {
    this.tri(a, b, c, ink);
    this.tri(a, c, d, ink);
  }
  mesh(material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.titleIds = this.ids;
    return mesh;
  }
}
function localLot(lot, b, scaleX = 1, scaleZ = 1) {
  const { center: c, front: f } = lot;
  const p = (x, y, z) => [
    c.x + x * scaleX * f.z + z * scaleZ * f.x,
    c.y + y,
    c.z - x * scaleX * f.x + z * scaleZ * f.z,
  ];
  function box(x, y, z, w, h, d, color, roof = color) {
    const low = [
      p(x - w / 2, y, z - d / 2),
      p(x + w / 2, y, z - d / 2),
      p(x + w / 2, y, z + d / 2),
      p(x - w / 2, y, z + d / 2),
    ];
    const top = low.map(([a, v, z]) => [a, v + h, z]);
    b.quad(top[0], top[3], top[2], top[1], roof);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      b.quad(low[i], top[i], top[j], low[j], color);
    }
  }
  return { p, box };
}
function strip(b, a, c, w, ink, raise = 0) {
  const length = Math.hypot(c.x - a.x, c.z - a.z);
  if (!length) return;
  const sx = (((c.z - a.z) / length) * w) / 2,
    sz = ((-(c.x - a.x) / length) * w) / 2;
  b.quad(
    [a.x - sx, a.y + raise, a.z - sz],
    [a.x + sx, a.y + raise, a.z + sz],
    [c.x + sx, c.y + raise, c.z + sz],
    [c.x - sx, c.y + raise, c.z - sz],
    ink,
  );
}
function disk(b, p, r, height, top, side, sides = 16) {
  const ring = Array.from({ length: sides }, (_, i) => [
    p.x + r * Math.cos((i * Math.PI * 2) / sides),
    p.y,
    p.z + r * Math.sin((i * Math.PI * 2) / sides),
  ]);
  ring.forEach((a, i) => {
    const c = ring[(i + 1) % sides],
      u = [a[0], a[1] + height, a[2]],
      v = [c[0], c[1] + height, c[2]];
    b.quad(a, u, v, c, side);
    b.tri([p.x, p.y + height, p.z], v, u, top);
  });
}
const terrain = {
  mistport: {
    paving: '#9c8a6d',
    kerb: '#dde3c1',
    edge: '#365e63',
    side: '#8a7458',
    grass: '#97ae88',
    back: '#84a29b',
    roof: '#ab6550',
    plaster: '#ddd7b8',
    ink: '#537c82',
  },
  skyrail: {
    paving: '#778987',
    kerb: '#c7cec2',
    edge: '#485e62',
    side: '#918c78',
    grass: '#a4ae88',
    back: '#92a59b',
    roof: '#9e5c48',
    plaster: '#e4ceb0',
    ink: '#486f77',
  },
  saffron: {
    paving: '#b39577',
    kerb: '#e2c7a4',
    edge: '#8c695a',
    side: '#ab8259',
    grass: '#c5ae81',
    back: '#b99572',
    roof: '#a9694c',
    plaster: '#eac999',
    ink: '#548f8c',
  },
};
const special = { start: '启', chance: '?', bonus: '奖', tax: '税', shop: '铺', delay: '停', bank: '银' };
function streetSurface(b, map) {
  const ink = terrain[map.id];
  map.next.forEach((exits, id) =>
    exits.forEach((to) => {
      const a = map.points[id],
        z = map.points[to],
        dx = z.x - a.x,
        dz = z.z - a.z;
      const branch = to >= map.mainCount || id >= map.mainCount;
      const p = (t, l, h) => [a.x + t * dx - l * dz, a.y + (z.y - a.y) * t + h, a.z + t * dz + l * dx];
      for (let part = 0; part < 2; part++) {
        b.id = part === 0 ? id : to;
        const s = part / 2,
          e = (part + 1) / 2;
        b.quad(
          p(s, -0.204, -0.025),
          p(s, 0.204, -0.025),
          p(e, 0.204, -0.025),
          p(e, -0.204, -0.025),
          ink.paving,
        );
        for (const k of [-1, 1]) {
          b.quad(
            p(s, 0.204 * k, -0.022),
            p(e, 0.204 * k, -0.022),
            p(e, 0.177 * k, -0.022),
            p(s, 0.177 * k, -0.022),
            branch ? '#d4a657' : ink.kerb,
          );
          b.quad(
            p(s, 0.205 * k, -0.023),
            p(s, 0.205 * k, -0.106),
            p(e, 0.205 * k, -0.106),
            p(e, 0.205 * k, -0.023),
            ink.edge,
          );
        }
        if (map.id === 'mistport')
          for (let t = s + 0.04; t < e; t += 0.11)
            b.quad(
              p(t, -0.17, -0.023),
              p(t + 0.008, -0.17, -0.023),
              p(t + 0.008, 0.17, -0.023),
              p(t, 0.17, -0.023),
              '#7d6f5d',
            );
      }
      b.id = to;
      const y = -0.015;
      b.quad(p(0.37, -0.027, y), p(0.37, 0.027, y), p(0.49, 0.027, y), p(0.49, -0.027, y), '#fff1bc');
      b.tri(p(0.47, -0.074, y), p(0.62, 0, y), p(0.47, 0.074, y), '#fff1bc');
    }),
  );
  map.tiles.forEach((t) => {
    b.id = t.id;
    const a = map.points[t.id],
      p = { ...a, y: a.y - 0.101 };
    disk(
      b,
      p,
      t.type === 'property' ? 0.181 : 0.244,
      0.101,
      t.type === 'bank' ? '#e8cf87' : ink.kerb,
      ink.edge,
    );
    if (map.id === 'mistport' || a.y > 0.35)
      disk(b, { ...a, y: 0.016 }, 0.124, a.y - 0.12, ink.side, ink.side, 6);
  });
}
function layPlot(b, lot, map) {
  b.id = lot.id;
  const node = map.points[lot.nodeId],
    ink = terrain[map.id],
    { box } = localLot(lot, b);
  const w = lot.width,
    d = lot.depth,
    quay = map.id === 'mistport';
  const base = map.id === 'saffron' ? '#c5a77e' : lot.kind === 'industry' ? '#96a2a0' : ink.grass;
  box(0, -0.12, 0, w, 0.12, d, ink.side, base);
  if (quay) {
    for (const x of [-w * 0.39, w * 0.39])
      for (const z of [-d * 0.36, d * 0.36]) {
        box(x, -lot.center.y + 0.01, z, 0.056, lot.center.y - 0.1, 0.056, '#746747');
        box(x, 0.001, z, 0.037, 0.041, 0.037, '#806d52');
      }
    for (let z = -d * 0.39; z < d * 0.4; z += 0.073) box(0, 0.001, z, w * 0.92, 0.004, 0.011, '#b3a681');
  }
  const band = quay ? '#c0b393' : map.id === 'saffron' ? '#d6b88d' : '#baa993';
  box(0, 0.001, -d / 2 + 0.013, w, 0.042, 0.026, band);
  for (const sign of [-1, 1]) {
    box(sign * (w / 2 - 0.014), 0.001, 0, 0.03, 0.038, d, band);
    box((sign * (w + 0.145)) / 4, 0.001, d / 2 - 0.01, (w - 0.145) / 2, 0.046, 0.028, band);
    for (const end of [-1, 1])
      box(sign * (w / 2 - 0.02), 0.001, end * (d / 2 - 0.02), 0.041, 0.067, 0.041, ink.side, band);
  }
  const gate = lot.entrance;
  const start = {
    x: node.x + (gate.x - node.x) * 0.5,
    y: node.y - 0.008,
    z: node.z + (gate.z - node.z) * 0.5,
  };
  strip(
    b,
    start,
    { ...gate, y: gate.y + 0.003 },
    0.138,
    quay ? '#c7ad7b' : map.id === 'saffron' ? '#e2c9a1' : '#d4cab5',
  );
  if (map.id === 'skyrail')
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a = {
        x: start.x + (gate.x - start.x) * t,
        y: start.y + (gate.y - start.y) * t + 0.004,
        z: start.z + (gate.z - start.z) * t,
      };
      const end = { ...a, x: a.x + lot.front.x * 0.014, z: a.z + lot.front.z * 0.014 };
      strip(b, a, end, 0.137, '#958e7f');
    }
}
function roof(b, p, x, y, z, w, d, rise, shade) {
  const l = x - w / 2,
    r = x + w / 2,
    back = z - d / 2,
    front = z + d / 2;
  b.quad(p(l, y, front), p(r, y, front), p(r, y + rise, z), p(l, y + rise, z), shade);
  b.quad(p(l, y + rise, z), p(r, y + rise, z), p(r, y, back), p(l, y, back), shade);
  b.tri(p(l, y, back), p(l, y, front), p(l, y + rise, z), '#dcc7a2');
  b.tri(p(r, y, front), p(r, y, back), p(r, y + rise, z), '#bdab8e');
}
function develop(b, lot, map, deed, ownerColor) {
  b.id = lot.id;
  const { p, box } = localLot(lot, b, Math.min(1, lot.width / 0.6), Math.min(1, lot.depth / 0.43)),
    ink = terrain[map.id],
    desert = map.id === 'saffron';
  if (lot.kind === 'bank') {
    box(0, 0.006, -0.041, 0.45, 0.036, 0.27, '#ae9b77');
    box(0, 0.042, -0.066, 0.36, 0.195, 0.169, '#e6d9b7');
    box(0, 0.1, 0.027, 0.064, 0.105, 0.01, '#4e6e6c');
    for (const x of [-0.168, -0.058, 0.058, 0.168]) box(x, 0.042, 0.061, 0.026, 0.164, 0.026, '#e6dfc5');
    box(0, 0.204, 0.02, 0.428, 0.037, 0.142, '#b69b6a');
    roof(b, p, 0, 0.241, -0.04, 0.454, 0.253, 0.075, desert ? '#5a948d' : '#657c78');
    return;
  }
  if (!deed) {
    const t = lot.kind === 'industry' ? '#85938c' : desert ? '#c29d6f' : '#9f9e7b';
    box(-0.02, 0.005, -0.035, 0.33, 0.02, 0.18, t);
    for (const side of [-1, 1]) box(side * 0.162 - 0.02, 0.021, -0.035, 0.012, 0.009, 0.18, '#ddd1a8');
    box(-0.02, 0.021, -0.12, 0.332, 0.009, 0.012, '#ddd1a8');
    if (lot.kind === 'industry') {
      box(-0.115, 0.027, -0.082, 0.09, 0.054, 0.064, '#a78456');
      box(-0.029, 0.027, -0.075, 0.061, 0.035, 0.054, '#ba9d68');
    } else if (lot.kind === 'shop') {
      box(0.082, 0.026, -0.096, 0.099, 0.03, 0.032, '#9e7b56');
    }
    box(0.19, 0.009, 0.05, 0.017, 0.102, 0.019, '#7a7257');
    box(0.19, 0.095, 0.05, 0.09, 0.046, 0.018, '#ddcc97');
    return;
  }
  const level = deed.level,
    w = lot.kind === 'industry' ? 0.42 : lot.kind === 'shop' ? 0.38 : 0.32;
  const d = 0.239,
    z = -0.043,
    side = level === 3 ? '#ddd6ba' : ink.plaster;
  const floor = lot.kind === 'industry' ? 0.086 : 0.103,
    h = 0.056 + floor * level;
  box(-0.018, 0.006, z, w + 0.024, 0.032, d + 0.026, ink.side);
  box(-0.018, 0.037, z, w, h, d, side);
  const top = 0.037 + h;
  for (let i = 1; i < level; i++) box(-0.018, 0.067 + floor * i, z, w + 0.016, 0.013, d + 0.013, ink.side);
  if (desert || lot.kind === 'shop') {
    box(-0.018, top, z, w + 0.031, 0.029, d + 0.035, desert ? '#b48a5f' : ink.roof);
    if (level > 1) {
      box(-0.057, top + 0.029, z - 0.018, w * 0.54, 0.063, d * 0.58, side);
      box(-0.057, top + 0.092, z - 0.018, w * 0.58, 0.02, d * 0.61, ink.ink);
    }
  } else
    roof(
      b,
      p,
      -0.018,
      top,
      z,
      w + 0.048,
      d + 0.033,
      lot.kind === 'industry' ? 0.049 : 0.095,
      level === 3 ? ink.ink : ink.roof,
    );
  const f = z + d / 2 + 0.004;
  box(-0.018, 0.038, f, 0.064, 0.099, 0.016, '#5a6761');
  box(-0.018, 0.039, f + 0.012, 0.021, 0.07, 0.01, '#9aa99a');
  for (let n = 0; n < level; n++)
    for (const k of [-1, 1])
      box(-0.018 + k * w * 0.31, 0.075 + n * floor, f, w * 0.14, 0.043, 0.018, '#55797b');
  if (lot.kind === 'shop') {
    const nw = w * 0.85;
    for (let i = 0; i < 6; i++) {
      const x = -0.018 - nw / 2 + (nw * (i + 0.5)) / 6;
      box(x, 0.141, f + 0.045, nw / 6, 0.02, 0.091, i % 2 ? '#f0dcac' : desert ? '#ba7154' : ink.ink);
    }
    for (const k of [-1, 1]) box(-0.018 + k * w * 0.38, 0.003, f + 0.079, 0.013, 0.139, 0.013, ink.side);
  } else if (lot.kind === 'industry') {
    box(0.105, top, z - 0.04, 0.054, 0.096 + 0.041 * (level - 1), 0.06, '#8e7463');
    box(0.105, top + 0.09 + 0.041 * (level - 1), z - 0.04, 0.069, 0.024, 0.074, '#625f5a');
  } else if (level === 3) {
    box(-0.128, top + 0.03, z - 0.052, 0.041, 0.105, 0.037, ink.side);
  }
  // The owner's pennant and storey ticks sit inside the front boundary.
  const flagX = -lot.width * 0.38,
    flagZ = lot.depth * 0.29;
  box(flagX, 0.004, flagZ, 0.017, 0.18, 0.017, '#6a6757');
  b.tri(p(flagX, 0.18, flagZ), p(flagX + 0.1, 0.156, flagZ), p(flagX, 0.129, flagZ), ownerColor);
  box(flagX + 0.018, 0.015, flagZ, 0.08, 0.025, 0.055, ownerColor);
  for (let i = 0; i < level; i++) box(flagX - 0.008 + i * 0.022, 0.04, flagZ, 0.012, 0.008, 0.043, '#f7e6b4');
}
function signage(map) {
  const cols = 12,
    size = 128,
    entries = map.tiles.length * 2,
    rows = Math.ceil(entries / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * size;
  sheet.height = rows * size;
  const ctx = sheet.getContext('2d'),
    verts = [],
    uv = [],
    idx = [],
    pick = [],
    plates = [];
  function face(n, id, c, w, d, y, front) {
    const right = front ? { x: front.z, z: -front.x } : { x: 1, z: 0 };
    const down = front || { x: 0, z: 1 };
    const pts = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    plates.push({ offset: verts.length / 3, c, w, d, y, lot: n % 2 ? map.frontages[id] : null });
    for (const [a, b] of pts)
      verts.push(
        c.x + (right.x * a * w) / 2 + (down.x * b * d) / 2,
        y,
        c.z + (right.z * a * w) / 2 + (down.z * b * d) / 2,
      );
    const x = (n % cols) * size,
      z = Math.floor(n / cols) * size;
    const u = (x + 0.5) / sheet.width,
      v = 1 - (z + size - 0.5) / sheet.height,
      U = (x + size - 0.5) / sheet.width,
      V = 1 - (z + 0.5) / sheet.height;
    uv.push(u, v, U, v, U, V, u, V);
    const i = verts.length / 3 - 4;
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    pick.push(id, id);
    ctx.setTransform(1, 0, 0, 1, x, z);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  for (const t of map.tiles) {
    const p = map.points[t.id],
      l = map.frontages[t.id],
      n = t.id * 2;
    const property = t.type === 'property',
      fork = map.next[t.id].length > 1;
    const diameter = property ? 0.33 : 0.44;
    face(n, t.id, p, diameter, diameter, p.y + 0.008);
    ctx.fillStyle = property ? '#eff0d7' : t.type === 'bank' ? '#f1cf82' : fork ? '#e8b877' : '#c5d7c3';
    ctx.beginPath();
    ctx.arc(64, 64, 61, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#526965';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#344b48';
    ctx.font = 'bold ' + (property ? '62' : '44') + 'px monospace';
    if (property) ctx.fillText(String(t.id).padStart(2, '0'), 64, 67);
    else {
      ctx.font = 'bold 59px "Microsoft YaHei",sans-serif';
      ctx.fillText(special[t.type] || '◆', 64, 51);
      ctx.font = 'bold 28px monospace';
      ctx.fillText(String(t.id).padStart(2, '0'), 64, 96);
    }
    if (!l) continue;
    const f = l.front,
      c = { x: l.center.x + f.x * (l.depth * 0.29), z: l.center.z + f.z * (l.depth * 0.29) };
    // Orient names toward the closest board-reading direction, including east/west plots.
    const axis = Math.abs(f.x) > 0.5 ? { x: 1, z: 0 } : null;
    face(n + 1, t.id, c, l.width * 0.53, 0.085, l.center.y + 0.02, axis);
    ctx.fillStyle = '#3f514a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = map.districts[t.district].color;
    ctx.fillRect(0, 0, 9, 128);
    ctx.save();
    ctx.scale(1, 3.3);
    ctx.font = 'bold 31px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#faf0d3';
    ctx.fillText(t.short, 66, 19, 114);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(sheet);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.25, side: THREE.DoubleSide }),
  );
  mesh.userData.titleIds = pick;
  const positions = g.getAttribute('position');
  positions.setUsage(THREE.DynamicDrawUsage);
  let lastYaw = Infinity;
  mesh.userData.orient = (yaw) => {
    if (Math.abs(yaw - lastYaw) < 0.004) return;
    lastYaw = yaw;
    const sin = Math.sin(yaw),
      cos = Math.cos(yaw);
    for (const { offset, c, w, d, y, lot } of plates) {
      let x = c.x,
        z = c.z;
      if (lot) {
        const f = lot.front;
        const extent = (w * Math.abs(cos * f.x - sin * f.z) + d * Math.abs(sin * f.x + cos * f.z)) / 2;
        const depth = Math.min(lot.depth * 0.29, lot.depth / 2 - extent - 0.012);
        x = lot.center.x + depth * f.x;
        z = lot.center.z + depth * f.z;
      }
      const a = w / 2,
        b = d / 2;
      positions.setXYZ(offset, x - a * cos + b * sin, y, z + a * sin + b * cos);
      positions.setXYZ(offset + 1, x + a * cos + b * sin, y, z - a * sin + b * cos);
      positions.setXYZ(offset + 2, x + a * cos - b * sin, y, z - a * sin - b * cos);
      positions.setXYZ(offset + 3, x - a * cos - b * sin, y, z + a * sin - b * cos);
    }
    positions.needsUpdate = true;
  };
  return mesh;
}

export function buildFrontage(board, map) {
  const solid = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const staticBatch = new Batch();
  streetSurface(staticBatch, map);
  for (const lot of map.frontages) if (lot) layPlot(staticBatch, lot, map);
  const base = staticBatch.mesh(solid);
  base.receiveShadow = true;
  base.castShadow = true;
  const labels = signage(map),
    models = new THREE.Mesh(new THREE.BufferGeometry(), solid);
  models.receiveShadow = true;
  models.castShadow = true;
  const marks = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marks.renderOrder = 6;
  board.add(base, models, labels, marks);
  let lastMark = '';
  function update(state) {
    const b = new Batch();
    for (const lot of map.frontages)
      if (lot) {
        const deed = state?.properties[lot.id],
          i = deed ? state.players.findIndex((p) => p.id === deed.owner) : -1;
        develop(b, lot, map, deed, palette[i % palette.length] || '#f2ce81');
      }
    for (const [id, mark] of Object.entries(state?.cardBoard?.marks || {})) {
      const node = map.points[id];
      if (!node || state.round >= mark.until) continue;
      b.id = Number(id);
      const dest = map.points[map.next[id][0]],
        dx = dest.x - node.x,
        dz = dest.z - node.z;
      const { box, p } = localLot(
        {
          center: { x: node.x + dx * 0.19, y: node.y + 0.012, z: node.z + dz * 0.19 },
          front: { x: dx, z: dz },
        },
        b,
      );
      if (mark.kind === 'barrier') {
        for (const a of [-0.156, 0.156]) box(a, 0, 0, 0.034, 0.133, 0.046, '#374742');
        for (let j = 0; j < 6; j++)
          box(-0.145 + j * 0.058, 0.088, 0, 0.059, 0.058, 0.031, j % 2 ? '#f0da91' : '#bd6555');
      } else if (mark.kind === 'bondgate') {
        for (const x of [-0.158, 0.158]) box(x, 0, 0, 0.038, 0.18, 0.054, '#876440');
        box(0, 0.161, 0, 0.367, 0.052, 0.045, '#d3a95d');
        box(0, 0.141, 0.025, 0.091, 0.093, 0.023, '#f0cd7a');
        b.quad(p(-0.028, 0.186, 0.05), p(0, 0.22, 0.05), p(0.028, 0.186, 0.05), p(0, 0.152, 0.05), '#916e36');
      } else if (mark.kind === 'redirector') {
        // Stacked spring coils support a bent return arrow.
        box(-0.113, 0, 0, 0.074, 0.024, 0.076, '#786887');
        for (let i = 0; i < 3; i++) box(-0.113, 0.032 + i * 0.028, 0, 0.1, 0.014, 0.065, '#ad95bd');
        box(-0.113, 0.016, 0, 0.025, 0.128, 0.034, '#716078');
        box(-0.076, 0.121, 0.009, 0.092, 0.027, 0.035, '#ab87be');
        box(-0.038, 0.122, 0.009, 0.026, 0.087, 0.035, '#ab87be');
        box(-0.097, 0.186, 0.009, 0.14, 0.028, 0.035, '#cfabe1');
        b.tri(p(-0.198, 0.201, 0.034), p(-0.152, 0.233, 0.034), p(-0.152, 0.169, 0.034), '#ecd1f0');
      } else if (mark.kind === 'shuttle') {
        // A long hull, raised cabin and a contrasting prow read from either road direction.
        box(-0.064, 0.014, 0, 0.207, 0.054, 0.099, '#42899b');
        b.tri(p(0.039, 0.016, -0.048), p(0.102, 0.069, 0), p(0.039, 0.016, 0.048), '#488d9c');
        box(-0.073, 0.068, 0, 0.119, 0.072, 0.075, '#e8dfbc');
        for (const x of [-0.102, -0.051]) box(x, 0.087, 0.039, 0.029, 0.029, 0.009, '#4c8997');
        box(-0.073, 0.14, 0, 0.137, 0.016, 0.088, '#77bfbd');
      } else {
        const tone = { toll: '#e2b951', slip: '#70c3d8', stop: '#d07a72' }[mark.kind] || '#c4c2a4';
        box(-0.127, 0.005, 0, 0.025, 0.155, 0.032, '#515d52');
        box(-0.127, 0.132, 0, 0.138, 0.091, 0.036, tone);
        if (mark.kind === 'stop') box(-0.127, 0.164, 0.018, 0.082, 0.016, 0.008, '#f5e7cf');
        else if (mark.kind === 'toll') box(-0.127, 0.145, 0.018, 0.023, 0.055, 0.008, '#715e39');
        else box(-0.127, 0.151, 0.018, 0.064, 0.021, 0.008, '#3c7786');
      }
    }
    const next = b.mesh(solid);
    models.geometry.dispose();
    models.geometry = next.geometry;
    models.userData.titleIds = b.ids;
  }
  function highlight(selected, legal = [], affected = [], choices = []) {
    const key = JSON.stringify([selected, legal, affected, choices]);
    if (lastMark === key) return;
    lastMark = key;
    const b = new Batch(),
      colors = new Map();
    for (const [ids, ink] of [
      [legal, '#63ead6'],
      [affected, '#f4a567'],
      [choices, '#43e0cf'],
      [[selected], '#ffdc7b'],
    ]) {
      for (const id of ids || []) if (Number.isInteger(id) && map.points[id]) colors.set(id, ink);
    }
    for (const [id, ink] of colors) {
      const p = map.points[id],
        l = map.frontages[id],
        r = 0.254;
      const ring = Array.from({ length: 18 }, (_, i) => ({
        x: p.x + r * Math.cos((i * Math.PI) / 9),
        z: p.z + r * Math.sin((i * Math.PI) / 9),
        y: p.y + 0.023,
      }));
      ring.forEach((a, j) => strip(b, a, ring[(j + 1) % ring.length], 0.043, ink));
      if (l) {
        strip(b, p, l.entrance, 0.05, ink, 0.035);
        l.corners.forEach((a, j) => strip(b, a, l.corners[(j + 1) % 4], 0.038, ink, 0.05));
      }
    }
    const next = b.mesh(marks.material);
    marks.geometry.dispose();
    marks.geometry = next.geometry;
  }
  return { update, highlight, orient: labels.userData.orient, pickables: [labels, models, base] };
}
