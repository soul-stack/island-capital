import { createGame, applyAction, botAction, ensureEconomy, financeSummary } from './shared/engine.mjs';
import { cardCanUse, initCards } from './cards.mjs';
import { quickBag, targetOptions, targetTileIds, previewBar, statusText } from './card-table.mjs';
import { getMap } from './shared/maps.mjs';
import { drawAtlas, drawMapPreview } from './atlas2d.mjs';
import { createAtlasNavigation } from './atlas-navigation.mjs';
import { orderedPacks, packCards, routeChoices } from './packs.mjs';
import { details } from './details.mjs';
import { avatar, brandArt, diceArt, icon, palette } from './art.mjs';

const $ = (id) => document.getElementById(id);
const dialog = $('modal'),
  canvas = $('board');
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const num = (value) => Number(value).toLocaleString('en-US');
const pad = (n) => String(n).padStart(2, '0');
const practiceKey = 'mistport.practice.v1',
  roomKey = 'mistport.room.v1',
  lastSeatKey = 'mistport.lastSeat.v1';
function saved(store, key) {
  try {
    return JSON.parse(store.getItem(key));
  } catch {
    return null;
  }
}
function save(store, key, data) {
  try {
    data === null ? store.removeItem(key) : store.setItem(key, JSON.stringify(data));
  } catch {
    /* Private browsing can disable storage. */
  }
}
function newPractice(mapId = 'skyrail') {
  return createGame(
    ['港湾船长', '青芽水手', '赤尾商人', '星夜领航员'].map((name, i) => ({
      id: 'crew-' + i,
      name,
      bot: i > 0,
    })),
    { maxRounds: 30, mapId },
  );
}
let practice = saved(localStorage, practiceKey);
if (
  !practice?.players?.length ||
  !Array.isArray(practice.log) ||
  !getMap(practice.mapId || 'mistport').tiles[practice.players[0]?.pos]
)
  practice = newPractice();
function savePractice() {
  save(localStorage, practiceKey, practice);
  save(localStorage, practiceKey + '.' + (practice.mapId || 'mistport'), practice);
}
// Original ring boards have stable stop IDs even when their saves predate map packs.
if (!practice.mapId) {
  practice.mapId = 'mistport';
  savePractice();
}
let identity = saved(sessionStorage, roomKey),
  room = null,
  page = null,
  selected = null;
let localTimer,
  rollTimer,
  toastTimer,
  botBusy = false,
  sending = false,
  checking = false,
  offline = false;
let animation = null,
  audioContext = null,
  sounds = saved(localStorage, 'mistport.sound') === true;
let sandbox = null,
  viewMode = '2d',
  viewRequest = 0,
  sceneKey = '',
  sceneMapId = null,
  createScene = null;
let lobbyTab = 'create',
  draftMapId = practice.mapId || 'mistport',
  inviteBase = location.origin,
  nameDraft = saved(localStorage, 'mistport.nick') || '';
let inviteCode = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
if (inviteCode) lobbyTab = 'join';
let waitingPreview = null;
let cardDraft = null;
let cameraPrompt = '';
ensureEconomy(practice);
initCards(practice);
function game() {
  if (!room) return practice;
  if (room.game) return room.game;
  if (waitingPreview?.code !== room.code || waitingPreview?.rev !== room.rev) {
    const mapId = room.mapId || 'mistport';
    waitingPreview = {
      ...practice,
      code: room.code,
      rev: room.rev,
      mapId,
      turn: 0,
      round: 1,
      phase: 'waiting',
      maxRounds: room.maxRounds,
      properties: {},
      log: [],
      dice: [],
      lastMove: null,
      eventSeq: 0,
      players: room.players.map((p) => ({ ...p, pos: 0, cash: 15000, out: false, items: {} })),
    };
  }
  return waitingPreview;
}
const activeMap = () => getMap(game().mapId || 'mistport');
const myId = () => (room ? identity?.playerId : practice.players[0].id);
const current = () => game().players[game().turn];
const waiting = () => !!room && !room.game;
const ownTurn = () =>
  !waiting() && current().id === myId() && !current().out && !current().bot && game().phase !== 'finished';
