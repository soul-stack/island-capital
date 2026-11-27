import { buildSkyrail } from './skyrail-world.mjs';
import { buildSaffron } from './saffron-world.mjs';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (n) => {
  const t = clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};
export const tau = Math.PI * 2;
export const pick = (a, i) => a[((i % a.length) + a.length) % a.length];
export function dome(m, x, y, z, r, h, colors) {
  m.rings(
    x,
    z,
    [
      [y, r * 1.06, r * 1.06, colors[0]],
      [y + 0.043, r * 1.06, r * 1.06, colors[0]],
      [y + 0.054, r, r, colors[1]],
      [y + h * 0.36, r * 0.98, r * 0.98, colors[1]],
      [y + h * 0.67, r * 0.76, r * 0.76, colors[1]],
      [y + h * 0.87, r * 0.39, r * 0.39, colors[1]],
      [y + h, r * 0.1, r * 0.1, colors[1]],
      [y + h + 0.08, r * 0.027, r * 0.027, colors[0]],
    ],
    12,
  );
}

// A masonry arch with a real opening and individually cut voussoirs.
export function arch(m, x, y, z, w, h, d, post, tone, key) {
  const r = (w - 2 * post) / 2,
    spring = h - r - post * 0.75,
    n = 9;
  for (const side of [-1, 1]) m.box(x + side * (r + post / 2), y, z, post, Math.max(0.025, spring), d, tone);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const curve = (ang, radius, side) => [
      x + Math.cos(ang) * radius,
      y + spring + Math.sin(ang) * radius,
      z + (side * d) / 2,
    ];
    const face = i === 4 ? key : tone,
      t = i === 4 ? 1.055 : 0.945 + (i % 3) * 0.045;
    for (const side of [-1, 1])
      m.quad(
        curve(a, r, side),
        curve(b, r, side),
        curve(b, r + post, side),
        curve(a, r + post, side),
        face,
        t,
      );
    m.quad(curve(a, r, -1), curve(b, r, -1), curve(b, r, 1), curve(a, r, 1), tone, 0.82);
    m.quad(
      curve(a, r + post, 1),
      curve(b, r + post, 1),
      curve(b, r + post, -1),
      curve(a, r + post, -1),
      tone,
      t,
    );
  }
}
export function stairs(m, x, y, z, yaw, width, steps, rise, depth, tone) {
  m.at(x, y, z, yaw, () => {
    for (let i = 0; i < steps; i++) m.box(0, 0, -i * depth, width, (i + 1) * rise, depth * 1.08, tone);
  });
}
export function stripedCloth(m, x, y, z, w, d, h, tones) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const l = x - w / 2 + (i * w) / n,
      r = l + w / n,
      ink = tones[i % tones.length];
    m.quad(
      [l, y, z - d / 2],
      [r, y, z - d / 2],
      [r, y + h, z - d * 0.12],
      [l, y + h, z - d * 0.12],
      ink,
      0.95,
    );
    m.quad(
      [l, y + h, z - d * 0.12],
      [r, y + h, z - d * 0.12],
      [r, y - 0.014, z + d / 2],
      [l, y - 0.014, z + d / 2],
      ink,
    );
    m.quad(
      [l, y - 0.014, z + d / 2],
      [r, y - 0.014, z + d / 2],
      [r, y - 0.067, z + d / 2],
      [l, y - 0.067, z + d / 2],
      ink,
      0.91,
    );
  }
}

function channel(c, desert) {
  return desert
    ? 4.98 + 0.65 * Math.sin(c * 0.47 - 0.9) + 0.3 * Math.sin(c * 0.88)
    : 6.65 + 0.82 * Math.sin(c * 0.46 - 0.7) + 0.17 * Math.sin(c * 0.99);
}
function waterDistance(c, r, desert) {
  const river = Math.abs(r - channel(c, desert)) - (desert ? 0.39 : 0.46);
  if (!desert) return river;
  const pool = (Math.hypot((c - 11.32) / 1.46, (r - 7.32) / 0.84) - 1) * 0.84;
  const feeder = Math.max(Math.abs(c - 11.52) - 0.23, 5.15 - r, r - 7.32);
  return Math.min(river, pool, feeder);
}
const overlaps = (x, z, w, d, p) => Math.abs(x - p.x) < (w + p.w) / 2 && Math.abs(z - p.z) < (d + p.d) / 2;

