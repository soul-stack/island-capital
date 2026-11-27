import { applyAction, botAction, createGame, hasGameMap } from './dist/shared/engine.mjs';

// The server persists each change atomically and exposes only roomView() to clients.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_NAMES = ['灯塔守望者', '橘子船长', '白鲸商人', '小岛邮差', '海风水手', '薄荷船长', '蓝帆领航员', '云港画师', '波浪先生', '海螺掌柜', '落日旅人'];
export const OFFLINE_MS = 45_000;
export const BOT_DELAY_MS = 1100;

export class RoomError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new RoomError(status, message);
}

function bytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

function randomId(n) {
  return Array.from(bytes(n), value => value.toString(16).padStart(2, '0')).join('');
}

export function generateCode() {
  return Array.from(bytes(6), value => ALPHABET[value % ALPHABET.length]).join('');
}

function nameOf(value) {
  if (typeof value !== 'string') fail(400, '请输入玩家昵称');
  const name = value.trim();
  if (!name || [...name].length > 16 || /[\u0000-\u001f\u007f]/u.test(name)) {
    fail(400, '昵称需要 1 至 16 个可见字符');
  }
  return name;
}

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(400, `${label}应在 ${min} 至 ${max} 之间`);
  }
  return value;
}

function selectedMap(id) {
  if (!hasGameMap(id)) fail(400, '请选择有效地图');
  return id;
}

function addPlayer(room, name, now, bot = false) {
  const playerId = randomId(12);
  room.players.push({ id: playerId, name, bot });
  if (bot) return { playerId };
  const token = randomId(32);
  room.tokens[playerId] = token;
  room.seen[playerId] = now;
  return { playerId, token };
}

export function makeRoom(code, body, now = Date.now()) {
  const name = nameOf(body?.name);
  const mapId = selectedMap(body.mapId === undefined ? 'skyrail' : body.mapId);
  const record = {
    code, mapId,
    maxPlayers: integer(body.maxPlayers ?? 12, 2, 12, '房间人数'),
    maxRounds: integer(body.maxRounds ?? 40, 1, 150, '回合数'),
    players: [], host: null, game: null, rev: 1, closed: false,
    tokens: {}, seen: {}, nextStepAt: 0, updatedAt: now
  };
  const identity = addPlayer(record, name, now);
  record.host = identity.playerId;
  return { record, ...identity };
}

export function joinRoom(room, body, now = Date.now()) {
  if (room.closed) fail(404, '房间已关闭');
  if (room.game) fail(409, '游戏已经开始，请使用原来的浏览器重连');
  if (room.players.length >= room.maxPlayers) fail(409, '房间已经满员');
  const identity = addPlayer(room, nameOf(body?.name), now);
  changed(room, now);
  return identity;
}

export function authenticateRoom(room, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) fail(401, '玩家身份无效，请重新加入');
  const identity = Object.entries(room.tokens).find(([, secret]) => secret === token);
  if (!identity) fail(401, '这台设备的入场凭据已经失效');
  return identity[0];
}

export function roomView(room, now = Date.now()) {
  const mapId = room.mapId ?? room.game?.mapId ?? 'mistport';
  return {
    code: room.code, host: room.host, maxPlayers: room.maxPlayers, maxRounds: room.maxRounds, mapId,
    players: room.players.map(player => ({
      ...player, online: player.bot || now - (room.seen[player.id] ?? -Infinity) < OFFLINE_MS
    })),
    rev: room.rev, game: room.game && !room.game.mapId ? { ...room.game, mapId } : room.game, closed: room.closed
  };
}

export function readRoom(room, playerId, now = Date.now()) {
  room.seen[playerId] = now;
  return roomView(room, now);
}

function changed(room, now) {
  room.rev += 1;
  room.updatedAt = now;
  room.nextStepAt = now + BOT_DELAY_MS;
}

function leave(room, player, now) {
  delete room.tokens[player.id];
  delete room.seen[player.id];
  if (room.game) {
    player.bot = true;
    room.game.players.find(member => member.id === player.id).bot = true;
  } else {
    room.players = room.players.filter(member => member.id !== player.id);
  }
  if (room.host === player.id) {
    room.host = room.players.find(member => !member.bot)?.id ?? null;
  }
  room.closed = !room.host;
  changed(room, now);
}

function lobbyAction(room, id, action) {
  if (room.game) fail(409, '游戏已经开始');
  if (id !== room.host) fail(403, '只有房主可以设置房间');
  if (action.type === 'setMap') {
    room.mapId = selectedMap(action.mapId);
  } else if (action.type === 'start') {
    if (room.players.length < 2) fail(409, '至少需要两位玩家，可以添加电脑玩家');
    room.game = createGame(room.players, { maxRounds: room.maxRounds, mapId: room.mapId ?? 'mistport' });
  } else if (action.type === 'addBot') {
    if (room.players.length >= room.maxPlayers) fail(409, '房间已经满员');
    const name = BOT_NAMES.find(candidate => !room.players.some(player => player.bot && player.name === candidate));
    addPlayer(room, name, 0, true);
  } else {
    const bot = action.playerId
      ? room.players.find(member => member.id === action.playerId && member.bot)
      : room.players.findLast(member => member.bot);
    if (!bot) fail(400, '请选择一位电脑玩家');
    room.players = room.players.filter(player => player.id !== bot.id);
  }
}

function play(room, id, action) {
  if (!room.game) fail(409, '请等待房主开始游戏');
  try {
    applyAction(room.game, id, action);
  } catch (error) {
    fail(400, error.message);
  }
}

export function actRoom(room, id, rev, action, now = Date.now()) {
  if (room.closed) fail(404, '房间已关闭');
  const player = room.players.find(member => member.id === id && !member.bot);
  if (!player) fail(403, '玩家身份无效');
  if (!Number.isInteger(rev) || rev !== room.rev) fail(409, '棋局刚刚更新，请刷新后重试');
  if (!action || typeof action.type !== 'string') fail(400, '操作格式无效');
  if (action.type === 'leave') {
    leave(room, player, now);
    return roomView(room, now);
  }
  if (['start', 'addBot', 'removeBot', 'setMap'].includes(action.type)) {
    lobbyAction(room, id, action);
  } else {
    play(room, id, action);
  }
  room.seen[id] = now;
  changed(room, now);
  return roomView(room, now);
}

export function canTickRoom(room, now = Date.now()) {
  if (!room.game || room.closed || room.game.phase === 'finished' || now < room.nextStepAt) return false;
  // If the whole table is away the board waits for the first returning person.
  const connected = id => now - (room.seen[id] ?? -Infinity) < OFFLINE_MS;
  if (!room.players.some(member => !member.bot && connected(member.id))) return false;
  const player = room.game.players[room.game.turn];
  return player.bot || !connected(player.id);
}

export function tickRoom(room, now = Date.now()) {
  if (!canTickRoom(room, now)) return false;
  const player = room.game.players[room.game.turn];
  applyAction(room.game, player.id, botAction(room.game));
  changed(room, now);
  return true;
}
