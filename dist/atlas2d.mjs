import { getMap } from './shared/maps.mjs';
import { palette } from './art.mjs';

const cell = 56,
  margin = 13,
  cache = new Map(),
  views = new WeakMap();
const specials = {
  start: '#73ac91',
  chance: '#bb9ed5',
  bonus: '#edc56e',
  shop: '#df9c75',
  tax: '#a9bdc6',
  delay: '#d99183',
};
const specialGlyph = { start: '⚑', chance: '✦', bonus: '◆', shop: '▥', tax: '≡', delay: 'Ⅱ' };
const cx = (column) => margin + (column + 0.5) * cell;
const cz = (row) => margin + (row + 0.5) * cell;
const point = (map, p) => [cx(p.x + (map.width - 1) / 2), cz(p.z + (map.depth - 1) / 2)];
function poly(ctx, points, fill, stroke, weight = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = weight;
    ctx.stroke();
  }
}
function line(ctx, points, stroke, weight) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = weight;
  ctx.stroke();
}
function oval(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function label(ctx, t, x, y, size, color, mono = false) {
  ctx.font = 'bold ' + size + 'px ' + (mono ? 'monospace' : '"Microsoft YaHei","PingFang SC",sans-serif');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
}
function cube(ctx, x, y, w, h, d, tone) {
  const [wall, side, top] = tone;
  poly(
    ctx,
    [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2, y - h],
      [x - w / 2, y - h],
    ],
    wall,
  );
  poly(
    ctx,
    [
      [x + w / 2, y],
      [x + w / 2 + d, y - d * 0.62],
      [x + w / 2 + d, y - h - d * 0.62],
      [x + w / 2, y - h],
    ],
    side,
  );
  poly(
    ctx,
    [
      [x - w / 2, y - h],
      [x + w / 2, y - h],
      [x + w / 2 + d, y - h - d * 0.62],
      [x - w / 2 + d, y - h - d * 0.62],
    ],
    top,
  );
}
function house(ctx, x, y, scale, desert, variant) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const w = 18 + (variant % 4) * 2,
    h = 9 + (variant % 3) * 2;
  oval(ctx, 4, 1, w * 0.76, 4, '#424a3a45');
  cube(ctx, 0, 0, w, h, 6, desert ? ['#d4ae76', '#a9845b', '#ebc995'] : ['#e3d3af', '#a49375', '#f5dec0']);
  if (desert) {
    cube(ctx, 0, -h, w + 2, 2, 6, ['#dfbb86', '#ab8058', '#f0d6a1']);
    if (variant % 4 === 0) {
      oval(ctx, 0, -h - 4, 6, 7, '#619694');
      ctx.fillStyle = '#537c78';
      ctx.fillRect(-7, -h - 4, 14, 3);
    }
    if (variant % 3 === 0) {
      for (let i = 0; i < 4; i++)
        poly(
          ctx,
          [
            [-w / 2 + (i * w) / 4, -4],
            [-w / 2 + ((i + 1) * w) / 4, -4],
            [-w / 2 + ((i + 1) * w) / 4 - 2, 0],
            [-w / 2 + (i * w) / 4 - 2, 0],
          ],
          i % 2 ? '#db9b69' : '#a95045',
        );
    }
  } else {
    const roof = ['#ab6753', '#6f8585', '#b77e53', '#798b78'][variant % 4];
    poly(
      ctx,
      [
        [-w / 2 - 2, -h],
        [-w / 2 + 3, -h - 6],
        [w / 2 + 7, -h - 6],
        [w / 2 + 2, -h],
      ],
      roof,
      '#6d6960',
      1,
    );
    line(
      ctx,
      [
        [-w / 2 + 3, -h - 6],
        [w / 2 + 7, -h - 6],
      ],
      '#d6b39a',
      1.7,
    );
  }
  ctx.fillStyle = '#53665f';
  ctx.fillRect(-w / 2 + 3, -h + 2, 3, 3);
  ctx.fillRect(w / 2 - 6, -h + 2, 3, 3);
  ctx.fillStyle = '#72614e';
  ctx.fillRect(-2, -5, 4, 5);
  ctx.restore();
}
function tree(ctx, x, y, size, desert) {
  oval(ctx, x + 2, y + 1, size * 0.46, size * 0.16, '#40553f40');
  line(
    ctx,
    [
      [x, y],
      [x + 1, y - size * 0.68],
    ],
    desert ? '#9b7d4e' : '#776b4e',
    size * 0.09,
  );
  if (desert) {
    const yy = y - size * 0.67;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      poly(
        ctx,
        [
          [x, yy],
          [x + Math.cos(a) * size * 0.35, yy + Math.sin(a) * size * 0.16 - 3],
          [x + Math.cos(a) * size * 0.56, yy + Math.sin(a) * size * 0.3 + 3],
        ],
        i % 2 ? '#658b60' : '#497756',
      );
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const yy = y - i * size * 0.26;
      poly(
        ctx,
        [
          [x, yy - size * 0.76],
          [x - size * 0.34, yy - size * 0.14],
          [x + size * 0.34, yy - size * 0.14],
        ],
        i ? '#63886b' : '#486e5b',
      );
    }
  }
}
function landmark(ctx, x, y, kind) {
  ctx.save();
  ctx.translate(x, y);
  const tower = kind === 'clock',
    desert = ['palace', 'temple', 'gate', 'bazaar', 'wheel'].includes(kind);
  if (kind === 'wheel') {
    tree(ctx, 9, 8, 20, true);
    ctx.strokeStyle = '#815d40';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++)
      line(
        ctx,
        [
          [Math.cos((i * Math.PI) / 4) * -10, Math.sin((i * Math.PI) / 4) * -10],
          [Math.cos((i * Math.PI) / 4) * 10, Math.sin((i * Math.PI) / 4) * 10],
        ],
        '#936b46',
        2,
      );
  } else if (kind === 'temple') {
    for (let j = 0; j < 4; j++) cube(ctx, 0, -j * 5, 40 - j * 8, 5, 7 - j, ['#b99970', '#a58057', '#ead1a2']);
    cube(ctx, 0, -20, 11, 8, 4, ['#d9b98c', '#ac875e', '#e9cda1']);
  } else if (kind === 'bazaar' || kind === 'market') {
    for (let j = 0; j < 4; j++) house(ctx, (j % 2) * 20 - 10, Math.floor(j / 2) * 10 - 4, 1.05, true, j + 2);
  } else {
    cube(
      ctx,
      0,
      0,
      tower ? 13 : 41,
      tower ? 31 : 14,
      8,
      desert ? ['#d0ac77', '#a88461', '#eacda3'] : ['#d9cab0', '#ad9d81', '#f1dfba'],
    );
    if (kind === 'palace' || kind === 'hall') {
      oval(ctx, 0, -20, 12, 11, desert ? '#5e9692' : '#7fa195');
      ctx.fillStyle = desert ? '#4f8280' : '#658e80';
      ctx.fillRect(-12, -20, 24, 5);
      line(
        ctx,
        [
          [0, -31],
          [0, -36],
        ],
        '#b59a59',
        2,
      );
    } else if (tower) {
      poly(
        ctx,
        [
          [-9, -31],
          [0, -44],
          [10, -34],
          [8, -30],
        ],
        '#6d927e',
      );
      oval(ctx, 0, -24, 4, 4, '#f6e1ac');
      line(
        ctx,
        [
          [0, -26],
          [0, -24],
          [2, -24],
        ],
        '#576358',
        1.4,
      );
    } else if (kind === 'gate') {
      cube(ctx, -16, -12, 8, 12, 4, ['#d2ab78', '#a88360', '#ebc999']);
      cube(ctx, 16, -12, 8, 12, 4, ['#d2ab78', '#a88360', '#ebc999']);
    } else {
      poly(
        ctx,
        [
          [-23, -13],
          [-17, -22],
          [25, -22],
          [23, -14],
        ],
        '#687e81',
      );
      rectWindows(ctx, -16, -10, 6);
    }
    rectWindows(ctx, tower ? -4 : -15, -7, tower ? 2 : 5);
  }
  ctx.restore();
}
function rectWindows(ctx, x, y, n) {
  ctx.fillStyle = '#63716a';
  for (let i = 0; i < n; i++) ctx.fillRect(x + i * 6, y, 3, 4);
}