function makeLayout(THREE, group, map, kit) {
  const desert = map.id === 'saffron',
    ox = (map.width - 1) / 2,
    oz = (map.depth - 1) / 2;
  const used = [],
    buildings = [],
    landmarks = [],
    animations = [],
    m = kit.make(),
    ground = kit.make(),
    props = kit.make();
  const X = (c) => c - ox,
    Z = (r) => r - oz,
    water = (c, r) => waterDistance(c, r, desert);
  const route = map.points.map((p) => ({ x: p.x + ox, z: p.z + oz, y: p.y, w: 0.82, d: 0.82 }));
  const parcels = (map.frontages || []).filter(Boolean).map(lot=>({
    x:lot.center.x+ox, z:lot.center.z+oz, y:lot.center.y,
    w:lot.front.x ? lot.depth : lot.width, d:lot.front.x ? lot.width : lot.depth
  }));
  function height(c, r) {
    const bank = water(c, r);
    if (bank <= -0.1) return 0.016;
    const grade = desert
      ? 0.2 + 0.13 * smooth((c - 7) / 9) * smooth((6 - r) / 4)
      : 0.21 + 0.58 * smooth((13 - c) / 11) * smooth((9 - r) / 8) + 0.12 * smooth((5 - r) / 4);
    const wrinkles =
      (desert ? 0.035 : 0.049) * (Math.sin(c * 1.57 + r * 0.72) + 0.45 * Math.sin(r * 2.29 - c * 0.61));
    let h = grade + wrinkles;
    for (const t of route) {
      const ds = Math.max(Math.abs(c - t.x), Math.abs(r - t.z));
      if (ds < 1.15) h = Math.min(h, t.y - 0.1 + Math.max(0, ds - 0.41) * 0.48);
    }
    for (const p of parcels) if (overlaps(c,r,.06,.06,p)) h=Math.min(h,p.y-.052);
    return 0.017 + (Math.max(0.13, h) - 0.017) * smooth((bank + 0.1) / 0.48);
  }
  function fits(c, r, w, d, { wet = false, pad = 0.045 } = {}) {
    if (
      c - w / 2 < -0.41 ||
      r - d / 2 < -0.41 ||
      c + w / 2 > map.width - 0.59 ||
      r + d / 2 > map.depth - 0.59
    )
      return false;
    if (route.some((t) => overlaps(c, r, w + pad, d + pad, t))) return false;
    if (parcels.some((t) => overlaps(c, r, w + pad, d + pad, t))) return false;
    if (used.some((t) => overlaps(c, r, w + 0.045, d + 0.045, t))) return false;
    if (!wet)
      for (const dx of [-w * 0.42, 0, w * 0.42])
        for (const dz of [-d * 0.42, 0, d * 0.42]) if (water(c + dx, r + dz) < 0.1) return false;
    return true;
  }
  function reserve(c, r, w, d) {
    used.push({ x: c, z: r, w, d });
  }
  function place(
    c,
    r,
    w,
    d,
    draw,
    {
      tone = desert ? '#bc9b66' : '#a9aa91',
      wet = false,
      label = '建筑',
      margin = 0.04,
      natural = false,
      focus,
    } = {},
  ) {
    if (!fits(c, r, w, d, { wet })) return false;
    reserve(c, r, w, d);
    const levels = [
      [0, 0],
      [-w * 0.45, -d * 0.45],
      [w * 0.45, -d * 0.45],
      [-w * 0.45, d * 0.45],
      [w * 0.45, d * 0.45],
    ].map(([a, b]) => height(c + a, r + b));
    const y = Math.max(...levels) + 0.021,
      low = Math.min(...levels) - 0.064;
    if (!natural) {
      m.box(X(c), low, Z(r), w, y - low, d, tone);
      m.box(X(c), y - 0.007, Z(r), w + margin, 0.023, d + margin, tone);
      const blocks = Math.max(2, Math.ceil(w / 0.21)),
        step = w / blocks;
      for (const side of [-1, 1])
        for (let i = 0; i < blocks; i++) {
          const x = X(c) - w / 2 + step * (i + 0.5),
            z = Z(r) + side * (d * 0.5 - 0.025);
          m.box(
            x,
            y + 0.017,
            z,
            step - 0.015,
            0.008,
            0.046,
            desert ? (i % 4 === 0 ? '#af865c' : '#dcc092') : i % 3 === 0 ? '#9b9f9c' : '#c3bcaa',
          );
        }
    }
    m.at(X(c), y + 0.016, Z(r), 0, () => draw(m, w, d));
    buildings.push({ c, r, w, d, label, natural });
    if (focus) landmarks.push({ name: label, x: X(c), z: Z(r), y: y + focus });
    return true;
  }
  function find(c, r, w, d, draw, options = {}) {
    const radius = options.radius ?? 1.05,
      offsets = [[0, 0]];
    for (let x = -radius; x <= radius + 0.001; x += 0.26)
      for (let y = -radius; y <= radius + 0.001; y += 0.26) offsets.push([x, y]);
    offsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    for (const [x, y] of offsets) if (place(c + x, r + y, w, d, draw, options)) return [c + x, r + y];
    return null;
  }
  function mobile(name, draw, x, y, z, update) {
    const model = kit.make();
    draw(model);
    const mesh = model.mesh(name);
    mesh.position.set(x, y, z);
    group.add(mesh);
    animations.push((t) => update(mesh, t));
    return mesh;
  }
  function faceStreet(c, r) {
    let closest = route[0],
      distance = Infinity;
    for (const t of route) {
      const d = (c - t.x) ** 2 + (r - t.z) ** 2;
      if (d < distance) {
        closest = t;
        distance = d;
      }
    }
    return (Math.round(Math.atan2(closest.x - c, closest.z - r) / (Math.PI / 2)) * Math.PI) / 2;
  }
  return {
    THREE,
    group,
    map,
    kit,
    m,
    ground,
    props,
    used,
    buildings,
    landmarks,
    animations,
    route,
    X,
    Z,
    height,
    water,
    desert,
    fits,
    reserve,
    place,
    find,
    mobile,
    faceStreet,
    channel: (c) => channel(c, desert),
  };
}

