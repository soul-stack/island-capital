import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  actRoom, authenticateRoom, canTickRoom, generateCode, joinRoom, makeRoom, readRoom, RoomError,
  roomView, tickRoom
} from './rooms.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'
};

function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(JSON.stringify(value));
}

async function jsonBody(req) {
  let length = 0;
  const parts = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 8192) throw new RoomError(413, '请求内容过长');
    parts.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new RoomError(400, '请输入有效的 JSON 对象');
  }
}

function inside(folder, file) {
  const part = relative(folder, file);
  return part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part);
}

function serveFile(req, res, urlPath, staticDir) {
  if (!['GET', 'HEAD'].includes(req.method)) throw new RoomError(405, '此资源仅支持读取');
  let filePath;
  try {
    filePath = decodeURIComponent(urlPath);
  } catch {
    throw new RoomError(400, '地址格式无效');
  }
  if (filePath.includes('\\') || filePath.includes('\0') || filePath.split('/').some(p => p.startsWith('.'))) {
    throw new RoomError(404, '文件不存在');
  }
  const file = resolve(staticDir, '.' + (filePath === '/' ? '/index.html' : filePath));
  if (!inside(staticDir, file) || !existsSync(file)) throw new RoomError(404, '文件不存在');
  const target = realpathSync(file);
  const realRoot = realpathSync(staticDir);
  if (!inside(realRoot, target) || inside(join(realRoot, 'server'), target) || !statSync(target).isFile()) {
    throw new RoomError(404, '文件不存在');
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
    'Content-Length': statSync(target).size, 'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin'
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(target);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export function createRoomServer({
  dataDir = process.env.ROOM_DATA_DIR ?? join(root, '.data', 'rooms'),
  staticDir = join(root, 'dist'),
  now = Date.now,
  autoTick = true
} = {}) {
  const cache = new Map();
  const folder = resolve(dataDir);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  function dataFile(code) {
    return join(folder, code + '.json');
  }
  // There is no await between revision check and commit. Only publish a new
  // in-memory record after a complete snapshot has replaced the previous one.
  function commit(record) {
    const file = dataFile(record.code);
    const temporary = file + '.part';
    writeFileSync(temporary, JSON.stringify(record), { mode: 0o600, flush: true });
    renameSync(temporary, file);
    cache.set(record.code, record);
  }
  function get(code) {
    if (!cache.has(code)) {
      if (!existsSync(dataFile(code))) throw new RoomError(404, '没有找到这个房间');
      const record = JSON.parse(readFileSync(dataFile(code), 'utf8'));
      // Connections from before a restart must first re-establish presence.
      record.seen = {};
      cache.set(code, record);
    }
    const record = cache.get(code);
    if (record.closed) throw new RoomError(404, '房间已关闭');
    return record;
  }
  function advance(record, time) {
    if (!canTickRoom(record, time)) return record;
    const next = structuredClone(record);
    if (!tickRoom(next, time)) return record;
    commit(next);
    return next;
  }
  let timer;
  if (autoTick) {
    timer = setInterval(() => {
      const time = now();
      for (const [code, record] of cache) {
        const lastSeen = Math.max(record.updatedAt, ...Object.values(record.seen));
        if (record.closed || time - lastSeen > 300_000) {
          cache.delete(code);
          continue;
        }
        try {
          advance(record, time);
        } catch (error) {
          console.error('房间自动行棋失败', code, error.message);
        }
      }
    }, 500);
    timer.unref();
  }

  async function route(req, res) {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    if (!urlPath.startsWith('/api/')) {
      return serveFile(req, res, urlPath, resolve(staticDir));
    }
    if (req.method === 'GET' && urlPath === '/api/local-invite') {
      const peer = req.socket.remoteAddress;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) throw new RoomError(404, '没有找到这个接口');
      const base = Object.values(networkInterfaces()).flat().find(net => net?.family === 'IPv4' && !net.internal);
      return sendJson(res, 200, { origin: base ? 'http://' + base.address + ':' + server.address().port : null });
    }
    if (req.method === 'POST' && urlPath === '/api/rooms') {
      const body = await jsonBody(req);
      let code;
      do { code = generateCode(); } while (cache.has(code) || existsSync(dataFile(code)));
      const { record, playerId, token } = makeRoom(code, body, now());
      commit(record);
      return sendJson(res, 201, { room: roomView(record, now()), playerId, token });
    }
    const match = /^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|action))?$/i.exec(urlPath);
    if (!match) throw new RoomError(404, '没有找到这个接口或房间');
    const code = match[1].toUpperCase();
    const operation = match[2];
    if (req.method !== (operation ? 'POST' : 'GET')) throw new RoomError(405, '请求方式有误');
    const body = operation ? await jsonBody(req) : null;
    const record = get(code);
    const time = now();
    if (operation === 'join') {
      const next = structuredClone(record);
      const identity = joinRoom(next, body, time);
      commit(next);
      return sendJson(res, 200, { room: roomView(next, time), ...identity });
    }
    const bearer = /^Bearer ([A-Za-z0-9]+)$/.exec(req.headers.authorization ?? '');
    const id = authenticateRoom(record, bearer?.[1]);
    if (!operation) {
      readRoom(record, id, time);
      const next = advance(record, time);
      return sendJson(res, 200, { room: roomView(next, time) });
    }
    const next = structuredClone(record);
    const snapshot = actRoom(next, id, body.rev, body.action, time);
    commit(next);
    return sendJson(res, 200, { room: snapshot });
  }

  const server = createServer((req, res) => {
    route(req, res).catch(error => {
      if (!(error instanceof RoomError)) console.error('房间服务错误', error.message);
      if (!res.headersSent && !res.destroyed) {
        sendJson(res, error.status ?? 500, { error: error.status ? error.message : '服务器暂时无法保存对局' });
      }
    });
  });
  server.on('close', () => clearInterval(timer));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flag = process.argv.indexOf('--port');
  const port = Number(flag === -1 ? (process.env.PORT ?? 3000) : process.argv[flag + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('端口号无效');
  const server = createRoomServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请使用 --port 指定其他端口。` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    const portInUse = server.address().port;
    console.log('本机游戏   http://localhost:' + portInUse);
    if (process.platform === 'win32' && process.argv.includes('--open')) {
      const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', 'http://localhost:' + portInUse], {
        detached: true, stdio: 'ignore', windowsHide: true
      });
      browser.on('error', () => console.log('请在浏览器打开上面的本机地址。'));
      browser.unref();
    }
    for (const network of Object.values(networkInterfaces()).flat()) {
      if (network && network.family === 'IPv4' && !network.internal) {
        console.log('局域网加入 http://' + network.address + ':' + portInUse);
      }
    }
  });
}