const coin = '<span class="goldcoin" aria-hidden="true"></span>';
function previewOptions() {
  return cardDraft ? targetOptions(game(), myId(), cardDraft.item) : [];
}
function boardOptions(s) {
  const options = previewOptions();
  const choice = cardDraft && options[cardDraft.index];
  return {
    selected,
    me: myId(),
    legalTiles: cardDraft
      ? [...new Set(options.flatMap((o) => targetTileIds(s, cardDraft.item, o)))]
      : s.phase === 'route'
        ? s.routeOptions
        : [],
    affectedTiles: choice?.tiles || [],
  };
}
function boardClick(id) {
  if (!cardDraft) return showPage('tile', id);
  const options = previewOptions();
  const hits = options
    .map((choice, i) => (targetTileIds(game(), cardDraft.item, choice).includes(id) ? i : -1))
    .filter((i) => i >= 0);
  if (!hits.length) return announce('请选择带绿色标记的目标，或在列表中选择。');
  cardDraft.index = hits[0];
  renderCardPreview();
  repaintBoard();
  if (hits.length > 1) announce('此处对应多个选项，可在目标列表中切换后确认。');
}
function renderCardPreview() {
  if (cardDraft && (!ownTurn() || !cardCanUse(game(), myId(), cardDraft.item))) cardDraft = null;
  const bar = $('card-preview');
  bar.hidden = !cardDraft;
  bar.innerHTML = cardDraft ? previewBar(game(), current(), cardDraft, previewOptions()) : '';
}
function selectCard(item) {
  if (!ownTurn() || !cardCanUse(game(), myId(), item)) return announce('当前无法使用这张卡。');
  const options = targetOptions(game(), myId(), item);
  if (!options.length) return announce('棋盘上暂时没有合法目标。');
  closeDialog();
  cardDraft = { item, index: options.length === 1 ? 0 : -1 };
  renderTurn();
  renderCardPreview();
  repaintBoard();
  $('card-preview').scrollIntoView({ block: 'nearest' });
  $('card-target')?.focus({ preventScroll: true });
}
function announce(message) {
  const el = $('toast');
  if (dialog.open) {
    let feedback = $('dialog-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'dialog-feedback';
      feedback.setAttribute('role', 'status');
      $('modal-body').append(feedback);
    }
    feedback.className = 'help';
    feedback.textContent = message;
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function sound(tone = 380) {
  if (!sounds) return;
  try {
    audioContext ??= new AudioContext();
    audioContext.resume().catch(() => {});
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(tone, audioContext.currentTime);
    o.frequency.exponentialRampToValueAtTime(tone * 1.32, audioContext.currentTime + 0.09);
    g.gain.setValueAtTime(0.055, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.14);
    o.connect(g).connect(audioContext.destination);
    o.start();
    o.stop(audioContext.currentTime + 0.15);
  } catch {
    /* Audio is optional. */
  }
}
function updateSound() {
  const t = sounds ? '关闭音效' : '开启音效';
  $('sound').innerHTML = icon(sounds ? 'volume' : 'mute');
  $('sound').title = t;
  $('sound').setAttribute('aria-label', t);
  $('sound').setAttribute('aria-pressed', String(sounds));
}
function button(label, action, cls = 'primary', glyph = '', disabled = false) {
  return (
    '<button class="' +
    cls +
    '" data-action="' +
    action +
    '" ' +
    (disabled ? 'disabled' : '') +
    '>' +
    (glyph ? icon(glyph) : '') +
    label +
    '</button>'
  );
}
function repaintBoard() {
  const s = game();
  const map = activeMap();
  if (viewMode === '3d' && createScene) {
    if (!sandbox || sceneMapId !== map.id) {
      sandbox?.dispose();
      sandbox = null;
      try {
        sandbox = createScene($('board-3d'), { mapId: map.id, onTile: boardClick });
        sceneMapId = map.id;
        sceneKey = '';
      } catch (error) {
        console.warn('3D 场景无法显示', error);
        showView('2d');
        announce('已切换为二维地图，可继续对局。');
        repaintBoard();
        return;
      }
    }
    const key = [
      s.players[0].id,
      s.eventSeq,
      s.round,
      s.turn,
      s.phase,
      selected,
      myId(),
      cardDraft?.item,
      cardDraft?.index,
    ].join('|');
    if (key !== sceneKey) {
      sandbox.update(s, boardOptions(s));
      sceneKey = key;
    }
    const prompt =
      ownTurn() && ['buy', 'route'].includes(s.phase)
        ? [s.mapId, s.turn, s.round, s.phase, current().pos].join(':')
        : '';
    if (prompt && prompt !== cameraPrompt && !cardDraft) sandbox.focusTile?.(current().pos, s.phase);
    cameraPrompt = prompt;
    return;
  }
  const options = { ...boardOptions(s), ...atlas.options(map.id, selected) };
  if (animation && s.players[animation.index]?.id === animation.playerId) {
    const players = s.players.map((p, i) => (i === animation.index ? { ...p, pos: animation.pos } : p));
    drawAtlas(canvas, { ...s, players }, options);
  } else drawAtlas(canvas, s, options);
  atlas.sync();
}
function showView(mode) {
  viewMode = mode;
  atlas.show(mode === '2d');
  canvas.hidden = mode === '3d';
  $('board-3d').hidden = mode !== '3d';
  $('camera-bar').hidden = mode !== '3d';
  $('view-3d').setAttribute('aria-pressed', String(mode === '3d'));
  $('view-2d').setAttribute('aria-pressed', String(mode === '2d'));
}
async function switchView(mode, remember = true) {
  const request = ++viewRequest;
  if (mode === '2d') {
    showView('2d');
    repaintBoard();
    if (remember) save(localStorage, 'mistport.view', mode);
    return;
  }
  try {
    const { createBoard3D } = await import('./board3d.mjs');
    if (request !== viewRequest) return;
    showView('3d');
    createScene = createBoard3D;
    sceneKey = '';
    repaintBoard();
    sandbox?.resize();
    if (remember) save(localStorage, 'mistport.view', mode);
  } catch (error) {
    if (request !== viewRequest) return;
    console.warn('立体沙盘未能启动', error);
    showView('2d');
    repaintBoard();
    announce('立体沙盘未能载入，已打开二维地图。');
  }
}
function animateMove(previous, next) {
  clearInterval(rollTimer);
  animation = null;
  if (
    !previous ||
    !next ||
    previous === next ||
    !next.lastMove ||
    previous.lastMove?.id === next.lastMove.id
  )
    return;
  const { playerId, path } = next.lastMove;
  const index = next.players.findIndex((p) => p.id === playerId),
    distance = path.length - 1;
  if (index < 0 || distance < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animation = { index, playerId, pos: path[0] };
  let steps = 0;
  rollTimer = setInterval(
    () => {
      steps++;
      if (steps >= distance) {
        clearInterval(rollTimer);
        animation = null;
      } else animation.pos = path[steps];
      repaintBoard();
    },
    Math.min(90, 650 / distance),
  );
}
function logLines(s, limit) {
  return s.log
    .slice(-limit)
    .reverse()
    .map((entry) => {
      const index = s.players.findIndex((p) => p.id === entry.playerId);
      return (
        '<div class="logline"><span class="roundtag">R' +
        pad(entry.round) +
        '</span><b style="background:' +
        palette[Math.max(index, 0)] +
        '"></b><p>' +
        esc(entry.text) +
        '</p></div>'
      );
    })
    .join('');
}
function renderTurn() {
  const s = game(),
    p = current(),
    mine = ownTurn(),
    tile = activeMap().tiles[p.pos],
    phase = s.phase;
  $('turn-status').textContent = waiting()
    ? '候场中'
    : phase === 'finished'
      ? '已结算'
      : mine
        ? '操作中'
        : '等待中';
  let controls = '';
  if (waiting()) controls = button('进入候场室', 'lobby', 'primary wide', 'network');
  else if (phase === 'finished') controls = button('查看结算', 'result', 'primary wide', 'flag');
  else if (!mine) controls = button(esc(p.name) + ' 行动中', 'wait', 'secondary wide', 'repeat', true);
  else if (phase === 'roll' && cardDraft)
    controls = button('取消选卡，返回掷骰', 'cancelCard', 'secondary wide');
  else if (phase === 'roll')
    controls =
      '<button class="primary wide roll-btn" data-action="roll" ' +
      (sending ? 'disabled' : '') +
      '>' +
      icon('dice') +
      (p.delayed && !p.permit ? '处理停航' : '掷骰出发') +
      '<span class="keyboard-hint">SPACE</span></button>';
  else if (phase === 'route') controls = routeChoices(activeMap(), s, sending);
  else if (phase === 'bank')
    controls =
      '<div class="controls">' +
      button('办理银行业务', 'bank', 'primary', 'case', sending) +
      button('结束回合', 'end', 'secondary', '', sending) +
      '</div>';
  else if (phase === 'liquidate')
    controls =
      '<p class="turn-note">应付 ' +
      num(s.bill.amount) +
      ' · 现金缺口 ' +
      num(Math.max(0, s.bill.amount - p.cash)) +
      '</p>' +
      button('选择筹款方式', 'liquidate', 'primary wide', 'case', sending);
  else if (phase === 'buy')
    controls =
      '<p class="turn-note">' +
      esc(tile.name) +
      ' · 售价 ' +
      num(tile.price) +
      '</p><div class="controls">' +
      button('购买地产', 'buy', 'primary', 'home', sending || p.cash < tile.price) +
      button('放弃并结束', 'end', 'secondary', '', sending) +
      '</div>';
  else if (phase === 'shop')
    controls =
      '<div class="controls">' +
      button('进入商店', 'shopMenu', 'primary', 'bag', sending) +
      button('结束回合', 'end', 'secondary', '', sending) +
      '</div>';
  else controls = button('结束回合', 'end', 'primary wide', 'flag', sending);
  const dice = s.dice.length ? s.dice : [3, 5],
    title = waiting()
      ? '等待船队集结'
      : phase === 'finished'
        ? '本局航程结束'
        : mine
          ? '你的回合'
          : esc(p.name) + '的回合';
  const where = waiting()
    ? '房间 ' + esc(room.code)
    : esc(tile.name) +
      (s.lastRoll?.exact
        ? ' · 精准 ' + s.lastRoll.distance + ' 格'
        : s.dice.length
          ? ' · 骰点 ' + s.dice.join(' + ')
          : '');
  $('turn-content').innerHTML =
    '<div class="turnbody"><div class="turn-ident">' +
    avatar(s.turn) +
    '<div><strong>' +
    title +
    '</strong><span class="turn-location">' +
    icon('pin') +
    where +
    (!waiting() && statusText(s, p) ? '</span><span class="player-state">' + esc(statusText(s, p)) : '') +
    '</span></div></div><div class="dice-mat ' +
    (animation ? 'rolling' : '') +
    '">' +
    diceArt(dice[0], dice[1]) +
    '</div>' +
    controls +
    '</div>';
}
function render() {
  const s = game(),
    id = myId();
  const map = activeMap();
  $('map-name').textContent = map.name;
  $('map-english').textContent = map.english;
  document.title = '群岛大亨 · ' + map.name;
  $('map-count').textContent = map.tiles.length + ' 地块 · ' + map.districts.length + ' 街区';
  $('track-type').textContent = map.next.some((exits) => exits.length > 1) ? '分岔路线' : '经典环线';
  canvas.setAttribute(
    'aria-label',
    map.name + '二维路线图，点击地块查看详情。方向键平移，加减号缩放，0 看全图，F 定位棋子',
  );
  $('board-3d').setAttribute('aria-label', map.name + '立体沙盘，方向键旋转，加减号缩放，数字零恢复全景');
  $('mode-label').textContent = offline && identity ? '重连中' : room ? '联机 · ' + room.code : '本地练习';
  $('seat-count').textContent = waiting() ? room.players.length : s.players.length;
  $('round-count').textContent = waiting() ? '— / ' + room.maxRounds : pad(s.round) + ' / ' + s.maxRounds;
  $('roster-count').textContent = (waiting() ? room.players.length : s.players.length) + ' 人';
  const players = waiting() ? room.players : s.players;
  $('roster').innerHTML = players
    .map((p, i) => {
      const own = p.id === (waiting() ? identity?.playerId : id),
        active = !waiting() && s.turn === i && s.phase !== 'finished';
      const location = waiting() || p.out ? null : map.tiles[p.pos];
      return (
        (location
          ? '<button data-tile="' +
            location.id +
            '" title="查看' +
            esc(p.name) +
            '所在的地块" class="playerrow '
          : '<div class="playerrow ') +
        (active ? 'current ' : '') +
        (p.out ? 'out' : '') +
        '">' +
        avatar(i) +
        '<div class="player-info"><div class="playername"><span>' +
        esc(p.name) +
        '</span>' +
        (own ? '<small class="you-tag">你</small>' : '') +
        '</div><div class="playernum">P' +
        pad(i + 1) +
        ' · ' +
        (p.out ? '已破产' : p.bot ? '电脑' : own ? '玩家' : '联机玩家') +
        (location ? ' · ' + location.short : '') +
        (location && statusText(s, p) ? '</div><div class="player-state">' + esc(statusText(s, p)) : '') +
        '</div></div><div class="cash">' +
        (waiting() ? '候场' : coin + num(p.cash)) +
        (location ? '</div></button>' : '</div></div>')
      );
    })
    .join('');
  renderTurn();
  renderCardPreview();
  repaintBoard();
  const me = s.players.find((p) => p.id === id);
  $('bag').innerHTML = waiting() ? '' : quickBag(me);
  if (me && !waiting()) {
    const account = financeSummary(s, me);
    $('turn-account').innerHTML =
      (s.phase === 'finished' || me.out
        ? ''
        : '<div class="income-due"><span>经营款 <b>+' +
          num(account.nextBaseIncome) +
          '</b></span><small>第 ' +
          account.nextSettlementRound +
          ' 轮结束到账</small></div>') +
      '<div class="account-shortcuts"><button data-menu="bank">银行</button><button data-menu="market">股票</button><button data-menu="ledger">我的账单</button></div>';
  } else $('turn-account').replaceChildren();
  $('log-list').innerHTML = logLines(s, 3);
  if (dialog.open && page && !['confirmLeave', 'restart', 'lobby', 'packs', 'landmarks'].includes(page))
    renderDetails();
  scheduleBot();
}
function scheduleBot() {
  clearTimeout(localTimer);
  if (room || identity || practice.phase === 'finished' || !practice.players[practice.turn].bot || botBusy)
    return;
  localTimer = setTimeout(() => {
    botBusy = true;
    try {
      const prev = structuredClone(practice);
      applyAction(practice, practice.players[practice.turn].id, botAction(practice));
      animateMove(prev, practice);
      savePractice();
    } finally {
      botBusy = false;
      render();
    }
  }, 850);
}
function showPage(kind, id) {
  if (cardDraft) {
    cardDraft = null;
    renderCardPreview();
    renderTurn();
  }
  if (kind === 'tile' && Number.isInteger(id)) sandbox?.focusTile?.(id, 'detail');
  page = kind;
  dialog.classList.toggle('pack-dialog', kind === 'packs');
  if (Number.isInteger(id)) selected = id;
  if (!dialog.open) dialog.showModal();
  if (kind === 'lobby') renderLobby();
  else if (kind === 'packs') {
    setDialog(
      '地图包',
      packCards(activeMap().id, !!room, (id) => !!saved(localStorage, practiceKey + '.' + id)),
    );
    for (const preview of dialog.querySelectorAll('[data-map-preview]')) {
      drawMapPreview(preview, getMap(preview.dataset.mapPreview));
    }
  } else if (kind === 'landmarks') {
    const places = sandbox?.getLandmarks?.() || [];
    setDialog(
      activeMap().name + ' · 地标导览',
      '<div class="landmark-list">' +
        places
          .map(
            (p, i) =>
              '<button class="secondary" data-landmark="' +
              i +
              '">' +
              icon('pin') +
              '<span>' +
              esc(p.name) +
              '</span>' +
              icon('chev') +
              '</button>',
          )
          .join('') +
        '</div><p class="help">选择地标后，镜头会移至近景。点「全景」可返回整张棋盘。</p>',
    );
  } else if (kind === 'confirmLeave')
    setDialog(
      '离开房间',
      '<p>离开后，你的席位' +
        (room?.game ? '将由电脑接管。' : '会从候场室移除。') +
        '</p><div class="modal-actions">' +
        button('确认离开', 'leave', 'secondary dangerbtn') +
        button('留在房间', 'lobby', 'primary') +
        '</div>',
    );
  else if (kind === 'restart')
    setDialog(
      '重新开始练习',
      '<p>将以 15,000 启动资金重新开局，当前练习进度会被替换。</p><div class="modal-actions">' +
        button('新开一局', 'newPractice', 'primary') +
        button('继续当前对局', 'close', 'secondary') +
        '</div>',
    );
  else renderDetails();
  repaintBoard();
}
function setDialog(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
}
function renderDetails() {
  const result = details(page, { state: game(), me: myId() }, selected);
  let extra = '';
  if ((page === 'guide' || page === 'result') && !room)
    extra =
      '<div class="modal-actions">' + button('重新开始练习', 'restart', 'secondary', 'repeat') + '</div>';
  if (page === 'result' && room)
    extra = '<div class="modal-actions">' + button('返回房间', 'lobby', 'secondary', 'network') + '</div>';
  setDialog(result.title, result.html + extra);
}
function closeDialog() {
  if (dialog.open) dialog.close();
  page = null;
  selected = null;
  repaintBoard();
}
dialog.addEventListener('close', () => {
  page = null;
  selected = null;
  repaintBoard();
});
dialog.addEventListener('click', (e) => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
});
function lastSeatForLobby() {
  const seat = saved(localStorage, lastSeatKey);
  if (
    !seat ||
    !/^[A-Z2-9]{6}$/.test(seat.code) ||
    typeof seat.playerId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(seat.token)
  )
    return null;
  return !inviteCode || inviteCode === seat.code ? seat : null;
}
function forgetLastSeat(seat) {
  const latest = saved(localStorage, lastSeatKey);
  if (
    seat &&
    latest &&
    latest.code === seat.code &&
    latest.playerId === seat.playerId &&
    latest.token === seat.token
  )
    save(localStorage, lastSeatKey, null);
}
function renderLobby() {
  if (!room) {
    const joining = lobbyTab === 'join';
    const seat = identity ? null : lastSeatForLobby();
    setDialog(
      '联机大厅',
      '<div class="tabs"><button data-tab="create" class="' +
        (!joining ? 'on' : '') +
        '">' +
        icon('plus') +
        '创建房间</button><button data-tab="join" class="' +
        (joining ? 'on' : '') +
        '">' +
        icon('network') +
        '加入房间</button></div><form id="roomform" class="formgrid"><label>玩家昵称<input name="name" required maxlength="16" autocomplete="nickname" placeholder="输入你的昵称" value="' +
        esc(nameDraft) +
        '"></label>' +
        (joining
          ? '<label>六位房间码<input name="code" autocapitalize="characters" required maxlength="6" minlength="6" placeholder="例如 ABC234" value="' +
            esc(inviteCode) +
            '"></label>'
          : '<label>对局地图<select name="mapId">' +
            orderedPacks()
              .map(
                (m) =>
                  '<option value="' +
                  m.id +
                  '" ' +
                  (m.id === draftMapId ? 'selected' : '') +
                  '>' +
                  m.name +
                  ' · ' +
                  m.tiles.length +
                  ' 格</option>',
              )
              .join('') +
            '</select></label><div class="formrow"><label>房间人数上限<select name="maxPlayers">' +
            [2, 4, 6, 8, 10, 12]
              .map(
                (n) =>
                  '<option ' + (n === 12 ? 'selected' : '') + ' value="' + n + '">' + n + ' 人</option>',
              )
              .join('') +
            '</select></label><label>对局轮数<select name="maxRounds">' +
            [10, 20, 30, 50, 100]
              .map(
                (n) =>
                  '<option ' + (n === 30 ? 'selected' : '') + ' value="' + n + '">' + n + ' 轮</option>',
              )
              .join('') +
            '</select></label></div>') +
        '<div class="formerror" id="formerror" role="alert"></div><button class="primary" type="submit" ' +
        (sending ? 'disabled' : '') +
        '>' +
        icon(joining ? 'network' : 'plus') +
        (joining ? '加入房间' : '创建房间') +
        '</button></form>' +
        (seat
          ? '<div class="modal-actions"><button type="button" class="secondary" data-recover="' +
            esc(seat.playerId) +
            '" ' +
            (sending ? 'disabled' : '') +
            '>' +
            icon('repeat') +
            '恢复上次席位 · ' +
            esc(seat.code) +
            '</button></div>'
          : ''),
    );
    return;
  }
  const host = room.host === identity.playerId,
    started = !!room.game;
  setDialog(
    started ? '联机房间' : '联机候场室',
    '<div class="roomcode"><div><small>房间码</small><strong>' +
      esc(room.code) +
      '</strong></div><button class="secondary" data-action="copy">' +
      icon('copy') +
      '复制邀请</button></div>' +
      (host && !started
        ? '<label class="room-map">' +
          icon('map') +
          '对局地图<select id="lobby-map" ' +
          (sending ? 'disabled' : '') +
          '>' +
          orderedPacks()
            .map(
              (m) =>
                '<option value="' +
                m.id +
                '" ' +
                (m.id === getMap(room.mapId || 'mistport').id ? 'selected' : '') +
                '>' +
                m.name +
                ' · ' +
                m.tiles.length +
                ' 格</option>',
            )
            .join('') +
          '</select></label>'
        : '<p class="room-map">' +
          icon('map') +
          getMap(room.mapId || 'mistport').name +
          ' · ' +
          getMap(room.mapId || 'mistport').tiles.length +
          ' 格</p>') +
      '<h3 class="h3">玩家 ' +
      room.players.length +
      ' / ' +
      room.maxPlayers +
      ' <span class="subtle"> · ' +
      room.maxRounds +
      ' 轮</span></h3><div class="rows">' +
      room.players
        .map(
          (p, i) =>
            '<div class="info-row">' +
            avatar(i) +
            '<span class="grow">' +
            esc(p.name) +
            '<small>' +
            (p.id === room.host ? '房主' : p.bot ? '电脑船员' : p.online ? '在线' : '暂时离线') +
            (p.id === identity.playerId ? ' · 你' : '') +
            '</small></span>' +
            (!started && host && p.bot
              ? '<button class="secondary" data-remove="' + esc(p.id) + '">移除</button>'
              : '') +
            '</div>',
        )
        .join('') +
      '</div><div class="modal-actions">' +
      (started
        ? button('返回棋盘', 'close', 'primary')
        : host
          ? button('开始游戏', 'start', 'primary', 'flag', room.players.length < 2 || sending) +
            button(
              '添加电脑',
              'addBot',
              'secondary',
              'bot',
              room.players.length >= room.maxPlayers || sending,
            )
          : '<span class="help">等待房主开始游戏…</span>') +
      button('离开房间', 'confirmLeave', 'secondary dangerbtn') +
      '</div>',
  );
}
async function fetchApi(path, body, token) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    throw new Error('无法连接房间服务器，请检查网络后重试。');
  }
  const value = await response.json().catch(() => ({}));
  if (!response.ok || !value.room) {
    const e = new Error(value.error || '联机服务暂时不可用');
    e.status = response.status;
    throw e;
  }
  return value;
}
function adopt(snapshot) {
  if (room && (snapshot.code !== room.code || snapshot.rev < room.rev)) return;
  const previous = room?.game,
    wasWaiting = waiting(),
    same = room?.rev === snapshot.rev;
  const onlineChanged = room && room.players.some((p, i) => p.online !== snapshot.players[i]?.online);
  if (snapshot.game) {
    ensureEconomy(snapshot.game);
    initCards(snapshot.game);
  }
  room = snapshot;
  offline = false;
  if (!same) {
    animateMove(previous, snapshot.game);
    render();
  }
  if (wasWaiting && snapshot.game) {
    if (page === 'lobby') closeDialog();
    sound(550);
    announce('船员已就位，对局开始');
  } else if (page === 'lobby' && dialog.open && (!same || onlineChanged)) renderLobby();
}
async function poll() {
  if (!identity || checking || sending) return;
  checking = true;
  const active = identity;
  try {
    const { room: r } = await fetchApi('/api/rooms/' + active.code, null, active.token);
    if (identity !== active) return;
    const recovering = offline;
    adopt(r);
    if (recovering) render();
  } catch (e) {
    if (identity !== active) return;
    if (e.status === 401 || e.status === 404) {
      dropRoom();
      announce(e.message);
    } else if (!offline) {
      offline = true;
      render();
    }
  } finally {
    checking = false;
  }
}
function dropRoom() {
  forgetLastSeat(identity);
  identity = null;
  room = null;
  offline = false;
  save(sessionStorage, roomKey, null);
  if (new URLSearchParams(location.search).has('room')) history.replaceState({}, '', location.pathname);
  inviteCode = '';
  lobbyTab = 'create';
  closeDialog();
  render();
}
async function restoreSeat(button) {
  if (sending || identity || room) return;
  const seat = lastSeatForLobby();
  if (!seat || seat.playerId !== button.dataset.recover) {
    renderLobby();
    announce('已更新浏览器中最近使用的席位。');
    return;
  }
  sending = true;
  button.disabled = true;
  try {
    const { room: snapshot } = await fetchApi('/api/rooms/' + seat.code, null, seat.token);
    identity = seat;
    save(sessionStorage, roomKey, seat);
    adopt(snapshot);
    if (snapshot.game) closeDialog();
    else showPage('lobby');
    announce('已恢复房间 ' + seat.code + ' 的席位');
  } catch (e) {
    if (e.status === 401 || e.status === 404) forgetLastSeat(seat);
    sending = false;
    if (page === 'lobby') renderLobby();
    announce(e.message);
  } finally {
    sending = false;
    if (room) {
      render();
      if (page === 'lobby') renderLobby();
    }
  }
}
async function enterRoom(form) {
  if (sending || room) return;
  sending = true;
  const data = new FormData(form),
    name = String(data.get('name') || '').trim(),
    joining = lobbyTab === 'join',
    code = String(data.get('code') || '')
      .trim()
      .toUpperCase();
  form.querySelector('[type=submit]').disabled = true;
  try {
    if (joining && !/^[A-Z2-9]{6}$/.test(code)) throw new Error('请输入六位房间码');
    const r = await fetchApi(
      joining ? '/api/rooms/' + code + '/join' : '/api/rooms',
      joining
        ? { name }
        : {
            name,
            mapId: String(data.get('mapId')),
            maxPlayers: Number(data.get('maxPlayers')),
            maxRounds: Number(data.get('maxRounds')),
          },
    );
    identity = { code: r.room.code, playerId: r.playerId, token: r.token };
    save(sessionStorage, roomKey, identity);
    save(localStorage, lastSeatKey, identity);
    save(localStorage, 'mistport.nick', name);
    nameDraft = name;
    adopt(r.room);
    showPage('lobby');
  } catch (e) {
    if ($('formerror')) $('formerror').textContent = e.message;
    else announce(e.message);
  } finally {
    sending = false;
    if (form.isConnected) form.querySelector('[type=submit]').disabled = false;
    if (room && page === 'lobby') renderLobby();
  }
}
async function perform(action) {
  if (sending) return;
  sending = true;
  const active = identity;
  try {
    if (active) {
      if (!room) throw new Error('正在恢复房间连接');
      const roomUrl = '/api/rooms/' + active.code;
      const submit = (rev) => fetchApi(roomUrl + '/action', { rev, action }, active.token);
      let r;
      try {
        r = await submit(room.rev);
      } catch (error) {
        // Joining players can advance a lobby revision while the host is using the map selector.
        if (error.status !== 409 || action.type !== 'setMap') throw error;
        const latest = await fetchApi(roomUrl, null, active.token);
        if (identity !== active || latest.room.game || latest.room.host !== active.playerId) throw error;
        r = latest.room.mapId === action.mapId ? latest : await submit(latest.room.rev);
      }
      if (identity !== active) return;
      if (action.type === 'leave') {
        dropRoom();
        return;
      }
      adopt(r.room);
    } else {
      const prev = structuredClone(practice);
      applyAction(practice, myId(), action);
      animateMove(prev, practice);
      savePractice();
    }
    sound(action.type === 'buy' || action.type === 'shop' ? 610 : action.type === 'roll' ? 330 : 460);
    if (action.type === 'use') cardDraft = null;
    if (action.type === 'upgrade') {
      atlas.focusOn(action.tile, 'upgrade');
      sandbox?.focusTile?.(action.tile, 'upgrade');
    }
    if (action.type === 'end' || action.type === 'start') atlas.clearFocus();
    if (['shop', 'buy', 'use', 'upgrade', 'end', 'route'].includes(action.type) && dialog.open)
      closeDialog();
    if (page === 'liquidate' && game().phase !== 'liquidate') closeDialog();
  } catch (e) {
    if (active && identity === active && (e.status === 401 || e.status === 404)) dropRoom();
    announce(e.message);
    if (active && e.status === 409) {
      sending = false;
      await poll();
    }
  } finally {
    sending = false;
    render();
    if (page === 'lobby' && dialog.open) renderLobby();
  }
}
async function copyInvite() {
  const link = new URL(location.pathname, inviteBase);
  link.searchParams.set('room', room.code);
  const invitation = '加入我的「群岛大亨」房间 ' + room.code + '：' + link.href;
  try {
    if (!navigator.clipboard?.writeText) throw Error();
    await navigator.clipboard.writeText(invitation);
    announce('邀请链接与房间码已复制');
  } catch {
    let field = $('invite-text');
    if (!field) {
      $('modal-body').insertAdjacentHTML(
        'beforeend',
        '<label class="help">分享此加入链接<input id="invite-text" readonly></label>',
      );
      field = $('invite-text');
    }
    field.value = link.href;
    field.focus();
    field.select();
    if (document.execCommand('copy')) announce('邀请链接已复制');
  }
}
function routeAction(action) {
  if (action === 'cancelCard') {
    cardDraft = null;
    renderCardPreview();
    renderTurn();
    repaintBoard();
    return;
  }
  if (action === 'confirmCard' && cardDraft) {
    const target = previewOptions()[cardDraft.index];
    if (target) return perform({ type: 'use', item: cardDraft.item, target: target.value });
    return;
  }
  if (action === 'autoSettle') return perform({ type: 'liquidate', operation: 'auto' });
  if (['lobby', 'confirmLeave', 'restart', 'result', 'bank', 'liquidate'].includes(action))
    return showPage(action);
  if (action === 'shopMenu') return showPage('shop');
  if (action === 'close') return closeDialog();
  if (action === 'copy') return copyInvite();
  if (action === 'newPractice') {
    if (room) return;
    practice = newPractice(activeMap().id);
    savePractice();
    closeDialog();
    render();
    return;
  }
  if (['roll', 'end', 'buy', 'start', 'addBot', 'leave'].includes(action)) return perform({ type: action });
}
document.addEventListener('click', (event) => {
  const b = event.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.tab) {
    nameDraft = document.querySelector('[name=name]')?.value || '';
    lobbyTab = b.dataset.tab;
    renderLobby();
  } else if (b.dataset.packPlay && !room) {
    if (b.dataset.packPlay !== activeMap().id) {
      savePractice();
      clearInterval(rollTimer);
      animation = null;
      selected = null;
      practice =
        saved(localStorage, practiceKey + '.' + b.dataset.packPlay) || newPractice(b.dataset.packPlay);
      ensureEconomy(practice);
      initCards(practice);
      draftMapId = b.dataset.packPlay;
      savePractice();
    }
    closeDialog();
    render();
  } else if (b.dataset.packRoom && !room) {
    draftMapId = b.dataset.packRoom;
    lobbyTab = 'create';
    showPage('lobby');
  } else if (b.dataset.landmark !== undefined) {
    closeDialog();
    sandbox?.focusLandmark(Number(b.dataset.landmark));
  } else if (b.dataset.route !== undefined) perform({ type: 'route', to: Number(b.dataset.route) });
  else if (b.dataset.recover) restoreSeat(b);
  else if (b.dataset.action) routeAction(b.dataset.action);
  else if (b.dataset.menu) showPage(b.dataset.menu);
  else if (b.dataset.tile !== undefined) showPage('tile', Number(b.dataset.tile));
  else if (b.dataset.upgrade !== undefined) perform({ type: 'upgrade', tile: Number(b.dataset.upgrade) });
  else if (b.dataset.use) selectCard(b.dataset.use);
  else if (b.dataset.craft) perform({ type: 'craft', item: b.dataset.craft });
  else if (b.dataset.sellDeed !== undefined)
    perform({ type: 'liquidate', operation: 'property', tile: Number(b.dataset.sellDeed) });
  else if (b.dataset.shop) perform({ type: 'shop', item: b.dataset.shop });
  else if (b.dataset.remove) perform({ type: 'removeBot', playerId: b.dataset.remove });
});
document.addEventListener('submit', (e) => {
  if (e.target.dataset.moneyForm) {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    const amount = Number(new FormData(form).get('quantity'));
    if (!Number.isSafeInteger(amount) || amount < 1) return announce('请输入正整数。');
    if (form.dataset.moneyForm === 'bank')
      perform({ type: 'bank', operation: form.dataset.operation, amount });
    else
      perform({ type: 'stock', side: form.dataset.operation, stock: form.dataset.stock, shares: amount });
    return;
  }
  if (e.target.id === 'roomform') {
    e.preventDefault();
    enterRoom(e.target);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'card-target' && cardDraft) {
    cardDraft.index = Number(e.target.value);
    renderCardPreview();
    repaintBoard();
  }
  if (e.target.id === 'lobby-map') perform({ type: 'setMap', mapId: e.target.value });
});
$('brand-art').innerHTML = brandArt();
document
  .querySelectorAll('[data-i]')
  .forEach((node) =>
    node.replaceWith(document.createRange().createContextualFragment(icon(node.dataset.i))),
  );
