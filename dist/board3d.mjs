import { buildFrontage } from './frontage3d.mjs';
import * as THREE from './vendor/three.module.js';
import { getMap } from './shared/maps.mjs';
import { palette } from './art.mjs';
import { buildWorld } from './world3d.mjs';

const PI = Math.PI;
const TAU = PI * 2;
const HOME_YAW = (-10 * PI) / 180;
const HOME_PITCH = (53 * PI) / 180;
const clamp = THREE.MathUtils.clamp;
const harborLandmarks = [
  { name: '灯塔湾', x: -3.0, y: 1.05, z: -2.17 },
  { name: '蓝礁港', x: 3.67, y: 1.14, z: -2.23 },
  { name: '铜帆埠', x: -3.6, y: 0.74, z: 1.63 },
  { name: '风车原', x: 3.53, y: 0.83, z: 1.64 },
];
function beveledSlab(width, depth, height, corner, bevel) {
  const w = width / 2,
    d = depth / 2,
    r = corner;
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.lineTo(w, -d + r);
  shape.lineTo(w, d - r);
  shape.lineTo(w - r, d);
  shape.lineTo(-w + r, d);
  shape.lineTo(-w, d - r);
  shape.lineTo(-w, -d + r);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelThickness: bevel,
    bevelSize: bevel,
    steps: 1,
  });
  geometry.rotateX(-PI / 2);
  return geometry;
}

function groundTexture(map) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');
  const base = ctx.createRadialGradient(480, 255, 30, 510, 288, 620);
  const tones =
    map.id === 'skyrail'
      ? ['#8fae96', '#87a18d', '#6e8d80']
      : map.id === 'saffron'
        ? ['#d8b782', '#c9a474', '#ba8d62']
        : ['#277f88', '#206673', '#164452'];
  base.addColorStop(0, tones[0]);
  base.addColorStop(0.6, tones[1]);
  base.addColorStop(1, tones[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 576);
  let seed = 707;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 470; i++) {
    const x = random() * 1024,
      y = random() * 576,
      length = 2 + random() * 10;
    ctx.strokeStyle =
      map.id === 'mistport'
        ? i % 3 === 0
          ? '#c3f1df70'
          : '#76c8c458'
        : map.id === 'saffron'
          ? '#f7e2ad61'
          : '#ced9ad53';
    ctx.lineWidth = 1.2 + random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x - length, y + 1);
    ctx.lineTo(x - 2, y - 1);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function boardFurniture(board, map) {
  const { width: w, depth: d } = map;
  const standard = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, flatShading: true });
  function slab(w, d, h, y, color, r = 0.18, b = 0.032) {
    const mesh = new THREE.Mesh(beveledSlab(w, d, h, r, b), standard(color));
    mesh.position.y = y;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    board.add(mesh);
    return mesh;
  }
  slab(w + 0.43, d + 0.43, 0.24, -0.59, '#19383e');
  slab(w + 0.43, d + 0.43, 0.045, -0.335, '#bb9d64');
  slab(w + 0.4, d + 0.4, 0.23, -0.28, '#31555a');
  slab(w + 0.28, d + 0.28, 0.04, -0.078, '#577373');
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: groundTexture(map) }),
  );
  floor.rotation.x = -PI / 2;
  floor.position.y = 0.008;
  board.add(floor);
  return buildFrontage(board, map);
}