const river = (c, desert) =>
  desert
    ? 4.98 + 0.65 * Math.sin(c * 0.47 - 0.9) + 0.3 * Math.sin(c * 0.88)
    : 6.65 + 0.82 * Math.sin(c * 0.46 - 0.7) + 0.17 * Math.sin(c * 0.99);
function landscape(ctx, map, w, h) {
  const desert = map.id === 'saffron';
  const tones = desert ? ['#d8ba87', '#b89a74', '#e4cc9e'] : ['#91ac96', '#789685', '#b2bc94'];
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, tones[1]);
  base.addColorStop(0.55, tones[0]);
  base.addColorStop(1, tones[1]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  let seed = desert ? 563 : 419;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 90; i++) {
    const x = random() * w,
      y = random() * h,
      a = 12 + random() * 56,
      b = 5 + random() * 20;
    poly(
      ctx,
      [
        [x - a, y],
        [x - a * 0.6, y - b],
        [x + a * 0.1, y - b * 1.3],
        [x + a, y - b * 0.3],
        [x + a * 0.7, y + b],
        [x - a * 0.45, y + b * 0.7],
      ],
      i % 2 ? '#ffffff0c' : '#384d3d0b',
    );
  }
  const water = [];
  for (let c = -1; c < map.width + 1; c += 0.18) water.push([cx(c), cz(river(c, desert))]);
  ctx.lineCap = 'round';
  line(ctx, water, desert ? '#e6ca96' : '#c9ccac', desert ? 43 : 53);
  line(ctx, water, '#537e7c', desert ? 36 : 45);
  line(ctx, water, desert ? '#80b9ac' : '#83b5b0', desert ? 28 : 35);
  if (desert) {
    line(
      ctx,
      [
        [cx(11.52), cz(4.7)],
        [cx(11.52), cz(7.32)],
      ],
      '#7bb1a0',
      18,
    );
    oval(ctx, cx(11.32), cz(7.32), cell * 1.45, cell * 0.84, '#a0b88c');
    oval(ctx, cx(11.32), cz(7.32), cell * 1.2, cell * 0.65, '#77afa1');
  }
  for (let i = 0; i < 180; i++) {
    const c = random() * map.width - 0.5,
      x = cx(c),
      y = cz(river(c, desert)) + (random() - 0.5) * 23;
    line(
      ctx,
      [
        [x, y],
        [x + 3 + random() * 7, y - 1],
      ],
      '#d0e4cc88',
      1.4,
    );
  }
  const occupied = new Set(
    map.points.map((p) =>
      [Math.round(p.x + (map.width - 1) / 2), Math.round(p.z + (map.depth - 1) / 2)].join(','),
    ),
  );
  const monuments = desert
    ? [
        [11, 9, 'temple'],
        [16.9, 2, 'palace'],
        [3.2, 7, 'bazaar'],
        [11.5, 6.7, 'wheel'],
        [7.7, 4.9, 'gate'],
      ]
    : [
        [7.4, 3.15, 'station'],
        [7.3, 4.65, 'hall'],
        [2.7, 4.62, 'clock'],
        [13.6, 8.98, 'market'],
      ];
  const reserved = map.frontages.filter(Boolean).map((l) => ({
    x: l.center.x + (map.width - 1) / 2,
    z: l.center.z + (map.depth - 1) / 2,
    w: (l.front.x ? l.depth : l.width) / 2,
    d: (l.front.x ? l.width : l.depth) / 2,
  }));
  for (let z = 0; z < map.depth; z++)
    for (let x = 0; x < map.width; x++) {
      if (
        occupied.has([x, z].join(',')) ||
        reserved.some((l) => Math.abs(x - l.x) < l.w + 0.26 && Math.abs(z - l.z) < l.d + 0.26) ||
        Math.abs(z - river(x, desert)) < 0.48 ||
        (desert && ((x - 11.32) / 1.5) ** 2 + ((z - 7.32) / 0.9) ** 2 < 1) ||
        monuments.some(([a, b]) => Math.hypot(x - a, z - b) < 0.85)
      )
        continue;
      const k = random(),
        px = cx(x),
        py = cz(z),
        border = x === 0 || x === map.width - 1 || z === 0 || z === map.depth - 1;
      if (k < 0.37 || (border && k < 0.76)) {
        const count = 2 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++)
          tree(ctx, px + (random() - 0.5) * 33, py + (random() - 0.5) * 21, 13 + random() * 13, desert);
      } else if (k < 0.86) {
        house(ctx, px - 7, py - 3, 0.72 + random() * 0.31, desert, Math.floor(random() * 16));
        house(ctx, px + 8, py + 9, 0.73 + random() * 0.37, desert, Math.floor(random() * 16));
      } else {
        for (let i = 0; i < 6; i++)
          line(
            ctx,
            [
              [px - 13, py - 7 + i * 3],
              [px + 11, py - 10 + i * 3],
            ],
            desert ? '#c19d6e' : '#9aa87f',
            1.5,
          );
      }
    }
  if (!desert) {
    const rail = [
      [cx(5.75), cz(2.4)],
      [cx(9.32), cz(2.4)],
    ];
    line(ctx, rail, '#657978', 8);
    line(ctx, rail, '#b3b9a8', 4);
    for (let c = 5.8; c < 9.32; c += 0.17)
      line(
        ctx,
        [
          [cx(c), cz(2.4) - 4],
          [cx(c), cz(2.4) + 4],
        ],
        '#75817b',
        2,
      );
  }
  for (const [x, z, kind] of monuments) landmark(ctx, cx(x), cz(z), kind);
}

