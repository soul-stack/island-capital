import { arch, dome, pick, stairs, stripedCloth, tau } from './district-worlds.mjs';

const sand = '#d6ae77',
  stone = '#ba8b60',
  ivory = '#e8cc97',
  clay = '#bd845b',
  teal = '#438c83',
  timber = '#805a43',
  gold = '#c79a59',
  shadow = '#574e42';
const awnings = ['#b84e39', '#d59a32', '#407f73', '#268f91', '#c66a4a', '#a74c43'];
function opening(m, x, y, z, w, h) {
  m.box(x, y, z, w, h * 0.72, 0.018, shadow);
  m.tri(
    [x - w / 2, y + h * 0.715, z + 0.01],
    [x, y + h, z + 0.01],
    [x + w / 2, y + h * 0.715, z + 0.01],
    shadow,
  );
  m.box(x, y - 0.006, z + 0.013, w * 1.2, 0.018, 0.028, ivory);
}
function palm(m, x, y, z, size, lean = 0) {
  const h = size * 0.62,
    r = size * 0.045,
    cx = x + lean * size;
  for (let i = 0; i < 6; i++) {
    const a = i / 6,
      b = (i + 1) / 6;
    m.beam(
      [x + lean * size * a, y + h * a, z],
      [x + lean * size * b, y + h * b, z],
      r * (2.0 - a * 0.85),
      r * (1.88 - a * 0.74),
      i % 2 ? '#997348' : '#b08b55',
    );
  }
  for (let i = 0; i < 9; i++) {
    const a = (i * tau) / 9 + 0.17,
      dx = Math.cos(a),
      dz = Math.sin(a),
      spread = size * (i % 3 === 0 ? 0.4 : 0.34),
      side = size * 0.061;
    const hub = [cx, y + h, z],
      peak = [cx + dx * spread * 0.42, y + h + size * 0.16, z + dz * spread * 0.42];
    const tip = [cx + dx * spread, y + h - size * (i % 3 === 1 ? 0.1 : 0.052), z + dz * spread];
    const wing = [peak[0] - dz * side, peak[1] - 0.025, peak[2] + dx * side],
      other = [peak[0] + dz * side, peak[1] - 0.025, peak[2] - dx * side];
    m.tri(hub, wing, peak, i % 2 ? '#5b8660' : '#739668');
    m.tri(hub, peak, other, '#477a57');
    m.tri(wing, tip, peak, i % 2 ? '#69935e' : '#669260');
    m.tri(peak, tip, other, '#497f55');
    for (let k = 1; k < 4; k++) {
      const t = k * 0.23,
        xx = cx + dx * spread * t,
        zz = z + dz * spread * t,
        yy = y + h + size * (0.26 * t - 0.31 * t * t),
        cut = size * (0.075 - k * 0.008);
      m.tri(
        [xx, yy, zz],
        [xx + dx * cut - dz * cut, yy - size * 0.048, zz + dz * cut + dx * cut],
        [xx + dx * cut, yy, zz + dz * cut],
        '#68945f',
      );
    }
  }
}
function minaret(m, x, y, z, s) {
  const r = 0.14 * s;
  m.box(x, y, z, 0.287 * s, 0.15 * s, 0.287 * s, stone);
  m.rings(
    x,
    z,
    [
      [y + 0.14 * s, r, r, ivory],
      [y + 0.54 * s, r * 0.88, r * 0.88, sand],
      [y + 0.57 * s, r * 0.96, r * 0.96, teal],
      [y + 0.61 * s, r * 0.93, r * 0.93, teal],
      [y + 0.92 * s, r * 0.75, r * 0.75, ivory],
      [y + 0.98 * s, r * 1.23, r * 1.23, gold],
      [y + 1.02 * s, r * 1.19, r * 1.19, ivory],
      [y + 1.05 * s, r * 0.74, r * 0.74, stone],
      [y + 1.23 * s, r * 0.69, r * 0.69, ivory],
    ],
    8,
    Math.PI / 8,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      b = ((i + 1) * tau) / 8,
      rad = r * 1.11;
    m.box(
      x + rad * Math.cos(a),
      y + 1.02 * s,
      z + rad * Math.sin(a),
      0.014 * s,
      0.086 * s,
      0.014 * s,
      timber,
    );
    m.beam(
      [x + rad * Math.cos(a), y + 1.101 * s, z + rad * Math.sin(a)],
      [x + rad * Math.cos(b), y + 1.101 * s, z + rad * Math.sin(b)],
      0.015 * s,
      0.015 * s,
      timber,
    );
  }
  dome(m, x, y + 1.21 * s, z, r * 0.8, 0.175 * s, [gold, teal]);
}
function palace(m) {
  m.box(0, 0, 0, 1.57, 0.116, 1.24, stone);
  m.box(0, 0.111, 0, 1.44, 0.4, 1.08, '#dab580');
  for (const x of [-0.46, 0, 0.46]) {
    arch(m, x, 0.12, 0.55, 0.438, 0.365, 0.1, 0.067, ivory, gold);
    opening(m, x, 0.128, 0.546, 0.25, 0.26);
  }
  m.box(0, 0.499, 0, 1.52, 0.063, 1.14, ivory);
  m.box(0, 0.566, -0.055, 0.81, 0.255, 0.67, sand);
  dome(m, 0, 0.804, -0.056, 0.406, 0.422, ['#bc9657', '#398e88']);
  for (const s of [-1, 1]) m.box(0, 0.468, s * 0.554, 1.39, 0.029, 0.019, '#41948b');
  for (const [x, z] of [
    [-0.611, -0.396],
    [0.611, -0.396],
  ])
    minaret(m, x, 0.51, z, 0.77);
  for (const x of [-0.608, 0.608]) dome(m, x, 0.562, 0.362, 0.145, 0.149, [ivory, '#ba8554']);
  for (let i = 0; i < 12; i++) m.box(-0.65 + i * 0.117, 0.548, 0.553, 0.051, 0.06, 0.055, sand);
  stairs(m, 0, 0, 0.739, 0, 0.67, 3, 0.036, 0.071, stone);
}
function zigTemple(m) {
  const layers = [
    [1.55, 1.15, 0.16, '#ae7652'],
    [1.4, 0.99, 0.15, '#c59361'],
    [1.17, 0.77, 0.16, '#d0a069'],
    [0.88, 0.59, 0.14, '#d9b479'],
  ];
  let y = 0;
  for (const [w, d, h, tone] of layers) {
    m.box(0, y, 0, w, h, d, tone);
    m.box(0, y + h - 0.023, 0, w + 0.034, 0.034, d + 0.033, ivory);
    y += h;
  }
  for (const x of [-0.29, 0, 0.29])
    for (const z of [-0.17, 0.16])
      m.rings(
        x,
        z,
        [
          [y, 0.044, 0.044, stone],
          [y + 0.04, 0.038, 0.038, gold],
          [y + 0.265, 0.03, 0.03, ivory],
          [y + 0.292, 0.054, 0.054, stone],
        ],
        8,
      );
  m.box(0, y + 0.292, 0, 0.79, 0.069, 0.505, '#c3996c');
  m.rings(
    0,
    0,
    [
      [y + 0.357, 0.305, 0.25, stone],
      [y + 0.399, 0.276, 0.225, '#b16c46'],
      [y + 0.6, 0.098, 0.086, '#c78952'],
      [y + 0.64, 0.042, 0.042, gold],
    ],
    4,
    Math.PI / 4,
  );
  for (let i = 0; i < 7; i++) m.box(0, 0.002, 0.738 - i * 0.067, 0.35, 0.048 + i * 0.065, 0.076, stone);
  for (const side of [-1, 1]) {
    m.box(side * 0.579, 0.16, 0.365, 0.091, 0.31, 0.11, '#b98452');
    m.rings(
      side * 0.58,
      0.365,
      [
        [0.47, 0.063, 0.063, gold],
        [0.59, 0.013, 0.013, '#d9a859'],
      ],
      4,
      Math.PI / 4,
    );
  }
}
function bazaar(m) {
  const length = 1.8;
  m.box(0, 0, 0, length, 0.062, 0.79, stone);
  for (const z of [-0.31, 0.31])
    for (let i = 0; i < 5; i++) arch(m, -0.72 + i * 0.36, 0.064, z, 0.36, 0.351, 0.095, 0.052, sand, ivory);
  for (const z of [-0.31, 0.31]) m.box(0, 0.408, z, length + 0.04, 0.067, 0.13, ivory);
  for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36;
    const cloth = [
      ['#d47149', '#c65d3b'],
      ['#35928b', '#78b1a1'],
      ['#d8a53b', '#f2cf7c'],
      ['#418e8c', '#7cb8a5'],
      ['#c35b48', '#ed9470'],
    ][i];
    stripedCloth(m, x, 0.473, 0, 0.36, 0.9, 0.126, cloth);
    m.box(x, 0.069, 0.175, 0.26, 0.071, 0.11, timber);
    for (let j = 0; j < 3; j++)
      m.rings(
        x - 0.077 + j * 0.078,
        0.176,
        [
          [0.139, 0.029, 0.025, timber],
          [0.164, 0.037, 0.029, pick(['#a44833', '#d39b38', '#7e8b56'], i + j)],
          [0.185, 0.006, 0.006, pick(['#a44833', '#d39b38', '#7e8b56'], i + j)],
        ],
        6,
      );
  }
  for (let i = 0; i < 17; i++) {
    const x = -0.81 + i * 0.102,
      tone = i % 3 === 0 ? '#d5aa51' : i % 3 === 1 ? '#3a9691' : '#e7c58e';
    m.quad([x - 0.049, 0.079, 0.402], [x, 0.079, 0.352], [x + 0.049, 0.079, 0.402], [x, 0.079, 0.452], tone);
    m.quad([x - 0.049, 0.473, 0.381], [x, 0.517, 0.381], [x + 0.049, 0.473, 0.381], [x, 0.436, 0.381], tone);
  }
}
function gate(m) {
  const posts = [-0.49, 0.49];
  for (const x of posts) {
    m.box(x, 0, 0, 0.25, 0.69, 0.34, '#c2996e');
    m.box(x, 0.65, 0, 0.29, 0.068, 0.39, ivory);
    for (const z of [-0.12, 0.12])
      for (const dx of [-0.071, 0.071]) m.box(x + dx, 0.705, z, 0.062, 0.089, 0.075, sand);
  }
  arch(m, 0, 0.01, 0, 0.81, 0.629, 0.272, 0.116, '#d7b384', ivory);
  m.box(0, 0.612, 0, 0.86, 0.1, 0.33, sand);
  m.box(0, 0.675, 0, 0.88, 0.043, 0.356, ivory);
  for (const x of [-0.31, -0.157, 0, 0.157, 0.31]) m.box(x, 0.713, 0, 0.08, 0.071, 0.2, sand);
}
function adobe(m, w, d, k, yaw) {
  const body = pick(['#d1a26d', '#d8b17c', '#cb9166', '#e2bb87', '#c7956e', '#d5a779'], k);
  const top = pick(['#e0c18c', '#d8b985', '#d4b384'], k),
    h = 0.287 + (k % 4) * 0.066;
  m.at(0, 0, 0, yaw, () => {
    const bw = w * 0.84,
      bd = d * 0.82;
    m.box(0, 0, 0, bw + 0.025, 0.056, bd + 0.025, stone);
    m.box(0, 0.047, 0, bw, h, bd, body);
    m.box(0, h + 0.043, 0, bw + 0.032, 0.042, bd + 0.027, top);
    for (const z of [-1, 1]) m.box(0, h + 0.084, z * bd * 0.48, bw, 0.041, 0.035, top);
    for (const x of [-1, 1]) m.box(x * bw * 0.48, h + 0.084, 0, 0.033, 0.041, bd, top);
    for (const s of [-1, 1])
      m.at(0, 0, s * bd * 0.5, s < 0 ? Math.PI : 0, () => {
        opening(m, -bw * 0.22, 0.06, 0.009, 0.105, 0.185);
        opening(m, bw * 0.19, h * 0.44, 0.009, 0.068, 0.095);
        m.box(bw * 0.19, h * 0.44 + 0.101, 0.02, 0.093, 0.018, 0.034, timber);
        if (k % 3 === 0)
          for (let j = 0; j < 3; j++)
            m.box(bw * 0.08 + j * 0.053, h + 0.022, 0.023, 0.017, 0.027, 0.064, timber);
      });
    const type = k % 5;
    if (type === 0)
      dome(m, -bw * 0.12, h + 0.095, -bd * 0.06, Math.min(bw, bd) * 0.295, 0.147, [
        gold,
        pick([teal, '#b87b4c', '#b39b65'], Math.floor(k / 5)),
      ]);
    if (type === 1) {
      m.box(-bw * 0.18, h + 0.08, -bd * 0.13, bw * 0.49, 0.164, bd * 0.48, body);
      m.box(-bw * 0.18, h + 0.243, -bd * 0.13, bw * 0.53, 0.026, bd * 0.52, top);
    }
    if (type === 2 || type === 4) {
      stripedCloth(m, 0, h * 0.78, bd * 0.49 + 0.048, bw * 0.79, 0.145, 0.037, [pick(awnings, k), ivory]);
      m.box(bw * 0.29, 0.065, bd * 0.52 + 0.096, 0.015, h * 0.56, 0.015, timber);
    }
    if (type === 3) {
      for (const x of [-1, 1])
        for (const z of [-1, 1]) m.box(x * bw * 0.29, h + 0.087, z * bd * 0.27, 0.017, 0.087, 0.017, timber);
      stripedCloth(m, 0, h + 0.173, 0, bw * 0.68, bd * 0.62, 0.029, ['#bd965e', '#e2c48e']);
    }
  });
}
function noriaStand(ctx, c, r) {
  const { X, Z, water, height, mobile, props: m, reserve } = ctx,
    x = X(c),
    z = Z(r),
    base = 0.07,
    cy = base + 0.48;
  if (ctx.route.some((p) => Math.abs(p.x - c) < 0.95 && Math.abs(p.z - r) < 0.63)) return false;
  for (const dx of [-0.39, 0.39]) m.box(x + dx, 0.023, z + 0.069, 0.135, 0.425, 0.34, stone);
  m.beam([x - 0.405, 0.406, z + 0.096], [x + 0.406, 0.406, z + 0.096], 0.065, 0.061, timber);
  m.box(x + 0.25, 0.406, z + 0.17, 0.6, 0.071, 0.169, sand);
  m.box(x + 0.25, 0.469, z + 0.17, 0.59, 0.014, 0.064, '#75b9aa');
  reserve(c, r, 0.91, 0.53);
  const wheel = ctx.kit.make();
  for (let i = 0; i < 16; i++) {
    const a = (tau * i) / 16,
      b = (tau * (i + 1)) / 16,
      point = (a, r, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
    for (const side of [-0.067, 0.067])
      wheel.beam(point(a, 0.419, side), point(b, 0.419, side), 0.043, 0.031, timber);
    if (i % 2 === 0) wheel.beam([0, 0, 0.01], point(a, 0.415, 0.014), 0.034, 0.032, '#9f7a50');
    wheel.beam(point(a, 0.408, -0.094), point(a, 0.408, 0.093), 0.059, 0.051, '#b38752');
  }
  const o = wheel.mesh('转动的提水轮');
  o.position.set(x, cy, z);
  ctx.group.add(o);
  ctx.animations.push((t) => {
    o.rotation.z = -t * 0.29;
  });
  ctx.landmarks.push({ name: '绿洲提水轮', x, z, y: cy });
  return true;
}
function camel(m, x, y, z, size, yaw) {
  m.at(x, y, z, yaw, () => {
    const p = (x, y, z) => [x * size, y * size, z * size];
    const body = '#af8052';
    m.box(0, 0.23 * size, 0, 0.35 * size, 0.175 * size, 0.151 * size, body);
    m.rings(
      -0.043 * size,
      0,
      [
        [0.36 * size, 0.113 * size, 0.079 * size, body],
        [0.459 * size, 0.046 * size, 0.035 * size, body],
      ],
      7,
    );
    m.beam(p(0.126, 0.29, 0.001), p(0.232, 0.476, 0), 0.073 * size, 0.071 * size, body);
    m.box(0.265 * size, 0.451 * size, 0, 0.15 * size, 0.069 * size, 0.075 * size, body);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        m.beam(
          p(sx * 0.115, 0.24, sz * 0.049),
          p(sx * 0.134, 0, sz * 0.056),
          0.031 * size,
          0.032 * size,
          body,
        );
    m.box(-0.046 * size, 0.263 * size, 0, 0.124 * size, 0.106 * size, 0.184 * size, '#9a4d3d');
  });
}
function terraceMesa(m, w, d, h, k) {
  const outline = [
    [-1, -0.34],
    [-0.78, -0.79],
    [-0.39, -0.83],
    [-0.19, -1],
    [0.17, -0.72],
    [0.53, -0.84],
    [0.72, -0.57],
    [0.97, -0.46],
    [0.91, 0.05],
    [0.98, 0.32],
    [0.57, 0.63],
    [0.27, 0.54],
    [0.08, 0.83],
    [-0.28, 0.69],
    [-0.5, 0.94],
    [-0.85, 0.64],
    [-0.77, 0.28],
    [-0.99, 0.14],
  ];
  function rock(x, z, w, d, high, y, phase, spire = false) {
    const crag = outline.map(([px, pz], i) => [
      px * w * 0.5,
      pz * d * 0.5,
      0.11 * Math.sin(i * 1.29 + phase) + 0.05 * Math.cos(i * 0.71 + phase),
    ]);
    let last;
    const rings = [
      [-0.36, 1.03, '#9c624b'],
      [0.14, 1, '#b7714c'],
      [0.21, 0.966, '#cf8955'],
      [0.245, 0.97, '#e3a575'],
      [0.3, 0.94, '#a95e44'],
      [0.55, 0.923, '#ae6346'],
      [0.585, 0.94, '#d58753'],
      [0.635, 0.92, '#d47748'],
      [0.855, 0.88, '#b76b4a'],
      [0.884, 0.897, '#dd9762'],
      [1, 0.85, '#cb8656'],
    ];
    for (const [v, s, col] of rings) {
      const f = spire ? 1 - (1 - s) * 2.2 : s;
      const pts = crag.map(([dx, dz, j]) => [
        x + dx * f + (v > 0 ? Math.sin(phase) * 0.035 * v : 0),
        y + v * high + (v > 0 ? high * j * v : 0),
        z + dz * f + v * 0.025,
      ]);
      if (last)
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          m.tri(last[i], pts[i], pts[j], col, i % 4 === 1 ? 0.79 : 1);
          m.tri(last[i], pts[j], last[j], col, i % 4 === 0 ? 0.86 : 0.98);
        }
      last = pts;
    }
    for (let i = 0; i < last.length; i++)
      m.tri(
        [x, y + high * 0.985, z],
        last[(i + 1) % last.length],
        last[i],
        '#d99b68',
        i % 3 === 0 ? 0.96 : 1,
      );
  }
  // Split each butte along a winding slot. Steep layered walls carry isolated hoodoos on the upper bench.
  rock(-w * 0.155, d * 0.085, w * 0.69, d * 0.74, h * 0.7, 0, k);
  rock(w * 0.22, -d * 0.06, w * 0.53, d * 0.8, h * 0.85, 0, k + 2.2);
  rock(-w * 0.249, -d * 0.04, w * 0.27, d * 0.36, h * 0.41, h * 0.61, k + 0.52, true);
  rock(w * 0.29, -d * 0.11, w * 0.2, d * 0.32, h * 0.36, h * 0.747, k + 2.8, true);
  rock(-w * 0.45, d * 0.26, w * 0.104, d * 0.2, h * 0.35, 0, k + 1.2, true);
}
function irrigation(m, w, d) {
  m.box(0, 0, 0, w * 0.88, 0.025, d * 0.86, '#a28255');
  for (let i = 0; i < 5; i++) {
    const x = -w * 0.37 + i * w * 0.185;
    m.box(x, 0.025, 0, 0.032, 0.011, d * 0.82, '#62a397');
    if (i < 4)
      for (let j = 0; j < 6; j++) {
        const z = -d * 0.34 + j * d * 0.131;
        m.rings(
          x + w * 0.086,
          z,
          [
            [0.024, 0.041, 0.04, '#718b52'],
            [0.08, 0.032, 0.029, '#86a05e'],
            [0.092, 0.015, 0.014, '#abc077'],
          ],
          5,
        );
      }
  }
}
function barge(m) {
  const rim = [
    [0, -0.36],
    [0.1, -0.23],
    [0.115, 0.16],
    [0.06, 0.29],
    [0, 0.35],
    [-0.06, 0.29],
    [-0.115, 0.16],
    [-0.1, -0.23],
  ];
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i],
      b = rim[(i + 1) % rim.length];
    m.quad(
      [a[0] * 0.76, 0, a[1] * 0.91],
      [a[0], 0.07, a[1]],
      [b[0], 0.07, b[1]],
      [b[0] * 0.76, 0, b[1] * 0.91],
      '#966a44',
    );
    m.tri([0, 0.058, 0], [a[0], 0.071, a[1]], [b[0], 0.071, b[1]], '#b18b56');
  }
  for (const dx of [-0.08, 0.08])
    for (const dz of [-0.15, 0.1]) m.box(dx, 0.065, dz, 0.011, 0.125, 0.011, timber);
  stripedCloth(m, 0, 0.192, -0.025, 0.205, 0.337, 0.035, ['#ab5943', '#e6b975']);
}
export function buildSaffron(ctx) {
  const { m, props, X, Z, kit, find, place, fits, reserve, height, water, map, faceStreet } = ctx;
  find(16.67, 2.12, 1.72, 1.59, palace, { label: '铜顶水宫', radius: 1.4, focus: 0.75 });
  find(11.17, 8.75, 1.76, 1.46, (q) => q.at(0, 0, -0.09, 0, () => zigTemple(q)), {
    label: '红砂阶庙',
    wet: true,
    radius: 1.05,
    focus: 0.62,
  });
  find(3.04, 7.08, 2.03, 0.97, bazaar, { label: '香料大巴扎', radius: 1.35, focus: 0.3 });
  find(7.63, 4.55, 1.31, 0.52, gate, { label: '古商道城门', radius: 1.15, focus: 0.39 });
  find(1.03, 1.57, 2.55, 2.02, (q, w, d) => terraceMesa(q, w, d, 1.2, 3), {
    label: '赤壁峡谷',
    natural: true,
    focus: 0.64,
  });
  find(7.04, 10.24, 2.22, 1.35, (q, w, d) => terraceMesa(q, w, d, 0.82, 5), {
    label: '南方风蚀崖',
    natural: true,
    focus: 0.44,
  });
  find(16.63, 9.86, 2.73, 1.53, (q, w, d) => terraceMesa(q, w, d, 0.95, 9), {
    label: '东南层岩台',
    natural: true,
    focus: 0.5,
  });
  find(
    13.08,
    0.02,
    1.07,
    0.67,
    (q) => {
      minaret(q, 0, 0, 0, 0.94);
      palm(q, 0.32, 0, 0.08, 0.53, 0.05);
    },
    { label: '商队望塔', focus: 0.68 },
  );
  for (const [c, r] of [
    [2.3, 6.2],
    [16.11, 7.07],
    [7.64, 3.92],
    [10.68, 8.44],
    [12.9, 7.19],
  ])
    find(c, r, 0.92, 0.63, irrigation, { label: '水渠菜圃', radius: 0.67 });
  if (!noriaStand(ctx, 11.5, 6.42)) noriaStand(ctx, 11.29, 6.56);
  for (const [cx, rr] of [
    [10.04, 7.07],
    [12.71, 7.0],
    [4.19, 7.9],
    [15.88, 2.83],
    [2.17, 5.93],
  ]) {
    find(
      cx,
      rr,
      0.66,
      0.51,
      (q) => {
        palm(q, -0.175, 0, 0.036, 1.0, -0.075);
        palm(q, 0.106, 0, -0.086, 1.14, 0.057);
        palm(q, 0.205, 0, 0.071, 0.7, 0.068);
        q.box(-0.045, 0, 0.12, 0.25, 0.052, 0.082, '#799462');
      },
      { label: '椰枣林', radius: 0.36, tone: '#b2a274' },
    );
  }
  ctx.mobile('绿洲摆渡船', barge, X(11.36), 0.077, Z(7.31), (mesh, t) => {
    mesh.position.x = X(11.32 + 0.58 * Math.cos(t * 0.18));
    mesh.position.z = Z(7.34 + 0.14 * Math.sin(t * 0.18));
    mesh.position.y = 0.078 + 0.011 * Math.sin(t * 1.2);
    mesh.rotation.y = Math.atan2(-0.58 * Math.sin(t * 0.18), 0.14 * Math.cos(t * 0.18));
  });
  ctx.landmarks.push({ name: '翡翠泊地', x: X(11.32), z: Z(7.32), y: 0.15 });
  const districts = [
    [0.03, 6.7, 0.07, 3.8],
    [7.1, 14.7, 0.03, 3.39],
    [15.67, 18.95, 0.03, 3.56],
    [1.92, 8.68, 4.2, 8.48],
    [9.56, 14.43, 5.53, 8.94],
    [15.15, 18.87, 4.81, 7.43],
    [0.13, 8.52, 9.61, 10.92],
    [13.7, 18.93, 8.66, 10.92],
  ];
  let k = 0;
  for (const [l, right, t, bottom] of districts)
    for (let r = t; r <= bottom; r += 0.79)
      for (let c = l; c <= right; c += 0.81) {
        k++;
        if (k % 7 === 3) continue;
        const cc = c + kit.between(-0.074, 0.074),
          rr = r + kit.between(-0.085, 0.085),
          w = 0.53 + (k % 4) * 0.071,
          d = 0.49 + (k % 3) * 0.061,
          sz = Math.max(w, d);
        const yaw = faceStreet(cc, rr) + ((k % 3) - 1) * 0.028;
        place(cc, rr, sz + 0.059, sz + 0.057, (q) => adobe(q, w, d, k, yaw), {
          label: '商坊庭院',
          margin: 0.017,
          tone: k % 3 === 1 ? '#d1ad79' : '#cba270',
        });
      }
  for (const [c, r] of [
    [2.43, 8.16],
    [3.0, 8.29],
    [3.58, 8.23],
    [17.4, 9.07],
    [15.67, 9.25],
  ]) {
    if (fits(c, r, 0.42, 0.24)) {
      reserve(c, r, 0.42, 0.24);
      camel(props, X(c), height(c, r) + 0.022, Z(r), 0.72, c < 10 ? 0.12 : -0.21);
    }
  }
  for (let r = 0.02; r < map.depth - 0.5; r += 0.48)
    for (let c = 0.08; c < map.width - 0.5; c += 0.61) {
      const chance = kit.rand(),
        bank = water(c, r),
        w = 0.28;
      if (!fits(c, r, w, w) || chance > (bank < 1 ? 0.65 : 0.39)) continue;
      reserve(c, r, w, w);
      const x = X(c),
        z = Z(r),
        y = height(c, r) + 0.009;
      if (chance < 0.13 || bank < 0.63) {
        palm(props, x, y, z, kit.between(0.47, 0.89), kit.between(-0.15, 0.15));
      } else if (chance < 0.19) {
        props.rings(
          x,
          z,
          [
            [y, 0.101, 0.101, stone],
            [y + 0.057, 0.111, 0.111, clay],
            [y + 0.117, 0.081, 0.081, clay],
            [y + 0.126, 0.05, 0.05, shadow],
          ],
          8,
        );
        props.rings(
          x + 0.09,
          z + 0.046,
          [
            [y, 0.041, 0.041, stone],
            [y + 0.068, 0.034, 0.034, clay],
          ],
          7,
        );
      } else if (chance < 0.24) kit.crate(props, x, y, z, 0.128);
      else {
        kit.boulder(props, x, y - 0.009, z, 0.16, 0.084, 0.11, '#bb956a');
        props.tri([x + 0.03, y, z], [x + 0.076, y + 0.091, z + 0.035], [x + 0.083, y, z], '#859158');
      }
    }
  // Wind-cut sand ripples appear on the open desert. Farm beds and glazed bands mark the irrigated areas.
  for (let i = 0; i < 690; i++) {
    const c = kit.between(-0.37, map.width - 0.63),
      r = kit.between(-0.37, map.depth - 0.63),
      bank = water(c, r);
    if (bank < 0.34 || !fits(c, r, 0.095, 0.058)) continue;
    const x = X(c),
      z = Z(r),
      y = height(c, r) + 0.009,
      w = kit.between(0.06, 0.18);
    props.quad(
      [x - w, y, z],
      [x - 0.02, y + 0.002, z + 0.014],
      [x + w, y, z - 0.018],
      [x + 0.01, y, z - 0.009],
      i % 2 ? '#d1a878' : '#e6c58c',
    );
  }
}