function makePawns(board) {
  const bodyGeometry = new THREE.LatheGeometry(
    [
      [0.12, 0],
      [0.15, 0.017],
      [0.155, 0.046],
      [0.14, 0.075],
      [0.105, 0.09],
      [0.077, 0.18],
      [0.061, 0.24],
      [0.091, 0.27],
      [0.096, 0.3],
      [0.066, 0.32],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  const headGeometry = new THREE.IcosahedronGeometry(0.103, 1);
  const bandGeometry = new THREE.CylinderGeometry(0.11, 0.12, 0.028, 12);
  const metal = new THREE.MeshStandardMaterial({
    color: '#f1d39a',
    roughness: 0.5,
    metalness: 0.2,
    flatShading: true,
  });
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.04, flatShading: true });
  return palette.map((color, i) => {
    const token = new THREE.Group(),
      paint = mat(color);
    const body = new THREE.Mesh(bodyGeometry, paint),
      head = new THREE.Mesh(headGeometry, paint),
      band = new THREE.Mesh(bandGeometry, metal);
    head.position.y = 0.368;
    head.rotation.y = i * 0.63;
    band.position.y = 0.079;
    body.castShadow = true;
    head.castShadow = true;
    const bodyGroup = new THREE.Group();
    bodyGroup.add(body, head, band);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 210;
    labelCanvas.height = 56;
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const countBadge = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    countBadge.scale.set(0.36, 0.18, 1);
    countBadge.position.set(0.17, 0.56, 0);
    countBadge.visible = false;
    countBadge.renderOrder = 7;
    let badgeKey = '',
      displayText = '';
    function groupCount(seats, shown, remaining) {
      displayText = [seats.length > 3 ? '×' + seats.length : '', remaining > 0 ? '余' + remaining + '步' : '']
        .filter(Boolean)
        .join(' ');
      const key = shown && displayText ? seats.join('-') + displayText : '';
      bodyGroup.visible = shown;
      countBadge.visible = !!key;
      if (!key || key === badgeKey) {
        badgeKey = key;
        return;
      }
      badgeKey = key;
      const c = labelCanvas.getContext('2d');
      c.clearRect(0, 0, 210, 56);
      c.fillStyle = '#284439';
      c.fillRect(0, 0, 210, 54);
      c.strokeStyle = '#c3d4bd';
      c.lineWidth = 3;
      c.strokeRect(2, 2, 206, 50);
      c.fillStyle = '#fff2ce';
      c.font = 'bold 35px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(displayText, 105, 25, 200);
      seats.forEach((n, k) => {
        c.fillStyle = palette[n % palette.length];
        c.fillRect(4 + (k * 202) / seats.length, 45, 202 / seats.length, 6);
      });
      texture.needsUpdate = true;
    }
    function sizeBadge(unit) {
      if (!countBadge.visible) return;
      const h = Math.max(0.125, (13 * unit) / token.scale.y);
      countBadge.scale.set(h * (displayText.length > 4 ? 3.65 : 2.1), h, 1);
      countBadge.position.set(0.06, 0.64 + h * 0.22, 0);
    }
    token.add(bodyGroup, countBadge);
    token.visible = false;
    board.add(token);
    return { token, groupCount, sizeBadge, id: null, tile: null, path: null };
  });
}

function makeTitleIndicator() {
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.024, 4, 28),
    new THREE.MeshBasicMaterial({ color: '#f8c665' }),
  );
  ring.rotation.x = PI / 2;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.083, 0.11, 4),
    new THREE.MeshBasicMaterial({ color: '#ffdda1' }),
  );
  tip.rotation.z = PI;
  tip.position.y = 0.59;
  marker.add(ring, tip);
  marker.visible = false;
  return marker;
}