function printRoutes(ctx, map) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  map.next.forEach((targets, from) => {
    const [x, y] = point(map, map.points[from]);
    targets.forEach((to) => {
      const [a, b] = point(map, map.points[to]),
        branch = from >= map.mainCount || to >= map.mainCount;
      const linePts = [
        [x, y],
        [a, b],
      ];
      line(ctx, linePts, branch ? '#815b39' : '#536a63', 15);
      line(ctx, linePts, branch ? '#d39b63' : '#bac0ac', 10);
      const midX = (a + x) / 2,
        midY = (b + y) / 2,
        angle = Math.atan2(b - y, a - x);
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      poly(
        ctx,
        [
          [4, 0],
          [-3, -3],
          [-3, 3],
        ],
        branch ? '#71462c' : '#4a6460',
      );
      ctx.restore();
    });
  });
}
function harbor(ctx, map, w, h) {
  const water = ctx.createLinearGradient(0, 0, w, h);
  water.addColorStop(0, '#558e91');
  water.addColorStop(1, '#2b606d');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < h; row += 23) {
    for (let x = (row * 7) % 85; x < w; x += 85) {
      const y = row + 4 * Math.sin(x * 0.08);
      line(ctx, [[x, y], [x + 7, y + 1], [x + 15, y - 1]], '#a1d1c35a', 1.4);
    }
  }

  // The four islands follow the landmark positions in the 3D harbor.
  const isles = [
    { x: -3.49, z: -1.85, kind: 'lighthouse', grass: '#a9ba89' },
    { x: 3.4, z: -1.83, kind: 'mountain', grass: '#96b39c' },
    { x: -3.49, z: 1.71, kind: 'clock', grass: '#b4ba87' },
    { x: 3.41, z: 1.72, kind: 'windmill', grass: '#b9bd79' },
  ];
  for (const [i, isle] of isles.entries()) {
    const [x, y] = point(map, isle);
    const shore = Array.from({ length: 20 }, (_, j) => {
      const angle = (2 * Math.PI * j) / 20;
      const radius = 1 + 0.08 * Math.sin(3 * angle + i) + 0.07 * Math.cos(5 * angle - i);
      return [Math.cos(angle) * radius * 2.35 * cell, Math.sin(angle) * radius * 1.12 * cell];
    });
    ctx.save();
    ctx.translate(x, y);
    for (const [scale, color] of [[1.1, '#73a9a0'], [1, '#dcc89d'], [0.91, isle.grass]]) {
      poly(ctx, shore.map(([dx, dy]) => [dx * scale, dy * scale]), color);
    }
    for (const [dx, dy, size] of [[-77, -3, 18], [-60, -16, 22], [45, -16, 18], [70, 7, 21]]) {
      tree(ctx, dx, dy, size, false);
    }
    house(ctx, -25, 21, 0.92, false, i);
    house(ctx, 19, 24, 0.81, false, i + 1);
    if (isle.kind === 'mountain') {
      poly(ctx, [[-36, 6], [-6, -42], [28, 6]], '#738988');
      poly(ctx, [[-6, -42], [28, 6], [7, 6]], '#597475');
      poly(ctx, [[-17, -24], [-6, -42], [7, -24], [-1, -28], [-5, -24], [-9, -28]], '#e7eee0');
    } else if (isle.kind === 'lighthouse') {
      cube(ctx, 0, 4, 14, 27, 5, ['#eee3c4', '#c7c2a8', '#f5ecd2']);
      ctx.fillStyle = '#b96850';
      ctx.fillRect(-7, -14, 14, 6);
      cube(ctx, 0, -23, 17, 5, 5, ['#d29f60', '#a47e56', '#985a4b']);
    } else if (isle.kind === 'windmill') {
      cube(ctx, 0, 4, 15, 19, 5, ['#d8bd86', '#b39c77', '#e8cc91']);
      for (let j = 0; j < 4; j++) {
        ctx.save();
        ctx.translate(0, -15);
        ctx.rotate(Math.PI * (0.1 + j / 2));
        poly(ctx, [[0, 0], [2, -23], [6, -23], [5, -10]], '#f2e7c5', '#978568', 1);
        ctx.restore();
      }
    } else {
      landmark(ctx, 0, 3, 'clock');
    }
    ctx.restore();
  }
}
function site(ctx, map, l, deed, owner) {
  const t = map.tiles[l.id],
    desert = map.id === 'saffron',
    [x, z] = point(map, l.center),
    [gx, gz] = point(map, l.entrance),
    [nx, nz] = point(map, map.points[l.id]);
  const w = l.width * cell,
    d = l.depth * cell,
    f = l.front;
  line(
    ctx,
    [
      [nx, nz],
      [gx, gz],
    ],
    '#796f5b',
    8,
  );
  line(
    ctx,
    [
      [nx, nz],
      [gx, gz],
    ],
    desert ? '#ead1a0' : '#d9d4b6',
    5,
  );
  if (map.id === 'skyrail')
    for (const k of [0.62, 0.74, 0.86]) {
      const px = nx + (gx - nx) * k,
        py = nz + (gz - nz) * k;
      line(
        ctx,
        [
          [px - f.z * 2.8, py + f.x * 2.8],
          [px + f.z * 2.8, py - f.x * 2.8],
        ],
        '#879185',
        1,
      );
    }
  ctx.save();
  ctx.translate(x, z);
  ctx.transform(f.z, -f.x, f.x, f.z, 0, 0);
  const rect = (a, b, m, n, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(a, b, m, n);
  };
  rect(-w / 2 + 1, -d / 2 + 2, w, d, '#3d514b61');
  rect(-w / 2, -d / 2, w, d, desert ? '#cfb185' : l.kind === 'industry' ? '#a2aba2' : '#aab995');
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = desert ? '#92714c' : '#728575';
  ctx.beginPath();
  ctx.moveTo(-4, d / 2);
  ctx.lineTo(-w / 2, d / 2);
  ctx.lineTo(-w / 2, -d / 2);
  ctx.lineTo(w / 2, -d / 2);
  ctx.lineTo(w / 2, d / 2);
  ctx.lineTo(4, d / 2);
  ctx.stroke();
  rect(-w / 2 + 2, -d / 2 + 2, w - 4, 2, map.districts[t.district].color);
  rect(-1.7, d / 2 - 5, 3.4, 5, '#e4dbba');
  if (l.kind === 'bank') {
    rect(-11, -7, 22, 10, '#ddd4b2');
    rect(-12, -8, 24, 5, desert ? '#508c84' : '#6b827c');
    for (const dx of [-9, -3, 3, 9]) rect(dx - 1, 1, 2, 4, '#faf0d0');
    rect(-12, 5, 24, 2, '#af985f');
  } else if (!deed) {
    ctx.setLineDash([2, 1.6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = desert ? '#9c8663' : '#859778';
    ctx.strokeRect(-10, -6, 19, 9);
    ctx.setLineDash([]);
    rect(w * 0.25, -d * 0.14, 1.9, 5, '#79654f');
    rect(w * 0.25 - 2, -d * 0.18, 6, 3.3, '#e9d7a6');
    if (l.kind === 'industry') {
      rect(-8, -4, 4, 3, '#a38660');
      rect(-3, -4, 3, 2.5, '#b49565');
    }
  } else {
    const level = deed.level,
      bw = l.kind === 'industry' ? 23 : l.kind === 'shop' ? 21 : 17,
      bh = 10 + level * 1.2;
    rect(-bw / 2 + 1, -bh / 2 + 2, bw, bh, '#686e5e');
    rect(-bw / 2, -bh / 2, bw, bh, desert ? '#e5c690' : '#ddccaa');
    const roofInk =
      l.kind === 'industry' ? '#688281' : l.kind === 'shop' ? (desert ? '#af6e52' : '#71918b') : '#a86b57';
    rect(-bw / 2 - 1, -bh / 2 - 1, bw + 2, bh * 0.66, roofInk);
    rect(-bw / 2, -bh / 2 + 1, bw, 1.2, '#d8bfa0');
    if (level >= 2) rect(-bw / 2 + 2, -bh / 2 - 2, bw * 0.44, bh * 0.43, '#a69c80');
    if (level >= 3) {
      rect(-bw / 2 + 3, -bh / 2 - 4, bw * 0.31, 4, '#627f7c');
      rect(4, -bh / 2 - 4, 2.5, 4, '#725d51');
    }
    rect(-1.6, bh / 2 - 3, 3, 3, '#485e59');
    if (l.kind === 'shop') {
      for (let k = 0; k < 5; k++) rect(-bw / 2 + (k * bw) / 5, 2.8, bw / 5, 2.5, k % 2 ? '#e4c592' : roofInk);
    } else for (const dx of [-6, 4]) rect(dx, 2, 2.5, 1.7, '#578083');
    rect(-w / 2 + 2, d / 2 - 5, 3, 4, owner);
    for (let k = 0; k < level; k++) rect(-w / 2 + 6 + k * 2, d / 2 - 4, 1.3, 2.8, '#faf0d1');
  }
  ctx.restore();
  const labelOffset = Math.max(
    0,
    Math.min(l.depth * 0.34, l.depth / 2 - (Math.abs(f.x) > 0.5 ? 10.5 : 4) / cell),
  );
  const namePos = point(map, { x: l.center.x + f.x * labelOffset, z: l.center.z + f.z * labelOffset });
  ctx.save();
  ctx.translate(...namePos);
  ctx.fillStyle = '#3d5248';
  ctx.fillRect(-9.8, -3.6, 19.6, 7.2);
  label(ctx, t.short, 0, 0.2, 6.6, '#fff1cf');
  ctx.restore();
}
function stop(ctx, map, t) {
  const [x, y] = point(map, map.points[t.id]),
    prop = t.type === 'property',
    fork = map.next[t.id].length > 1,
    r = (prop ? 0.17 : 0.226) * cell;
  oval(ctx, x + 0.7, y + 1.5, r + 1.4, r + 1.4, '#34494365');
  oval(ctx, x, y, r + 0.6, r + 0.6, fork ? '#b78147' : '#50645b');
  oval(
    ctx,
    x,
    y,
    r - 1,
    r - 1,
    prop ? '#f0e9cd' : t.type === 'bank' ? '#e7c983' : specials[t.type] || '#d8d9b3',
  );
  if (prop) {
    label(ctx, String(t.id).padStart(2, '0'), x, y + 0.3, 9.4, '#42574f', true);
  } else {
    label(
      ctx,
      { start: '启', chance: '?', bonus: '奖', shop: '铺', tax: '税', delay: '停', bank: '银' }[t.type],
      x,
      y - 2,
      11.5,
      '#344c45',
    );
    label(ctx, String(t.id).padStart(2, '0'), x, y + 7.1, 6, '#516159', true);
  }
}
const minZoom = 1;
const maxZoom = 8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function paintStatic(ctx, map, w, h) {
  if (map.id === 'mistport') harbor(ctx, map, w, h);
  else landscape(ctx, map, w, h);
  printRoutes(ctx, map);
  for (const lot of map.frontages) if (lot) site(ctx, map, lot, null, null);
  map.tiles.forEach((tile) => stop(ctx, map, tile));
  ctx.strokeStyle = '#314c49';
  ctx.lineWidth = 10;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = '#a3a283';
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, w - 14, h - 14);
}

export function drawMapPreview(canvas, map) {
  const w = map.width * cell + 2 * margin;
  const h = map.depth * cell + 2 * margin;
  canvas.width = 560;
  canvas.height = Math.round(canvas.width * h / w);
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / w, canvas.height / h);
  paintStatic(ctx, map, w, h);
}

