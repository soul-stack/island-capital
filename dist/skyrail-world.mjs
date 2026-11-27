import { arch, dome, pick, stairs, stripedCloth, tau } from './district-worlds.mjs';

const wall = ['#dcac83', '#c1c9aa', '#c39b72', '#99b9aa', '#bc785e', '#e6c996', '#a2bfba'];
const roofs = ['#445f6b', '#a04b39', '#39796e', '#805a48', '#536780', '#9f4939'];
const ink = '#3e5556',
  trim = '#e3d3af',
  stone = '#a7a18c',
  brick = '#997860',
  copper = '#568b81';

function sash(m, x, y, z, w, h, bay = false) {
  m.box(x, y, z, w + 0.022, h + 0.022, 0.025, trim);
  m.box(x, y + 0.007, z + 0.015, w, h, 0.016, '#4e7175');
  m.box(x, y + 0.009, z + 0.028, 0.009, h, 0.008, trim);
  m.box(x, y + h * 0.58, z + 0.028, w, 0.009, 0.009, trim);
  m.box(x, y - 0.009, z + 0.02, w + 0.041, 0.018, 0.043, bay ? ink : stone);
}
function hip(m, w, d, y, rise, tone) {
  const dx = w * 0.55,
    dz = d * 0.55,
    upper = d * 0.12;
  for (const s of [-1, 1]) {
    m.quad(
      [-dx, y, s * dz],
      [dx, y, s * dz],
      [dx * 0.81, y + rise, s * upper],
      [-dx * 0.81, y + rise, s * upper],
      tone,
      s > 0 ? 0.99 : 0.87,
    );
    m.quad(
      [s * dx, y, -dz],
      [s * dx, y, dz],
      [s * dx * 0.81, y + rise, upper],
      [s * dx * 0.81, y + rise, -upper],
      tone,
      0.92,
    );
  }
  m.box(0, y + rise, 0, dx * 1.65, 0.018, upper * 2, tone);
}
function townhouse(m, w, d, k, steps, angle) {
  m.at(0, 0, 0, angle, () => {
    const fw = w * 0.79,
      fd = d * 0.76,
      floor = 0.175 + (k % 3) * 0.011,
      h = steps * floor + 0.085,
      body = pick(wall, k),
      slate = pick(roofs, k * 3 + Math.floor(k / 5));
    m.box(0, 0, 0, fw + 0.029, 0.071, fd + 0.029, stone);
    m.box(0, 0.061, 0, fw, h, fd, body);
    for (let i = 1; i <= steps; i++)
      m.box(0, 0.057 + i * floor, 0, fw + 0.014, 0.018, fd + 0.014, k % 3 === 0 ? trim : body);
    for (const s of [-1, 1])
      m.at(0, 0, (s * fd) / 2, s < 0 ? Math.PI : 0, () => {
        const count = fw > 0.66 ? 3 : 2;
        for (let level = 0; level < steps; level++)
          for (let i = 0; i < count; i++) {
            const xx = fw * ((i + 0.5) / count - 0.5),
              yy = 0.108 + level * floor;
            if (level === 0 && i === count - 1) {
              m.box(xx, 0.055, 0.017, 0.1, 0.147, 0.028, '#6d5f49');
              continue;
            }
            sash(m, xx, yy, 0, Math.min(0.102, fw * 0.15), 0.099, level === 1);
            if (level === 1 && i === 0 && k % 3 === 0) {
              m.box(xx, yy - 0.017, 0.047, 0.16, 0.021, 0.082, stone);
              for (const j of [-1, 0, 1]) m.box(xx + j * 0.053, yy, 0.083, 0.009, 0.07, 0.01, ink);
              m.box(xx, yy + 0.069, 0.083, 0.15, 0.009, 0.009, ink);
            }
          }
      });
    if (k % 4 === 0) {
      m.box(0, h + 0.045, 0, fw + 0.073, 0.061, fd + 0.066, stone);
      m.box(0, h + 0.103, 0, fw - 0.018, 0.035, fd - 0.023, slate);
      m.rings(
        fw * 0.21,
        -fd * 0.12,
        [
          [h + 0.12, 0.071, 0.071, ink],
          [h + 0.3, 0.071, 0.071, '#806c50'],
          [h + 0.323, 0.078, 0.078, ink],
        ],
        8,
      );
    } else {
      m.box(0, h + 0.051, 0, fw + 0.063, 0.037, fd + 0.048, trim);
      hip(m, fw, fd, h + 0.086, 0.133 + (k % 3) * 0.022, slate);
      if (k % 2 === 0)
        for (const s of [-1, 1]) {
          m.box(s * fw * 0.24, h + 0.102, fd * 0.28, 0.09, 0.091, 0.092, trim);
          m.box(s * fw * 0.24, h + 0.117, fd * 0.34, 0.047, 0.051, 0.016, ink);
          hipDormer(m, s * fw * 0.24, h + 0.197, fd * 0.27, slate);
        }
      m.box(-fw * 0.29, h + 0.13, -fd * 0.17, 0.062, 0.151, 0.069, brick);
    }
    if (k % 4 === 2) {
      stripedCloth(m, 0, 0.217, fd * 0.53 + 0.04, fw * 0.61, 0.126, 0.022, ['#7a9d83', '#e6d6ab']);
    }
  });
}
function hipDormer(m, x, y, z, color) {
  m.at(x, y, z, 0, () => hip(m, 0.105, 0.094, 0, 0.047, color));
}
function cityHall(m) {
  m.box(0, 0, 0, 1.8, 0.1, 0.91, stone);
  m.box(0, 0.093, 0, 1.63, 0.47, 0.78, '#d2b995');
  for (const side of [-1, 1]) {
    m.at(side * 0.64, 0, 0, 0, () => {
      m.box(0, 0.5, 0, 0.4, 0.253, 0.66, '#dcc7a4');
      hip(m, 0.4, 0.66, 0.742, 0.197, '#64777c');
      for (const x of [-0.105, 0.105]) sash(m, x, 0.56, 0.335, 0.064, 0.117);
      m.box(0, 0.917, 0, 0.043, 0.085, 0.043, ink);
    });
  }
  m.box(0, 0.55, 0, 0.78, 0.076, 0.8, trim);
  m.box(0, 0.607, 0, 0.62, 0.312, 0.57, '#d7c6a9');
  m.rings(
    0,
    -0.025,
    [
      [0.879, 0.328, 0.323, stone],
      [0.921, 0.343, 0.337, trim],
      [1.043, 0.288, 0.288, '#cfb88c'],
    ],
    12,
  );
  dome(m, 0, 1.039, -0.025, 0.322, 0.342, [trim, copper]);
  for (const x of [-0.294, -0.16, 0.16, 0.294]) {
    m.rings(
      x,
      0.453,
      [
        [0.109, 0.035, 0.035, stone],
        [0.145, 0.027, 0.027, trim],
        [0.461, 0.026, 0.026, trim],
        [0.484, 0.04, 0.04, stone],
      ],
      8,
    );
  }
  m.box(0, 0.487, 0.438, 0.705, 0.049, 0.22, trim);
  m.tri([-0.35, 0.535, 0.549], [0, 0.661, 0.549], [0.35, 0.535, 0.549], stone);
  m.box(0, 0.111, 0.403, 0.18, 0.32, 0.034, ink);
  for (const side of [-1, 1])
    for (let j = 0; j < 2; j++) sash(m, side * (0.457 + j * 0.196), 0.22, 0.397, 0.09, 0.166);
  stairs(m, 0, 0.005, 0.627, 0, 0.667, 3, 0.033, 0.055, stone);
}
function terminal(m) {
  m.box(0, 0, 0, 1.92, 0.085, 0.61, stone);
  for (const x of [-0.82, -0.44, 0, 0.44, 0.82])
    for (const z of [-0.232, 0.232]) m.box(x, 0.08, z, 0.036, 0.423, 0.036, ink);
  const n = 10,
    r = 0.33,
    h = 0.489;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const p = (x, t) => [x, h + Math.sin(t) * r * 0.68, Math.cos(t) * r];
    m.quad(
      p(-0.99, a),
      p(0.99, a),
      p(0.99, b),
      p(-0.99, b),
      i % 4 === 0 ? '#86a39c' : '#a9c5b7',
      i % 2 ? 1 : 0.93,
    );
    m.beam(p(-1, a), p(1, a), 0.015, 0.014, ink);
    for (const x of [-0.98, -0.56, 0, 0.56, 0.98]) m.beam(p(x, a), p(x, b), 0.015, 0.019, ink);
  }
  m.box(-0.6, 0.09, -0.072, 0.45, 0.24, 0.2, brick);
  m.box(-0.6, 0.198, 0.033, 0.32, 0.071, 0.023, '#a5c4ae');
  m.box(0.015, 0.36, 0.25, 0.379, 0.119, 0.029, '#345b59');
  for (let i = 0; i < 5; i++) m.box(-0.126 + i * 0.065, 0.403, 0.269, 0.035, 0.013, 0.008, '#e0c995');
  for (const x of [-0.36, 0.29, 0.57]) {
    m.box(x, 0.14, 0.085, 0.2, 0.035, 0.084, '#916a4c');
    m.box(x, 0.085, 0.085, 0.041, 0.059, 0.046, ink);
  }
}
function tramModel(m) {
  m.box(0, 0, 0, 0.6, 0.053, 0.212, ink);
  m.box(0, 0.052, 0, 0.59, 0.112, 0.201, '#aa533b');
  m.box(0, 0.163, 0, 0.581, 0.16, 0.198, '#e2cd9e');
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++)
      m.box(-0.227 + i * 0.113, 0.182, side * 0.102, 0.087, 0.104, 0.015, '#53767b');
  for (const side of [-1, 1]) m.box(side * 0.294, 0.181, 0, 0.014, 0.104, 0.145, '#547a7c');
  m.box(0, 0.322, 0, 0.626, 0.048, 0.24, '#496561');
  m.beam([-0.063, 0.365, 0], [0.005, 0.444, 0], 0.014, 0.014, ink);
  m.beam([0.005, 0.444, 0], [0.087, 0.365, 0], 0.014, 0.014, ink);
}
function viaduct(ctx) {
  const { m, X, Z, mobile, height, reserve } = ctx,
    a = 5.66,
    b = 9.37,
    r = 2.3,
    z = Z(r),
    deck = 0.99;
  reserve((a + b) / 2, r, b - a + 0.15, 0.36);
  const bays = 7,
    w = (b - a) / bays;
  for (let i = 0; i < bays; i++) {
    const c = a + (i + 0.5) * w,
      y = height(c, r) - 0.055;
    arch(m, X(c), y, z, w + 0.025, deck - y - 0.055, 0.249, 0.079, '#9a9481', '#c9b590');
  }
  m.box(X((a + b) / 2), deck - 0.075, z, b - a + 0.142, 0.085, 0.32, '#7d8981');
  for (let i = 0; i < 34; i++)
    m.box(X(a + ((b - a) * i) / 33), deck + 0.007, z, 0.038, 0.017, 0.257, '#765f4f');
  for (const side of [-1, 1])
    m.box(X((a + b) / 2), deck + 0.029, z + side * 0.083, b - a + 0.055, 0.021, 0.019, ink);
  const poles = [a + 0.07, a + 1.21, a + 2.47, b - 0.04];
  for (const c of poles) {
    m.box(X(c), deck, z - 0.17, 0.027, 0.544, 0.027, ink);
    m.box(X(c), deck + 0.524, z - 0.07, 0.021, 0.018, 0.24, ink);
  }
  m.beam([X(a), deck + 0.537, z], [X(b), deck + 0.537, z], 0.007, 0.007, '#5d706b');
  mobile('穿行的山城电车', tramModel, X(a + 0.34), deck + 0.048, z, (s, t) => {
    s.position.x = X(a + 0.34 + (b - a - 0.68) * (0.5 - 0.5 * Math.cos(t * 0.285)));
  });
  ctx.landmarks.push({ name: '山腰铁路高架桥', x: X((a + b) / 2), z, y: deck + 0.16 });
}
function clockSquare(m, kit) {
  for (let i = 0; i < 4; i++)
    arch(m, -0.55 + i * 0.35, 0.015, -0.04, 0.342, 0.337, 0.28, 0.056, '#d0b28d', trim);
  m.box(-0.025, 0.338, -0.042, 1.41, 0.05, 0.392, stone);
  m.box(-0.025, 0.39, -0.06, 1.36, 0.254, 0.33, '#caaa84');
  hip(m, 1.35, 0.35, 0.64, 0.149, '#98715b');
  kit.clockTower(m, -0.37, 0.365, -0.055);
  for (const x of [0.075, 0.315, 0.555]) sash(m, x, 0.441, 0.114, 0.087, 0.132);
}
function greenhouse(m) {
  m.box(0, 0, 0, 1.12, 0.073, 0.48, stone);
  m.box(0, 0.073, 0, 1.04, 0.255, 0.43, '#98b5a1');
  hip(m, 1.04, 0.443, 0.328, 0.159, '#91afa0');
  for (const x of [-0.49, -0.25, 0, 0.25, 0.49]) m.box(x, 0.075, 0.225, 0.02, 0.259, 0.019, '#e0d3aa');
  m.box(0, 0.2, 0.236, 1.04, 0.019, 0.018, trim);
}
function foundry(m) {
  m.box(0, 0.008, 0, 1.06, 0.375, 0.65, '#ab795e');
  for (let i = 0; i < 3; i++)
    m.at(-0.355 + i * 0.355, 0.38, 0, 0, () => {
      m.quad([-0.175, 0, -0.35], [0.175, 0.143, -0.35], [0.175, 0.143, 0.35], [-0.175, 0, 0.35], '#5d7777');
      m.quad([0.175, 0.143, -0.35], [0.175, 0, -0.35], [0.175, 0, 0.35], [0.175, 0.143, 0.35], '#9ab1a6');
    });
  for (let j = 0; j < 5; j++) sash(m, -0.4 + j * 0.2, 0.128, 0.331, 0.117, 0.14);
  m.rings(
    -0.424,
    -0.213,
    [
      [0.36, 0.09, 0.09, brick],
      [0.892, 0.057, 0.057, '#996f58'],
      [0.924, 0.074, 0.074, trim],
      [0.959, 0.074, 0.074, brick],
    ],
    8,
  );
}
function parkFountain(m) {
  m.rings(
    0,
    0,
    [
      [0, 0.365, 0.365, stone],
      [0.055, 0.365, 0.365, trim],
      [0.061, 0.313, 0.313, '#6fa4a2'],
    ],
    12,
  );
  m.rings(
    0,
    0,
    [
      [0.061, 0.08, 0.08, stone],
      [0.196, 0.047, 0.047, trim],
      [0.208, 0.155, 0.155, stone],
      [0.236, 0.148, 0.148, '#78a5a4'],
      [0.33, 0.027, 0.027, trim],
    ],
    10,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i * tau) / 6;
    m.beam([0, 0.305, 0], [0.142 * Math.cos(a), 0.139, 0.142 * Math.sin(a)], 0.013, 0.013, '#a4c8c1');
  }
}
function streetLight(m, x, y, z) {
  m.rings(
    x,
    z,
    [
      [y, 0.038, 0.038, ink],
      [y + 0.028, 0.041, 0.041, ink],
      [y + 0.048, 0.018, 0.018, ink],
      [y + 0.285, 0.012, 0.012, ink],
      [y + 0.3, 0.043, 0.043, ink],
      [y + 0.366, 0.031, 0.031, '#e2be72'],
      [y + 0.387, 0.045, 0.045, ink],
      [y + 0.411, 0.009, 0.009, ink],
    ],
    6,
  );
}
function hedge(m, x, y, z, w, d) {
  m.box(x, y, z, w + 0.023, 0.063, d + 0.023, stone);
  m.box(x, y + 0.057, z, w, 0.132, d, '#5b805e');
  m.box(x, y + 0.181, z, w - 0.022, 0.028, d - 0.018, '#779465');
}