// Texture the six physical faces once. A roll rotates its two reported values upward.
function makeDice(board, map) {
  const sheet = document.createElement('canvas');
  sheet.width = 384;
  sheet.height = 64;
  const ctx = sheet.getContext('2d');
  const centers = [
    [[0, 0]],
    [
      [-1, -1],
      [1, 1],
    ],
    [
      [-1, -1],
      [0, 0],
      [1, 1],
    ],
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ],
    [
      [-1, -1],
      [1, -1],
      [0, 0],
      [-1, 1],
      [1, 1],
    ],
    [
      [-1, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [1, 1],
    ],
  ];
  centers.forEach((points, i) => {
    ctx.fillStyle = '#ccac7c';
    ctx.fillRect(i * 64, 0, 64, 64);
    ctx.fillStyle = '#f8e4b8';
    ctx.fillRect(i * 64 + 2, 2, 60, 60);
    ctx.fillStyle = '#334347';
    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(i * 64 + 32 + x * 15, 32 + y * 15, 5.1, 0, TAU);
      ctx.fill();
    }
  });
  const dieTexture = new THREE.CanvasTexture(sheet);
  dieTexture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const uv = geometry.attributes.uv;
  const values = [3, 4, 1, 6, 2, 5];
  values.forEach((value, index) => {
    for (let j = 0; j < 4; j++) {
      const k = index * 4 + j;
      uv.setX(k, (value - 1 + 0.007 + uv.getX(k) * 0.986) / 6);
    }
  });
  const material = new THREE.MeshStandardMaterial({ map: dieTexture, roughness: 0.55 });
  const group = new THREE.Group();
  group.visible = false;
  // In the two city dioramas, the throw clears nearby rooftops.
  if (map.id !== 'mistport') group.position.y = 1.32;
  const dice = [new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)];
  dice.forEach((mesh) => {
    mesh.castShadow = true;
    group.add(mesh);
  });
  const dock = new THREE.Mesh(
    beveledSlab(2.12, 1.14, 0.08, 0.13, 0.025),
    new THREE.MeshStandardMaterial({ color: '#836548', roughness: 0.85 }),
  );
  dock.position.y = 0.075;
  dock.receiveShadow = true;
  group.add(dock);
  board.add(group);
  const normals = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, -1],
    [0, -1, 0],
  ];
  const axis = new THREE.Vector3(0, 1, 0),
    face = new THREE.Vector3();
  const heading = new THREE.Quaternion(),
    spin = new THREE.Quaternion(),
    angles = new THREE.Euler();
  const landing = dice.map(() => new THREE.Quaternion());
  let start = 0,
    instant = false;
  return {
    toss(result, now, reduced) {
      result.forEach((value, i) => {
        face.fromArray(normals[value - 1]);
        landing[i].setFromUnitVectors(face, axis);
        heading.setFromAxisAngle(axis, i ? -0.27 : 0.21);
        landing[i].premultiply(heading);
      });
      start = now;
      instant = reduced;
      group.visible = true;
      group.scale.setScalar(1);
    },
    tick(now) {
      if (!group.visible) return;
      const age = (now - start) / 1000;
      if (age > 2.15) {
        group.visible = false;
        return;
      }
      const phase = instant ? 1 : clamp(age / 0.95, 0, 1);
      const left = 1 - phase;
      const bounce = Math.pow(left, 1.35) * 0.85 + Math.abs(Math.sin(phase * PI * 2.45)) * left * 1.28;
      dice.forEach((mesh, i) => {
        const sign = i ? 1 : -1;
        mesh.position.set(sign * (0.47 + 0.27 * left), 0.48 + bounce, 0.08 * sign - 0.55 * left);
        angles.set(left * PI * 3.1, left * PI * 2.3 * sign, left * PI * 1.1);
        spin.setFromEuler(angles);
        mesh.quaternion.copy(spin).multiply(landing[i]);
      });
      if (!instant && age > 1.96) group.scale.setScalar(Math.max(0.001, (2.15 - age) / 0.19));
    },
  };
}

function seatOffset(index, count) {
  if (count === 1) return [0, -0.08, 1.05];
  const cols = Math.ceil(Math.sqrt(count)),
    rows = Math.ceil(count / cols);
  const lastRow = Math.floor(index / cols) === rows - 1;
  const inRow = lastRow ? count - (rows - 1) * cols : cols;
  return [
    ((index % cols) - (inRow - 1) / 2) * (0.76 / cols),
    (Math.floor(index / cols) - (rows - 1) / 2) * (0.65 / rows),
    Math.min(0.93, 1.75 / Math.sqrt(count)),
  ];
}