function mapPlate(map) {
  const w = map.width * cell + 2 * margin,
    h = map.depth * cell + 2 * margin;
  const plate = document.createElement('canvas');
  plate.width = w * 2;
  plate.height = h * 2;
  const ctx = plate.getContext('2d');
  ctx.scale(2, 2);
  paintStatic(ctx, map, w, h);
  const scene = { w, h, plate };
  cache.set(map.id, scene);
  return scene;
}

// At high magnification reprint the visible roads, title plates and landscape vectors
// in screen resolution. Overscan makes short pans reuse the same raster; keeping just
// one detail surface bounds memory independently of the number of maps and zoom levels.
let detailCrop = null;
function drawStatic(ctx, map, scene, v, density) {
  if (density <= 2) {
    ctx.drawImage(scene.plate, 0, 0, scene.w, scene.h);
    return;
  }
  const w = Math.min(scene.w, v.w * 1.4),
    h = Math.min(scene.h, v.h * 1.4);
  const bucket = 2 * Math.pow(Math.SQRT2, Math.ceil(2 * Math.log2(density / 2)));
  const quality = Math.min(bucket, 4096 / w, 4096 / h, Math.sqrt(9_000_000 / (w * h)));
  if (quality <= 2) {
    ctx.drawImage(scene.plate, 0, 0, scene.w, scene.h);
    return;
  }
  const covered =
    detailCrop &&
    detailCrop.scene === scene &&
    detailCrop.quality >= quality - 0.01 &&
    detailCrop.x <= v.x + 0.01 &&
    detailCrop.y <= v.y + 0.01 &&
    detailCrop.x + detailCrop.w >= v.x + v.w - 0.01 &&
    detailCrop.y + detailCrop.h >= v.y + v.h - 0.01;
  if (!covered) {
    const x = clamp(v.x - (w - v.w) / 2, 0, scene.w - w),
      y = clamp(v.y - (h - v.h) / 2, 0, scene.h - h);
    const plate = detailCrop?.plate || document.createElement('canvas');
    plate.width = Math.ceil(w * quality);
    plate.height = Math.ceil(h * quality);
    const brush = plate.getContext('2d'),
      sx = plate.width / w,
      sy = plate.height / h;
    brush.setTransform(sx, 0, 0, sy, -x * sx, -y * sy);
    paintStatic(brush, map, scene.w, scene.h);
    detailCrop = { scene, quality, x, y, w, h, plate };
  }
  ctx.drawImage(detailCrop.plate, detailCrop.x, detailCrop.y, detailCrop.w, detailCrop.h);
}

