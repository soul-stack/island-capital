const paths = {
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zm-9 5 9 5 9-5m-9 5v10"/>',
  orbit:
    '<path d="M7 8c-4 1-6 4-4 6 3 4 16 3 18-2 1-2-1-4-4-5"/><circle cx="12" cy="10" r="3"/><path d="m4 9 3-1-1 4"/>',
  'left-turn': '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  'right-turn': '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  minus: '<path d="M4 12h16"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  case: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12q9 5 18 0m-9 0v3"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15"/>',
  network:
    '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m11 7-5 9m7-9 5 9M8 18h8"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M2 20v-2c0-6 14-6 14 0v2M16 4a3 3 0 0 1 0 6m2 4c3 0 4 2 4 5"/>',
  repeat: '<path d="M3 10a8 8 0 0 1 14-6l3 3m0-5v5h-5M21 14a8 8 0 0 1-14 6l-3-3m0 5v-5h5"/>',
  map: '<path d="m2 5 6-3 8 4 6-3v16l-6 3-8-4-6 3zM8 3v15m8-12v15"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  radio:
    '<circle cx="12" cy="12" r="2"/><path d="M8 7a7 7 0 0 0 0 10m8-10a7 7 0 0 1 0 10M5 4a11 11 0 0 0 0 16M19 4a11 11 0 0 1 0 16"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 7.5h.1m4.4 4.5h.1m4.4 4.5h.1" stroke-width="3"/>',
  bag: '<path d="M5 8h14l2 12H3zM8 8V6a4 4 0 0 1 8 0v2M9 13h6"/>',
  x: '<path d="m5 5 14 14M19 5 5 19"/>',
  anchor:
    '<circle cx="12" cy="5" r="2"/><path d="M12 7v14m-5-10h10M3 14l1 4 2-3m15-1-1 4-2-3M4 17q8 8 16 0"/>',
  pin: '<path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="m12 8 2.5 4-2.5 4-2.5-4z"/>',
  shield: '<path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  boost: '<path d="m13 3-3 12h10zM9 6 3 16h4zm-7 12h19l-4 3H6z"/>',
  permit: '<path d="m3 8 14-5 4 12-14 5-1-3c3-1 2-4-1-4zM13 7l2 6"/>',
  flag: '<path d="M5 22V3m0 1c6-5 9 5 15 0v10c-6 5-9-5-15 0"/>',
  bot: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M12 7V3m-5 9h1m8 0h1m-8 4h6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  home: '<path d="m2 11 10-8 10 8M5 9v12h14V9m-9 12v-7h4v7"/>',
  star: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
};
export function icon(name) {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (paths[name] || '') +
    '</svg>'
  );
}
export const palette = [
  '#efba67',
  '#75c6b2',
  '#e38c7a',
  '#aaa1dc',
  '#86a8df',
  '#b7c978',
  '#d691b5',
  '#64b3cf',
  '#eaa06b',
  '#90cdaa',
  '#aebbd0',
  '#d4a77c',
];
export function brandArt() {
  return '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" shape-rendering="crispEdges"><path fill="#e9b96b" d="m20 1 17 9v4l-17 9L3 14v-4z"/><path fill="#f9d797" d="m20 3 13 7-13 7-13-7z"/><path fill="#936840" d="m20 17 17-8v5l-17 9z"/><path fill="#b7874a" d="M3 10l17 8v5L3 14z"/><path fill="#8ba984" d="m3 17 17 9 17-9v5l-17 9-17-9z"/><path fill="#4c8073" d="m20 26 17-9v5l-17 9z"/><path fill="#dfa95b" d="m3 25 17 9 17-9v4l-17 10-17-10z"/><path fill="#48664f" d="m15 9 4-3 5 2-4 3z"/></svg>';
}
// Pixel pawns mirror the four crews shown on the game table.
const portraits = [
  [
    '     nnnnnn     ',
    '   nnbbbbbbn    ',
    '  nbwwwwwwbbn   ',
    '  nwwyywwwwwbn  ',
    '   nnnnnnnnnn   ',
    '   nhsssssshn   ',
    '   nssnssnsnn   ',
    '   nsskssksn    ',
    '    nssttssn    ',
    '    nhwttwhn    ',
    '   nnwwwwwwnn   ',
    '  nbbnwwwwnbbn  ',
    ' nbkbbnwwnbbkbn ',
    ' nbkbbbvvbbbkbn ',
  ],
  [
    '                ',
    '   nnn    nnn   ',
    '  ngggn  ngggn  ',
    ' ngwwggnnggwwgn ',
    ' ngwnwgggggwnwn ',
    ' nggggggggggggn ',
    '  ngllggggllgn  ',
    ' ngggppggggppgn ',
    ' nggggnnnnggggn ',
    '  nnggllllggnn  ',
    '    nlllllln    ',
    '   nnbbyybbnn   ',
    '  nbbbyyybbbbn  ',
    ' nbbbbbbbbbbbbn ',
  ],
  [
    '  nn        nn  ',
    '  nonn    nnon  ',
    '  noton  noton  ',
    '  nottnoontton  ',
    '  nooooooooon   ',
    ' nootooootooon  ',
    ' nootnooontoon  ',
    '  nooooooooon   ',
    '  nowwoooowwn   ',
    '   nwwwkkwwn    ',
    '    nwwkkwn     ',
    '    nnyyynn     ',
    '   nooyyyoonn   ',
    '  noooooooooon  ',
  ],
  [
    '  nn        nn  ',
    '  nvnn    nnvn  ',
    '  nvptnnnntpvn  ',
    '  nvppvvvvpvvn  ',
    '  nvvvvvvvvvvn  ',
    '  nvvllvvllvvn  ',
    '  nvvknvvnkvvn  ',
    '  nvvppvvppvvn  ',
    '  nvvvsttsvvvn  ',
    '   nvsskkssvn   ',
    '    nssvvssn    ',
    '   nnbbwwbbnn   ',
    '  nvvbbwwbbvvn  ',
    ' nvvvbbbbbbvvvn ',
  ],
];
const inks = {
  n: '#263538',
  b: '#426076',
  w: '#f0ead1',
  y: '#f0bb62',
  h: '#976c4e',
  s: '#e5b58a',
  k: '#24383a',
  t: '#bf876d',
  v: '#8a82aa',
  g: '#79ab7c',
  l: '#accc8b',
  p: '#d6a19b',
  o: '#ce8055',
};
export function avatar(index) {
  const cells = portraits[Math.max(0, index) % 4];
  let rects = '';
  cells.forEach((line, j) =>
    [...line].forEach((c, i) => {
      if (inks[c])
        rects += '<rect x="' + i + '" y="' + (j + 2) + '" width="1" height="1" fill="' + inks[c] + '"/>';
    }),
  );
  return (
    '<svg class="avatar" style="--pawn:' +
    palette[index % palette.length] +
    '" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect width="16" height="16" fill="currentColor"/>' +
    rects +
    '</svg>'
  );
}
const pipPositions = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.28, 0.28],
    [0.28, 0.72],
    [0.72, 0.28],
    [0.72, 0.72],
  ],
  5: [
    [0.24, 0.24],
    [0.24, 0.76],
    [0.5, 0.5],
    [0.76, 0.24],
    [0.76, 0.76],
  ],
  6: [
    [0.27, 0.22],
    [0.27, 0.5],
    [0.27, 0.78],
    [0.73, 0.22],
    [0.73, 0.5],
    [0.73, 0.78],
  ],
};
function cube(x, y, top, left, right) {
  const face = (points, color) => '<polygon points="' + points + '" fill="' + color + '"/>';
  function pips(val, ox, oy, ux, uy, vx, vy) {
    return pipPositions[val]
      .map(([a, b]) => {
        const cx = ox + a * ux + b * vx,
          cy = oy + a * uy + b * vy;
        return face(
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]
            .map(
              ([i, j]) =>
                (cx + (i * ux + j * vx) * 0.075).toFixed(1) +
                ',' +
                (cy + (i * uy + j * vy) * 0.075).toFixed(1),
            )
            .join(' '),
          '#354348',
        );
      })
      .join('');
  }
  return (
    '<g transform="translate(' +
    x +
    ' ' +
    y +
    ')">' +
    face('1,19 24,6 50,19 49,44 25,58 1,44', '#20343a') +
    face('1,15 25,2 49,15 25,29', '#f8eac8') +
    face('1,15 25,29 25,54 1,40', '#d9c2a0') +
    face('25,29 49,15 49,40 25,54', '#b29575') +
    '<path d="m2 15 23 13 23-13m-23 14v23" fill="none" stroke="#fff3d4" stroke-width="1"/>' +
    pips(top, 25, 2, 24, 13, -24, 13) +
    pips(left, 1, 15, 24, 14, 0, 25) +
    pips(right, 25, 29, 24, -14, 0, 25) +
    '</g>'
  );
}
export function diceArt(a = 3, b = 5) {
  return (
    '<svg class="dice-art" viewBox="0 0 206 94" aria-hidden="true" shape-rendering="crispEdges"><path d="m52 63 30-13 41 14-31 14zM97 72l31-13 38 14-28 13z" fill="#172b30"/><g fill="#91a191"><path d="M30 37h2v6h-2zm-2 2h6v2h-6zm139 9h2v8h-2zm-3 3h8v2h-8z"/></g><g fill="#dbb875"><path d="M45 57h3v3h-3zm104-37h2v8h-2zm-3 3h8v2h-8z"/></g>' +
    cube(53, 11, a, 2, 4) +
    cube(104, 23, b, 3, 2) +
    '</svg>'
  );
}