export function createBoard3D(canvas, { onTile, onViewChange, mapId = 'mistport' } = {}) {
  const map = getMap(mapId),
    stops = map.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const classic = map.id === 'mistport',
    tileScale = 0.8;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    throw new Error('当前设备无法启用 WebGL 立体棋盘');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setClearColor('#142b36');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const board = new THREE.Group();
  scene.add(board);
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 90);
  const hemi = new THREE.HemisphereLight('#f4fbff', '#a1b9c2', 1.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff7ee', 2.08);
  sun.position.set(-8, 15, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -map.width * 0.63,
    right: map.width * 0.63,
    top: map.depth * 0.9,
    bottom: -map.depth * 0.9,
    near: 0.1,
    far: 40,
  });
  sun.shadow.normalBias = 0.023;
  sun.shadow.bias = -0.00028;
  scene.add(sun);
  const sky = new THREE.DirectionalLight('#b5d8ea', 0.68);
  sky.position.set(5, 5, -8);
  scene.add(sky);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.ShadowMaterial({ opacity: 0.3 }));
  plane.rotation.x = -PI / 2;
  plane.position.y = -0.7;
  plane.receiveShadow = true;
  scene.add(plane);
  const streets = boardFurniture(board, map),
    world = new THREE.Group();
  board.add(world);
  const worldTick = buildWorld(THREE, world, map);
  const pawns = makePawns(board),
    marker = makeTitleIndicator(),
    dice = makeDice(board, map);
  board.add(marker);
  let legalTiles = [],
    affectedTiles = [];
  const ray = new THREE.Raycaster(),
    cursor = new THREE.Vector2(),
    aim = new THREE.Vector3(),
    look = new THREE.Vector3();
  const pan = new THREE.Vector2();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const target = { yaw: HOME_YAW, pitch: HOME_PITCH, zoom: 1 };
  const orbit = { ...target };
  const pointers = new Map();
  let width = 0,
    height = 0,
    aspect = 1,
    disposed = false,
    inside = true,
    raf = 0,
    lastFrame = 0;
  let state = null,
    me = null,
    selected = null,
    follow = false,
    gesture = null,
    hover = null,
    travelClock = 0;
  let deedKey = '',
    previousRoll = null,
    focusY = 0.12;
  canvas.style.touchAction = 'none';

  function emitView() {
    onViewChange?.({ zoom: target.zoom, follow, yaw: target.yaw, pitch: target.pitch });
  }
  function projection() {
    const co = Math.abs(Math.cos(orbit.yaw)),
      si = Math.abs(Math.sin(orbit.yaw));
    const horizontal = (map.width + 0.55) * co + (map.depth + 0.55) * si;
    const vert =
      ((map.width + 0.55) * si + (map.depth + 0.55) * co) * Math.sin(orbit.pitch) +
      1.3 * Math.cos(orbit.pitch);
    const cameraHeight = (Math.max(horizontal / aspect, vert) * 1.065) / orbit.zoom;
    camera.left = (-cameraHeight * aspect) / 2;
    camera.right = (cameraHeight * aspect) / 2;
    camera.top = cameraHeight / 2;
    camera.bottom = -cameraHeight / 2;
    camera.updateProjectionMatrix();
    camera.position.set(
      look.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * 24,
      look.y + Math.sin(orbit.pitch) * 24,
      look.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * 24,
    );
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width),
      h = Math.round(rect.height);
    if (w !== width || h !== height) {
      width = w;
      height = h;
      if (w && h) {
        aspect = w / h;
        renderer.setSize(w, h, false);
        projection();
      }
    }
    requestFrame();
  }
  function requestFrame() {
    if (!disposed && !raf && inside && !document.hidden && width && height)
      raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (disposed || !inside || document.hidden || !width || !height) return;
    const dt = Math.min(0.06, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    travelClock += dt;
    const smooth = reduced ? 1 : 1 - Math.exp(-dt * 13);
    orbit.yaw += (target.yaw - orbit.yaw) * smooth;
    orbit.pitch += (target.pitch - orbit.pitch) * smooth;
    if (typeof worldTick === 'function' && !reduced) worldTick(travelClock);
    dice.tick(now);
    for (const pawn of pawns) {
      if (!pawn.token.visible || !pawn.path) continue;
      const path = pawn.path,
        t = clamp((now - path.start) / path.ms, 0, 1);
      const n = path.points.length - 1,
        k = Math.min(n - 1, Math.floor(t * n)),
        f = t === 1 ? 1 : t * n - k;
      pawn.token.position.lerpVectors(path.points[k], path.points[k + 1], f);
      pawn.token.position.y += Math.sin(f * PI) * path.lift;
      if (t === 1) pawn.path = null;
    }
    if (state) {
      const active = pawns[state.turn]?.token;
      marker.visible = state.phase !== 'finished' && !!active?.visible;
      if (marker.visible) {
        marker.position.copy(active.position);
        marker.position.y += 0.02;
        marker.scale.copy(active.scale);
        marker.children[1].position.y = 0.6 + (reduced ? 0 : Math.sin(travelClock * 4) * 0.035);
      }
    }
    aim.set(pan.x, focusY, pan.y);
    let zoomTarget = target.zoom;
    if (follow && state?.players.length) {
      const local = state.players.findIndex((p) => p.id === me && !p.out);
      const token = pawns[local >= 0 ? local : state.turn]?.token;
      if (token?.visible) {
        aim.x = token.position.x * 0.75;
        aim.z = token.position.z * 0.75;
        aim.y = token.position.y;
        zoomTarget = Math.max(target.zoom, 1.65);
      }
    }
    orbit.zoom += (zoomTarget - orbit.zoom) * smooth;
    look.lerp(aim, smooth);
    projection();
    streets.orient(orbit.yaw);
    for (const pawn of pawns) pawn.sizeBadge((camera.top - camera.bottom) / height);
    renderer.render(scene, camera);
    requestFrame();
  }
  function update(newState, options = {}) {
    state = newState;
    me = options.me ?? me;
    selected = Number.isInteger(options.selected) ? options.selected : null;
    legalTiles = options.legalTiles || [];
    affectedTiles = options.affectedTiles || [];
    showSelection();
    const key = JSON.stringify([
      state?.properties,
      state?.players.map((p) => p.id),
      state?.cardBoard?.marks,
      state?.round,
    ]);
    if (key !== deedKey) {
      deedKey = key;
      streets.update(state);
    }
    const groups = new Map();
    state?.players.forEach((p, i) => {
      if (!p.out) {
        if (!groups.has(p.pos)) groups.set(p.pos, []);
        groups.get(p.pos).push(i);
      }
    });
    const now = performance.now();
    const roll = state?.log.findLast((entry) => entry.type === 'roll');
    const rollKey = roll ? [state.players[0].id, roll.id, roll.playerId].join('/') : '';
    if (previousRoll !== null && rollKey && rollKey !== previousRoll && state.dice.length === 2) {
      dice.toss(state.dice, now, reduced);
    }
    previousRoll = rollKey;
    pawns.forEach((pawn, i) => {
      const player = state?.players[i];
      if (!player || player.out || !stops[player.pos]) {
        pawn.token.visible = false;
        pawn.id = null;
        pawn.tile = null;
        pawn.path = null;
        return;
      }
      const seats = groups.get(player.pos);
      const leader = seats.includes(state.turn)
        ? state.turn
        : (seats.find((n) => state.players[n].id === me) ?? seats[0]);
      pawn.groupCount(
        seats,
        seats.length <= 3 || i === leader,
        i === state.turn && state.phase === 'route' ? state.stepsRemaining : 0,
      );
      const [ox, oz, sc] = seats.length > 3 ? [0, 0, 1] : seatOffset(seats.indexOf(i), seats.length);
      const end = stops[player.pos].clone();
      end.x += ox * tileScale * 0.63;
      end.z += oz * tileScale * 0.63;
      end.y += 0.018;
      const oldTile = pawn.tile;
      if (pawn.id !== player.id || !pawn.token.visible || reduced) {
        pawn.token.position.copy(end);
        pawn.path = null;
      } else if (oldTile !== player.pos) {
        const move = state.lastMove;
        let pathIds =
          move?.playerId === player.id && move.path?.[0] === oldTile && move.path.at(-1) === player.pos
            ? move.path
            : null;
        if (!pathIds && classic) {
          const steps = (player.pos - oldTile + stops.length) % stops.length;
          if (steps <= 15)
            pathIds = Array.from({ length: steps + 1 }, (_, j) => (oldTile + j) % stops.length);
        }
        if (!pathIds || pathIds.some((id) => !stops[id])) {
          pawn.token.position.copy(end);
          pawn.path = null;
        } else {
          const points = [pawn.token.position.clone()];
          // A fork choice can arrive before the preceding animation reaches the junction.
          // Complete the recorded approach first so the pawn follows the roads around corners.
          if (pawn.path) {
            const prior = pawn.path,
              completed = clamp((now - prior.start) / prior.ms, 0, 1);
            points.push(...prior.points.slice(Math.floor(completed * (prior.points.length - 1)) + 1));
          }
          for (const id of pathIds.slice(1, -1)) {
            const p = stops[id].clone();
            p.y += 0.018;
            points.push(p);
          }
          points.push(end);
          pawn.path = { points, start: now, ms: Math.min(2100, 145 * (points.length - 1)), lift: 0.18 };
        }
      } else if (pawn.path) {
        pawn.path.points[pawn.path.points.length - 1] = end;
      } else if (pawn.token.position.distanceToSquared(end) > 0.00001) {
        pawn.path = { points: [pawn.token.position.clone(), end], start: now, ms: 170, lift: 0.025 };
      }
      pawn.token.visible = true;
      pawn.token.scale.setScalar(sc * tileScale);
      pawn.id = player.id;
      pawn.tile = player.pos;
    });
    requestFrame();
  }
  function showSelection() {
    streets.highlight(
      hover ?? selected,
      legalTiles,
      affectedTiles,
      state?.phase === 'route' ? state.routeOptions : [],
    );
  }
  function hit(x, y, touch = false) {
    const rect = canvas.getBoundingClientRect();
    cursor.set(((x - rect.left) / rect.width) * 2 - 1, (-(y - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(cursor, camera);
    const direct = ray.intersectObjects(streets.pickables, false)[0];
    if (direct) return direct.object.userData.titleIds[direct.faceIndex] ?? null;
    let nearest = null,
      best = (touch ? 14 : 6) ** 2;
    for (const [id, p] of stops.entries()) {
      for (const at of [p, map.frontages[id]?.entrance, map.frontages[id]?.center].filter(Boolean)) {
        const projected = new THREE.Vector3(at.x, at.y + 0.05, at.z).project(camera);
        const dx = ((projected.x - cursor.x) * rect.width) / 2,
          dy = ((projected.y - cursor.y) * rect.height) / 2,
          k = dx * dx + dy * dy;
        if (k < best) {
          nearest = id;
          best = k;
        }
      }
    }
    return nearest;
  }
  function rotate(direction) {
    target.yaw += (Math.sign(direction) * PI) / 6;
    emitView();
    requestFrame();
  }
  function zoom(factor) {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    target.zoom = clamp((follow ? Math.max(1.65, target.zoom) : target.zoom) * factor, 0.78, 3.3);
    if (follow && target.zoom < 1.65) follow = false;
    emitView();
    requestFrame();
  }
  function reset() {
    Object.assign(target, { yaw: HOME_YAW, pitch: HOME_PITCH, zoom: 1 });
    orbit.yaw = HOME_YAW + Math.atan2(Math.sin(orbit.yaw - HOME_YAW), Math.cos(orbit.yaw - HOME_YAW));
    follow = false;
    pan.set(0, 0);
    focusY = 0.12;
    emitView();
    requestFrame();
  }
  function getLandmarks() {
    if (disposed) return [];
    const landmarks = world.userData.landmarks ?? (classic ? harborLandmarks : []);
    return landmarks.map(({ name, x, y, z }) => ({ name, x, y: y ?? 0.45, z }));
  }
  function focusLandmark(index) {
    const landmark = getLandmarks()[index];
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.z)) return false;
    follow = false;
    pan.set(landmark.x, landmark.z);
    focusY = landmark.y;
    target.pitch = (44 * PI) / 180;
    target.zoom = 2.25;
    emitView();
    requestFrame();
    return true;
  }
  function focusTile(id, context = 'detail') {
    const node = map.points[id];
    if (disposed || !node) return false;
    const points = [node],
      lot = map.lots[id];
    if (lot) points.push(...lot.corners, { ...lot.center, y: lot.center.y + 0.6 });
    if (context === 'route') {
      for (const to of state?.routeOptions?.length ? state.routeOptions : map.next[id]) {
        points.push(map.points[to]);
        for (const end of map.next[to]) points.push(map.points[end]);
      }
    } else if ((context === 'upgrade' || context === 'buy') && state?.players[state.turn]) {
      points.push(map.points[state.players[state.turn].pos]);
    }
    const center = { x: 0, z: 0, y: 0 };
    for (const k of ['x', 'y', 'z'])
      center[k] = (Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2;
    pan.set(center.x, center.z);
    focusY = center.y + 0.06;
    follow = false;
    target.pitch = ((context === 'route' ? 60 : 47) * PI) / 180;
    if (lot && context !== 'route') {
      const streetYaw = Math.atan2(lot.front.x, lot.front.z) - 0.24;
      target.yaw += Math.atan2(Math.sin(streetYaw - target.yaw), Math.cos(streetYaw - target.yaw));
    }
    const s = Math.sin(target.yaw),
      c = Math.cos(target.yaw),
      sp = Math.sin(target.pitch),
      cp = Math.cos(target.pitch);
    const horizontal = (map.width + 0.55) * Math.abs(c) + (map.depth + 0.55) * Math.abs(s);
    const vertical = ((map.width + 0.55) * Math.abs(s) + (map.depth + 0.55) * Math.abs(c)) * sp + 1.3 * cp;
    const fullHeight = Math.max(horizontal / aspect, vertical) * 1.065;
    const horizontalSpan =
      2 * Math.max(...points.map((p) => Math.abs((p.x - center.x) * c - (p.z - center.z) * s))) + 1.6;
    const verticalSpan =
      2 *
        Math.max(
          ...points.map((p) =>
            Math.abs(-(p.x - center.x) * s * sp - (p.z - center.z) * c * sp + (p.y - center.y) * cp),
          ),
        ) +
      1.3;
    target.zoom = clamp(
      Math.min((fullHeight * aspect) / horizontalSpan, fullHeight / verticalSpan),
      0.78,
      context === 'route' ? 2.35 : 3.05,
    );
    emitView();
    requestFrame();
    return true;
  }
  function setFollow(value) {
    follow = !!value;
    emitView();
    requestFrame();
  }
  function panBy(dx, dy) {
    if (follow) {
      pan.set(aim.x, aim.z);
      focusY = aim.y;
      target.zoom = Math.max(1.65, target.zoom);
      follow = false;
    }
    const unit = (camera.top - camera.bottom) / height;
    const right = -dx * unit,
      near = (-dy * unit) / Math.sin(orbit.pitch);
    const sin = Math.sin(orbit.yaw),
      cos = Math.cos(orbit.yaw);
    pan.x = clamp(pan.x + right * cos + near * sin, -map.width / 2 + 0.3, map.width / 2 - 0.3);
    pan.y = clamp(pan.y - right * sin + near * cos, -map.depth / 2 + 0.3, map.depth / 2 - 0.3);
    emitView();
    requestFrame();
  }
  function down(e) {
    if (e.pointerType === 'mouse' && ![0, 2].includes(e.button)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1)
      gesture = { x: e.clientX, y: e.clientY, drag: false, pinch: false, pan: e.shiftKey || e.button === 2 };
    if (pointers.size === 2) gesture = { drag: true, pinch: true };
    hover = null;
    showSelection();
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) {
      if (!pointers.size && e.pointerType === 'mouse') {
        hover = hit(e.clientX, e.clientY);
        canvas.style.cursor = hover === null ? 'grab' : 'pointer';
        showSelection();
      }
      return;
    }
    const old = pointers.get(e.pointerId),
      dx = e.clientX - old.x,
      dy = e.clientY - old.y;
    const other = [...pointers].find(([id]) => id !== e.pointerId)?.[1];
    if (pointers.size === 2 && other) {
      const before = Math.hypot(old.x - other.x, old.y - other.y),
        after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      panBy(dx * 0.5, dy * 0.5);
      if (before > 8) zoom(after / before);
    } else if (pointers.size === 1 && gesture && !gesture.pinch) {
      if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 5) gesture.drag = true;
      if (gesture.drag) {
        if (gesture.pan || e.shiftKey) panBy(dx, dy);
        else {
          target.yaw -= dx * 0.008;
          target.pitch = clamp(target.pitch + dy * 0.006, 0.53, 1.4);
        }
        canvas.style.cursor = 'grabbing';
        emitView();
        requestFrame();
      }
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function up(e) {
    if (!pointers.delete(e.pointerId)) return;
    const click = e.type === 'pointerup' && gesture && !gesture.drag && !gesture.pan && !pointers.size;
    if (!pointers.size) {
      gesture = null;
      canvas.style.cursor = 'grab';
    }
    if (click) {
      const id = hit(e.clientX, e.clientY, e.pointerType !== 'mouse');
      if (id !== null) onTile?.(id);
    }
  }
  function wheel(e) {
    e.preventDefault();
    zoom(Math.exp(-clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -260, 260) * 0.0015));
  }
  function leave() {
    if (!pointers.size) {
      hover = null;
      showSelection();
    }
  }
  function visibility() {
    if (!document.hidden) {
      lastFrame = performance.now();
      requestFrame();
    }
  }
  const listeners = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
    ['lostpointercapture', up],
    ['pointerleave', leave],
    ['wheel', wheel, { passive: false }],
    ['contextmenu', (e) => e.preventDefault()],
  ];
  listeners.forEach(([name, fn, opts]) => canvas.addEventListener(name, fn, opts));
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    inside = entry.isIntersecting;
    if (inside) {
      lastFrame = performance.now();
      requestFrame();
    }
  });
  intersection.observe(canvas);
  look.set(0, 0.12, 0);
  resize();
  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    observer.disconnect();
    intersection.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    listeners.forEach(([name, fn, opts]) => canvas.removeEventListener(name, fn, opts));
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    scene.traverse((obj) => {
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material)
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
          materials.add(material);
      if (obj.isInstancedMesh) obj.dispose?.();
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    sun.shadow.dispose();
    renderer.dispose();
  }
  return { update, resize, rotate, zoom, reset, setFollow, getLandmarks, focusLandmark, focusTile, dispose };
}