function viewAt(mapId, scene, rect, zoom, centerX, centerY) {
  zoom = clamp(zoom, minZoom, maxZoom);
  const pixelsPerUnit = Math.min(rect.width / scene.w, rect.height / scene.h) * zoom;
  const w = Math.min(scene.w, rect.width / pixelsPerUnit),
    h = Math.min(scene.h, rect.height / pixelsPerUnit);
  return {
    mapId,
    x: clamp(centerX - w / 2, 0, scene.w - w),
    y: clamp(centerY - h / 2, 0, scene.h - h),
    w,
    h,
    zoom,
    minZoom,
    maxZoom,
    mapWidth: scene.w,
    mapHeight: scene.h,
    screenWidth: rect.width,
    screenHeight: rect.height,
    pixelsPerUnit,
    offsetX: Math.max(0, (rect.width - w * pixelsPerUnit) / 2),
    offsetY: Math.max(0, (rect.height - h * pixelsPerUnit) / 2),
  };
}

function viewport(map, scene, state, options, rect) {
  const full = viewAt(map.id, scene, rect, 1, scene.w / 2, scene.h / 2),
    manual = options.viewport;
  if (
    manual &&
    (!manual.mapId || manual.mapId === map.id) &&
    [manual.x, manual.y, manual.w, manual.h].every(Number.isFinite) &&
    manual.w > 0 &&
    manual.h > 0
  ) {
    const scale = Math.min(rect.width / manual.w, rect.height / manual.h) / full.pixelsPerUnit;
    return viewAt(
      map.id,
      scene,
      rect,
      Number.isFinite(manual.zoom) ? manual.zoom : scale,
      manual.x + manual.w / 2,
      manual.y + manual.h / 2,
    );
  }
  let id = options.focusTile,
    mode = options.focusContext;
  const current = state.players[state.turn];
  if (
    !Number.isInteger(id) &&
    !options.overview &&
    current &&
    rect.width < 590 &&
    ['buy', 'route'].includes(state.phase)
  ) {
    id = current.pos;
    mode = state.phase;
  }
  if (options.overview || !Number.isInteger(id) || !map.points[id]) return full;
  const points = [map.points[id], ...(map.frontages[id]?.corners || [])];
  if (mode === 'route')
    for (const to of state.routeOptions?.length ? state.routeOptions : map.next[id]) {
      points.push(map.points[to]);
      for (const u of map.next[to]) points.push(map.points[u]);
    }
  if ((mode === 'buy' || mode === 'upgrade') && current) points.push(map.points[current.pos]);
  const xs = points.map((p) => point(map, p)[0]),
    ys = points.map((p) => point(map, p)[1]);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const zoom = Math.min(
    mode === 'route' ? 1 / 0.38 : 1 / 0.32,
    rect.width / (right - left + cell * 1.8) / full.pixelsPerUnit,
    rect.height / (bottom - top + cell * 1.7) / full.pixelsPerUnit,
  );
  return viewAt(map.id, scene, rect, zoom, (left + right) / 2, (top + bottom) / 2);
}