function landform(ctx) {
  const { map, ground: g, desert, X, Z, height, water, channel, kit } = ctx,
    step = 0.21;
  const col = desert
    ? ['#e3b77e', '#cc9864', '#dba874', '#ecc18a']
    : ['#8b9c89', '#97a991', '#adb1a2', '#b7ad97'];
  const shades = desert ? ['#c89669', '#c48c5f'] : ['#94a79a', '#83a399'];
  const nx = Math.ceil(map.width / step),
    nz = Math.ceil(map.depth / step),
    grid = [];
  function vertex(i, j) {
    return [(i * map.width) / nx - map.width / 2, 0, (j * map.depth) / nz - map.depth / 2];
  }
  const cx = (map.width - 1) / 2,
    rz = (map.depth - 1) / 2;
  for (let j = 0; j <= nz; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const p = vertex(i, j);
      p[1] = height(p[0] + cx, p[2] + rz);
      row.push(p);
    }
    grid.push(row);
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const [x, , z] = grid[j][i],
        c = x + cx + 0.18,
        r = z + rz + 0.18,
        d = water(c, r);
      const zone =
        Math.floor(c / 3.9 + 0.21 * Math.sin(r * 1.8)) + Math.floor(r / 3.1 + 0.14 * Math.cos(c * 1.5)) * 2;
      let tone = d < 0.18 ? shades[(i + j) % 2] : pick(col, zone);
      if (!desert && d > 0.2) {
        if (c < 3.8 && r < 3) tone = '#7a916e';
        if (c > 6 && c < 10 && r > 2 && r < 6) tone = '#a5aca5';
        if (c > 3.4 && c < 6.8 && r > 8.1 && r < 9.9) tone = '#83a075';
      }
      const a = grid[j][i],
        b = grid[j][i + 1],
        p = grid[j + 1][i],
        q = grid[j + 1][i + 1];
      g.tri(a, p, b, tone, kit.between(0.972, 1.031));
      g.tri(b, p, q, tone, kit.between(0.969, 1.031));
    }
  for (const r of [0, nz])
    for (let i = 0; i < nx; i++) {
      const a = grid[r][i],
        b = grid[r][i + 1];
      g.quad(a, b, [b[0], 0.009, b[2]], [a[0], 0.009, a[2]], desert ? '#b88055' : '#78857a');
    }
  for (const c of [0, nx])
    for (let j = 0; j < nz; j++) {
      const a = grid[j][c],
        b = grid[j + 1][c];
      g.quad(a, b, [b[0], 0.009, b[2]], [a[0], 0.009, a[2]], desert ? '#b88055' : '#78857a');
    }
  const sea = desert ? '#459a97' : '#568e92';
  g.box(0, 0.062, 0, map.width - 0.003, 0.006, map.depth - 0.003, sea);
  const rim = desert ? 0.39 : 0.46;
  for (let c = -0.5; c < map.width - 0.501; c += 0.125) {
    const end = Math.min(map.width - 0.5, c + 0.125);
    for (const side of [-1, 1])
      for (const [p, q, tone] of [
        [0.7, 0.94, desert ? '#70b0a0' : '#7caba4'],
        [0.94, 1.24, desert ? '#a2c4a8' : '#97b9a7'],
      ]) {
        const shore = (xx, f) => [X(xx), 0.071, Z(channel(xx) + side * rim * f)];
        g.quad(shore(c, p), shore(end, p), shore(end, q), shore(c, q), tone);
      }
  }
  for (let i = 0; i < map.width * 6; i++) {
    const c = kit.between(-0.45, map.width - 0.55),
      r = channel(c) + kit.between(-0.21, 0.21),
      x = X(c),
      z = Z(r),
      w = kit.between(0.042, 0.18);
    g.quad(
      [x - w, 0.073, z],
      [x - 0.011, 0.073, z + 0.014],
      [x + w, 0.073, z],
      [x + 0.032, 0.073, z - 0.012],
      i % 3 === 0 ? '#a0c6b7' : desert ? '#77b5ae' : '#79abac',
    );
  }
}
function lanes(ctx) {
  const { props: m, desert, buildings, route, height, water, X, Z } = ctx;
  for (const site of buildings) {
    if (site.natural) continue;
    let near = route[0],
      best = Infinity;
    for (const p of route) {
      const d = Math.hypot(site.c - p.x, site.r - p.z);
      if (d < best) {
        near = p;
        best = d;
      }
    }
    if (best > 0.5 && best < 3.8) {
      const dx = (near.x - site.c) / best,
        dz = (near.z - site.r) / best,
        side = [-dz * 0.068, dx * 0.068],
        n = Math.ceil(best / 0.16);
      const bank = (t, sign) => {
        const c = site.c + dx * t + side[0] * sign,
          r = site.r + dz * t + side[1] * sign;
        return [X(c), height(c, r) + 0.021, Z(r)];
      };
      for (let i = 1; i < n; i++) {
        const a = (best * i) / n,
          b = (best * (i + 1)) / n - 0.014;
        if (a < 0.2 || b > best - 0.38 || water(site.c + dx * b, site.r + dz * b) < 0.18) continue;
        m.quad(
          bank(a, -1),
          bank(a, 1),
          bank(b, 1),
          bank(b, -1),
          desert ? (i % 3 === 0 ? '#b99771' : '#c9aa7d') : i % 3 === 0 ? '#9ca299' : '#bab9a9',
        );
      }
    }
  }
}