for (const [id, kind] of Object.entries({
  'nav-assets': 'assets',
  'nav-packs': 'packs',
  landmarks: 'landmarks',
  'nav-guide': 'guide',
  lobby: 'lobby',
  'tile-index': 'tiles',
  'all-log': 'logs',
  'bag-detail': 'bag',
}))
  $(id).onclick = () => showPage(kind);
$('nav-table').onclick = () => {
  closeDialog();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
$('modal-close').onclick = closeDialog;
$('sound').onclick = () => {
  sounds = !sounds;
  save(localStorage, 'mistport.sound', sounds);
  sound(500);
  updateSound();
};
$('expand').onclick = async () => {
  const panel = $('board-panel');
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (panel.classList.contains('map-large')) panel.classList.remove('map-large');
  else
    try {
      await panel.requestFullscreen();
    } catch {
      panel.classList.add('map-large');
    }
};
const atlas = createAtlasNavigation(canvas, $('atlas-tools'), {
  redraw: repaintBoard,
  select: boardClick,
  locate: () => ({ tile: current().pos, context: game().phase }),
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('board-panel').classList.remove('map-large');
    if (cardDraft) routeAction('cancelCard');
  }
  if (
    e.code === 'Space' &&
    !e.repeat &&
    !dialog.open &&
    !cardDraft &&
    !e.target.closest('button,a,input,select,textarea') &&
    ownTurn() &&
    game().phase === 'roll'
  ) {
    e.preventDefault();
    perform({ type: 'roll' });
  }
});
new ResizeObserver(repaintBoard).observe(canvas);
$('view-3d').onclick = () => switchView('3d');
$('view-2d').onclick = () => switchView('2d');
const cameraActions = {
  'rotate-left': () => sandbox?.rotate(-1),
  'rotate-right': () => sandbox?.rotate(1),
  'zoom-in': () => sandbox?.zoom(1.2),
  'zoom-out': () => sandbox?.zoom(1 / 1.2),
  'reset-camera': () => sandbox?.reset(),
};
for (const [id, act] of Object.entries(cameraActions)) $(id).onclick = act;
$('board-3d').addEventListener('keydown', (e) => {
  const action = {
    ArrowLeft: 'rotate-left',
    ArrowRight: 'rotate-right',
    '+': 'zoom-in',
    '=': 'zoom-in',
    '-': 'zoom-out',
    0: 'reset-camera',
  }[e.key];
  if (action) {
    e.preventDefault();
    cameraActions[action]();
  }
});
new ResizeObserver(() => {
  if (viewMode === '3d') sandbox?.resize();
}).observe($('board-3d'));
updateSound();
render();
switchView(saved(localStorage, 'mistport.view') === '2d' ? '2d' : '3d', false);
if (identity) {
  poll().then(() => {
    if (waiting()) showPage('lobby');
  });
} else if (inviteCode) showPage('lobby');
setInterval(poll, 1200);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
});
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))
  fetch('/api/local-invite')
    .then((r) => r.json())
    .then((v) => {
      if (v.origin) inviteBase = v.origin;
    })
    .catch(() => {});