/** Logical atlas coordinates plus the CSS-pixel scale and letterbox insets of the last draw. */
export function getAtlasView(canvas) {
  const v = views.get(canvas)?.v;
  return v ? { ...v } : null;
}

// Convert through the remembered backing-store layout in case CSS resized the canvas
// between a pointer event and ResizeObserver's redraw.
function atlasPoint(v, rect, clientX, clientY) {
  const x = ((clientX - rect.left) * v.screenWidth) / rect.width;
  const y = ((clientY - rect.top) * v.screenHeight) / rect.height;
  return { x: v.x + (x - v.offsetX) / v.pixelsPerUnit, y: v.y + (y - v.offsetY) / v.pixelsPerUnit };
}

/** Move the feature under the first client point to the second while applying a relative zoom. */
export function transformAtlasView(canvas, fromClientX, fromClientY, toClientX, toClientY, scale = 1) {
  const previous = views.get(canvas)?.v,
    rect = canvas.getBoundingClientRect();
  if (
    !previous ||
    !rect.width ||
    !rect.height ||
    ![fromClientX, fromClientY, toClientX, toClientY, scale].every(Number.isFinite) ||
    scale <= 0
  )
    return null;
  const anchor = atlasPoint(previous, rect, fromClientX, fromClientY);
  const scene = { w: previous.mapWidth, h: previous.mapHeight };
  const next = viewAt(previous.mapId, scene, rect, previous.zoom * scale, 0, 0);
  const x = clamp(anchor.x, 0, scene.w) - (toClientX - rect.left - next.offsetX) / next.pixelsPerUnit;
  const y = clamp(anchor.y, 0, scene.h) - (toClientY - rect.top - next.offsetY) / next.pixelsPerUnit;
  return { ...next, x: clamp(x, 0, scene.w - next.w), y: clamp(y, 0, scene.h - next.h) };
}