// Carry the board's own route tiles across the central channel on stone piers.
function crossings(ctx) {
  const { route, props: m, X, Z, water, desert } = ctx;
  for (const p of route) {
    if (water(p.x, p.z) > -0.08) continue;
    const h = p.y - 0.042;
    if (h < 0.17) continue;
    for (const side of [-1, 1])
      m.box(X(p.x) + side * 0.295, 0.065, Z(p.z), 0.103, h - 0.065, 0.63, desert ? '#bb936a' : '#8a9a94');
    m.box(X(p.x), h - 0.058, Z(p.z), 0.765, 0.062, 0.765, desert ? '#d5b084' : '#a7ada0');
  }
}
export function buildDistrictWorld(THREE, group, map, kit) {
  const ctx = makeLayout(THREE, group, map, kit);
  landform(ctx);
  crossings(ctx);
  if (ctx.desert) buildSaffron(ctx);
  else buildSkyrail(ctx);
  lanes(ctx);
  for (const [model, name] of [
    [ctx.ground, '地形与水系'],
    [ctx.m, '建筑与街区'],
    [ctx.props, '街景与植被'],
  ]) {
    if (!model.positions.length) continue;
    const mesh = model.mesh(name);
    mesh.castShadow = model !== ctx.ground;
    group.add(mesh);
  }
  group.userData.sceneryBuildings = ctx.buildings.length;
  group.userData.landmarks = ctx.landmarks;
  return (elapsed) => {
    for (const animate of ctx.animations) animate(elapsed);
  };
}