function forestRidge(m, w, d, kit) {
  const shore = [
    [-0.96, -0.47],
    [-0.71, -0.87],
    [-0.42, -0.83],
    [-0.2, -0.99],
    [0.23, -0.96],
    [0.43, -0.69],
    [0.68, -0.75],
    [0.97, -0.28],
    [0.87, 0.07],
    [0.96, 0.39],
    [0.71, 0.63],
    [0.5, 0.46],
    [0.26, 0.68],
    [-0.04, 0.66],
    [-0.34, 0.82],
    [-0.69, 0.62],
    [-0.83, 0.38],
    [-0.96, 0.16],
  ];
  const base = shore.map(([x, z]) => [x * w * 0.5, z * d * 0.5]);
  // Flat benches and abrupt, notched rock faces leave space for the rail portal and upper pine grove.
  let last;
  for (const [y, s, dx, dz, tone] of [
    [-0.52, 1, 0, 0, '#61716c'],
    [0.11, 0.99, 0, 0, '#69766d'],
    [0.22, 0.95, 0, 0, '#879286'],
    [0.265, 0.96, 0, 0, '#9eaa91'],
    [0.3, 0.94, 0, 0, '#789260'],
    [0.3, 0.83, -0.02, -0.06, '#8aa26e'],
    [0.61, 0.79, -0.06, -0.08, '#65766e'],
    [0.66, 0.8, -0.06, -0.08, '#a2aa92'],
    [0.7, 0.78, -0.07, -0.08, '#799460'],
    [0.7, 0.64, -0.13, -0.12, '#96a273'],
    [0.92, 0.595, -0.15, -0.14, '#748477'],
    [0.965, 0.6, -0.15, -0.14, '#a3ad98'],
    [0.99, 0.58, -0.15, -0.14, '#80996b'],
  ]) {
    const ring = base.map(([x, z]) => [x * s + dx, y, z * s + dz]);
    if (last)
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        m.tri(last[i], ring[i], ring[j], tone, i % 4 === 0 ? 0.82 : 1);
        m.tri(last[i], ring[j], last[j], tone, i % 4 === 1 ? 0.86 : 0.99);
      }
    last = ring;
  }
  for (let i = 0; i < last.length; i++)
    m.tri([-0.13, 0.991, -0.14], last[(i + 1) % last.length], last[i], '#859967');
  for (const [x, z, level, size] of [
    [-1.32, -0.22, 0.3, 0.66],
    [-1.04, -0.43, 0.7, 0.8],
    [-0.77, -0.52, 0.99, 0.75],
    [-0.49, -0.57, 0.99, 0.86],
    [-0.23, -0.58, 0.99, 0.69],
    [0.08, -0.53, 0.99, 0.79],
    [0.43, -0.51, 0.7, 0.71],
    [0.76, -0.41, 0.7, 0.72],
    [1.02, -0.32, 0.7, 0.65],
    [1.24, -0.22, 0.3, 0.68],
    [-1.12, 0.34, 0.3, 0.56],
    [-0.85, 0.3, 0.7, 0.64],
    [0.82, 0.26, 0.3, 0.6],
    [1.08, 0.23, 0.3, 0.59],
  ]) {
    kit.pine(m, x, level, z, size);
  }
  for (const [x, z, level] of [
    [-0.94, 0.46, 0.27],
    [-0.7, 0.46, 0.31],
    [0.29, 0.51, 0.27],
    [0.55, 0.36, 0.61],
    [-0.78, -0.66, 0.65],
    [0.83, -0.64, 0.27],
  ])
    kit.boulder(m, x, level - 0.08, z, 0.42, 0.3, 0.27, '#77867a');
  m.at(0.13, 0.987, -0.09, 0.13, () => {
    m.rings(
      0,
      0,
      [
        [0, 0.232, 0.232, stone],
        [0.077, 0.226, 0.226, trim],
        [0.09, 0.175, 0.175, stone],
        [0.443, 0.152, 0.152, '#d9c49b'],
        [0.464, 0.205, 0.205, ink],
        [0.504, 0.208, 0.208, stone],
        [0.664, 0.155, 0.155, '#9ab1a3'],
      ],
      8,
      Math.PI / 8,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      m.box(Math.cos(a) * 0.148, 0.501, Math.sin(a) * 0.148, 0.019, 0.169, 0.019, ink);
    }
    dome(m, 0, 0.66, 0, 0.2, 0.217, ['#b19862', '#527d70']);
  });
  m.at(-0.42, 0.004, 0.67, 0.02, () => {
    m.box(0, 0, -0.02, 0.5, 0.32, 0.08, '#354541');
    m.tri([-0.25, 0.316, 0.026], [0, 0.536, 0.026], [0.25, 0.316, 0.026], '#354541');
    arch(m, 0, 0, 0.034, 0.72, 0.52, 0.115, 0.105, '#aaab94', '#d2c39d');
    for (let k = 0; k < 5; k++) m.box(0, 0.014, 0.16 + k * 0.067, 0.28, 0.025, 0.029, '#786552');
    for (const s of [-1, 1]) m.box(s * 0.093, 0.042, 0.289, 0.017, 0.014, 0.39, ink);
  });
  stairs(m, -0.02, 0.295, 0.51, -0.34, 0.173, 6, 0.061, 0.071, stone);
  for (const [x, z] of [
    [-0.94, 0.37],
    [-0.7, 0.41],
    [0.51, 0.32],
  ])
    m.box(x, 0.309, z, 0.24, 0.079, 0.072, stone);
}