function glow(ctx, map, id, color) {
  if (!Number.isInteger(id) || !map.points[id]) return;
  const p = point(map, map.points[id]),
    l = map.frontages[id];
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(...p, cell * 0.255, 0, Math.PI * 2);
  ctx.stroke();
  if (l) {
    line(ctx, [p, point(map, l.entrance)], color, 2.5);
    poly(
      ctx,
      l.corners.map((k) => point(map, k)),
      null,
      color,
      2.3,
    );
  }
}
function cardMark(ctx, map, id, mark) {
  const p = map.points[id],
    q = map.points[map.next[id][0]],
    [x, y] = point(map, p);
  ctx.save();
  ctx.translate(x + (q.x - p.x) * cell * 0.22, y + (q.z - p.z) * cell * 0.22);
  if (mark.kind === 'barrier') {
    ctx.rotate(Math.atan2(q.z - p.z, q.x - p.x) + Math.PI / 2);
    ctx.fillStyle = '#384943';
    ctx.fillRect(-10, -3, 20, 6);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f3d48c' : '#af6251';
      ctx.fillRect(-9 + i * 3, -2, 3, 4);
    }
  } else if (mark.kind === 'bondgate') {
    ctx.fillStyle = '#765a3c';
    ctx.fillRect(-8, -4, 2.5, 11);
    ctx.fillRect(5.5, -4, 2.5, 11);
    ctx.fillStyle = '#d9ad58';
    ctx.fillRect(-9, -6, 18, 5);
    oval(ctx, 0, -3, 5.5, 5.5, '#f8d989');
    label(ctx, '桥', 0, -3, 8, '#644b31');
  } else if (mark.kind === 'redirector') {
    poly(
      ctx,
      [
        [-8, 0],
        [-2, -6],
        [6, -6],
        [8, 0],
        [4, 6],
        [-2, 6],
      ],
      '#bc9ad6',
      '#695075',
      1.5,
    );
    label(ctx, '弹', 1, 0, 8, '#42384c');
  } else if (mark.kind === 'shuttle') {
    ctx.fillStyle = '#eee4c5';
    ctx.fillRect(-5, -7, 10, 7);
    poly(
      ctx,
      [
        [-9, -1],
        [9, -1],
        [5, 5],
        [-5, 5],
      ],
      '#62b9c5',
      '#376d7c',
      1.4,
    );
    label(ctx, '渡', 0, -3, 8, '#274c59');
  } else {
    const [char, paint] = { toll: ['费', '#eac466'], slip: ['滑', '#8bcbd4'], stop: ['停', '#de9887'] }[
      mark.kind
    ] || ['·', '#ccc5a8'];
    ctx.fillStyle = '#45544a';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = paint;
    ctx.fillRect(-4, -4, 8, 8);
    label(ctx, char, 0, 0.3, 7.3, '#3c4941');
  }
  ctx.restore();
}
export function drawAtlas(canvas, state, options = {}) {
  const map = getMap(state.mapId),
    scene = cache.get(map.id) || mapPlate(map),
    r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1),
    w = Math.round(r.width * ratio),
    h = Math.round(r.height * ratio);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const v = viewport(map, scene, state, options, r),
    ctx = canvas.getContext('2d');
  const sx = w / r.width,
    sy = h / r.height,
    px = v.pixelsPerUnit;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#162d35';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.setTransform(sx * px, 0, 0, sy * px, sx * (v.offsetX - v.x * px), sy * (v.offsetY - v.y * px));
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  drawStatic(ctx, map, scene, v, Math.max(sx, sy) * px);
  for (const [id, deed] of Object.entries(state.properties || {})) {
    const lot = map.lots[id],
      index = state.players.findIndex((p) => p.id === deed.owner);
    if (lot && index >= 0) site(ctx, map, lot, deed, palette[index % palette.length]);
  }
  for (const [id, mark] of Object.entries(state.cardBoard?.marks || {}))
    if (map.points[id] && state.round < mark.until) cardMark(ctx, map, Number(id), mark);
  for (const [ids, color] of [
    [options.legalTiles, '#58f0ce'],
    [options.affectedTiles, '#f3a161'],
    [state.phase === 'route' ? state.routeOptions : [], '#28e2c6'],
    [[options.selected], '#ffdd7e'],
  ])
    for (const id of ids || []) glow(ctx, map, id, color);
  const groups = new Map();
  state.players.forEach((p, i) => {
    if (!p.out && map.points[p.pos]) {
      if (!groups.has(p.pos)) groups.set(p.pos, []);
      groups.get(p.pos).push(i);
    }
  });
  for (const [pos, participants] of groups) {
    const [x, y] = point(map, map.points[pos]),
      active = participants.includes(state.turn) ? state.turn : participants[0];
    if (participants.length > 3) {
      for (let k = 0; k < Math.min(3, participants.length); k++) {
        const a = Math.PI * (0.22 + 0.24 * k);
        oval(ctx, x + Math.cos(a) * 8, y + Math.sin(a) * 6, 2.8, 2.8, palette[participants[k]]);
      }
    }
    const step =
      participants.includes(state.turn) && state.phase === 'route' && state.stepsRemaining > 0
        ? '余' + state.stepsRemaining + '步'
        : '';
    const caption = [participants.length > 3 ? '×' + participants.length : '', step]
      .filter(Boolean)
      .join(' ');
    if (caption) {
      const unit = Math.max(0.55, 1 / v.pixelsPerUnit),
        bw = (caption.length > 4 ? 48 : 23) * unit,
        bh = 12 * unit;
      ctx.fillStyle = '#254339';
      ctx.fillRect(x - bw / 2, y - 8 - bh, bw, bh);
      label(ctx, caption, x, y - 8 - bh / 2, 8.7 * unit, '#f4efce');
    }
    const display = participants.length > 3 ? [active] : participants;
    display.forEach((i, j) => {
      const px = x + (j - (display.length - 1) / 2) * 5,
        py = y - 2;
      poly(
        ctx,
        [
          [px, py - 6],
          [px + 3.5, py - 3.7],
          [px + 2, py],
          [px + 4.8, py + 4],
          [px - 4.8, py + 4],
          [px - 2, py],
          [px - 3.5, py - 3.7],
        ],
        palette[i % palette.length],
        '#243a35',
        1.2,
      );
      if (i === state.turn && state.phase !== 'finished')
        poly(
          ctx,
          [
            [px - 3, py - 11],
            [px + 3, py - 11],
            [px, py - 7],
          ],
          '#ffe7a1',
          '#685f44',
          0.7,
        );
    });
  }
  ctx.restore();
  views.set(canvas, { map, v });
}
export function hitAtlas(canvas, clientX, clientY) {
  const view = views.get(canvas);
  if (!view) return null;
  const { map, v } = view,
    r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const { x, y } = atlasPoint(v, r, clientX, clientY);
  if (x < v.x || y < v.y || x > v.x + v.w || y > v.y + v.h) return null;
  const world = { x: (x - margin) / cell - map.width / 2, z: (y - margin) / cell - map.depth / 2 };
  for (const l of map.frontages)
    if (l) {
      const dx = world.x - l.center.x,
        dz = world.z - l.center.z;
      if (
        Math.abs(dx * l.front.z - dz * l.front.x) <= l.width / 2 &&
        Math.abs(dx * l.front.x + dz * l.front.z) <= l.depth / 2
      )
        return l.nodeId;
    }
  let near = null,
    best = r.width < 570 ? 12 ** 2 : 6 ** 2;
  for (const [id, p] of map.points.entries()) {
    const [a, b] = point(map, p),
      d = (a - x) ** 2 + (b - y) ** 2;
    if (d < (cell * 0.235) ** 2) return id;
    const sites = [p, map.frontages[id]?.entrance].filter(Boolean);
    for (const s of sites) {
      const [sx, sy] = point(map, s),
        metric =
          (((sx - x) * v.pixelsPerUnit * r.width) / v.screenWidth) ** 2 +
          (((sy - y) * v.pixelsPerUnit * r.height) / v.screenHeight) ** 2;
      if (metric < best) {
        best = metric;
        near = id;
      }
    }
  }
  return near;
}