export function buildSkyrail(ctx) {
  const { m, props, X, Z, kit, height, find, place, fits, reserve, faceStreet, water, map } = ctx;
  viaduct(ctx);
  find(1.52, 1.08, 3.46, 2.52, (q, w, d) => forestRidge(q, w, d, kit), {
    label: '杉岚岭天文台',
    radius: 0.35,
    natural: true,
    focus: 1.16,
  });
  find(7.48, 3.1, 2.07, 0.82, terminal, { label: '拱顶总站', radius: 0.65, focus: 0.39 });
  find(7.44, 4.74, 2.02, 1.26, cityHall, { label: '铜顶议事厅', focus: 0.69 });
  find(2.94, 4.66, 1.63, 0.89, (q) => clockSquare(q, kit), { label: '钟楼长廊', focus: 0.69 });
  find(12.46, 1.44, 1.32, 0.85, foundry, { label: '天车铸造厂', focus: 0.48 });
  find(
    13.65,
    8.9,
    1.39,
    0.77,
    (q) => {
      for (const x of [-0.39, 0.02, 0.43]) kit.marketStall(q, x, 0, 0, 0);
    },
    { label: '东埠市集', focus: 0.19 },
  );
  find(5.14, 8.91, 1.26, 0.7, greenhouse, { label: '南麓温室', focus: 0.25 });
  find(7.82, 5.92, 0.88, 0.82, parkFountain, { label: '市政喷泉', focus: 0.16 });
  // Neighbourhoods each have a different frontage, roof family and floor count.
  const streets = [
    { bounds: [0.0, 4.4, 0.05, 2.75], floors: 2, tone: 2 },
    { bounds: [5.5, 9.42, 0.03, 5.9], floors: 3, tone: 1 },
    { bounds: [10.8, 16.95, 0.09, 2.47], floors: 3, tone: 4 },
    { bounds: [11.0, 16.85, 3.83, 6.24], floors: 2, tone: 6 },
    { bounds: [0.1, 4.7, 3.69, 5.57], floors: 2, tone: 9 },
    { bounds: [0.1, 6.6, 7.15, 10.88], floors: 2, tone: 12 },
    { bounds: [9.94, 16.91, 7.65, 10.9], floors: 2, tone: 3 },
    { bounds: [6.04, 11.9, 5.22, 9.51], floors: 2, tone: 0 },
  ];
  let k = 0;
  for (const district of streets) {
    const [left, right, top, bottom] = district.bounds;
    for (let r = top; r <= bottom; r += 0.8)
      for (let c = left; c <= right; c += 0.8) {
        k++;
        if (k % 7 === 5) continue;
        const cc = c + kit.between(-0.085, 0.085),
          rr = r + kit.between(-0.084, 0.084),
          w = 0.55 + (k % 4) * 0.062,
          d = 0.49 + (k % 3) * 0.051;
        const yaw = faceStreet(cc, rr) + ((k % 3) - 1) * 0.054;
        const n = district.floors + (k % 5 === 0 ? 1 : 0);
        place(
          cc,
          rr,
          Math.max(w, d) + 0.055,
          Math.max(w, d) + 0.045,
          (q) => townhouse(q, w, d, k + district.tone, n, yaw),
          { label: '街屋', margin: 0.017, tone: k % 3 === 0 ? '#b4ab92' : '#a5a791' },
        );
      }
  }
  // Green terraces and promenades fill selected gaps while leaving breathing room in plazas.
  for (let r = 0.1; r < map.depth - 0.5; r += 0.54)
    for (let c = 0.13; c < map.width - 0.5; c += 0.6) {
      const s = kit.rand(),
        w = 0.24 + kit.rand() * 0.13;
      if (!fits(c, r, w, w) || s > 0.53) continue;
      const x = X(c),
        z = Z(r),
        y = height(c, r) + 0.012;
      reserve(c, r, w, w);
      if (water(c, r) < 0.52 || s < 0.14) {
        kit.oak(props, x, y, z, 0.35 + kit.rand() * 0.31);
      } else if (s < 0.23 && r < 4) kit.pine(props, x, y, z, 0.43 + kit.rand() * 0.38);
      else if (s < 0.3) hedge(props, x, y, z, 0.28, 0.14);
      else if (s < 0.4) streetLight(props, x, y, z);
      else {
        props.box(x, y + 0.073, z, 0.2, 0.024, 0.081, '#926c4d');
        props.box(x, y + 0.096, z - 0.03, 0.2, 0.066, 0.016, '#a17d59');
        for (const d of [-0.07, 0.07]) props.box(x + d, y, z, 0.018, 0.082, 0.06, ink);
      }
    }
  // Setts follow the river quays. Isolated slabs sit below the playable road surface.
  for (let c = 0; c < map.width - 0.55; c += 0.18)
    for (const side of [-1, 1]) {
      const r = ctx.channel(c) + side * 0.7,
        y = height(c, r),
        near = ctx.route.some((p) => Math.hypot(p.x - c, p.z - r) < 0.49);
      if (!near && y > 0.09)
        props.box(
          X(c),
          y + 0.003,
          Z(r),
          0.156,
          0.02,
          0.069,
          pick(['#acac97', '#b7b39b', '#a6a992'], Math.floor(c * 6)),
        );
    }
}
