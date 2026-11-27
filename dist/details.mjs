import { rentFor, upgradeCost, netWorth, financeSummary, BASE_INCOME } from './shared/engine.mjs';
import { accountDetails, accountNav, accountTotals } from './accounts.mjs';
import { cardDetails } from './card-table.mjs';
import { getMap } from './shared/maps.mjs';
import { icon, avatar } from './art.mjs';

const money = (amount) => Number(amount).toLocaleString('zh-CN');
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const num = (n) => String(n).padStart(2, '0');
const types = {
  start: '启航码头',
  property: '可购地产',
  chance: '随机事件',
  delay: '停航锚地',
  tax: '港务收费',
  shop: '道具商铺',
  bonus: '群岛集会',
  bank: '银行网点',
};
const stat = (label, value) =>
  '<div class="statbox"><small>' + label + '</small><strong>' + value + '</strong></div>';
const note = (text) => '<p class="help">' + text + '</p>';

function guide(state) {
  const limit = state ? '本局共 ' + state.maxRounds + ' 轮。' : '';
  const sections = [
    [
      '查看棋盘',
      '3D 沙盘可拖动旋转，按住 Shift 拖动可平移。2D 地图可拖动平移，滚轮以光标为中心缩放，触屏双指可捏合缩放。点「全图」看完整路网，点「定位」找回当前棋子。每位玩家独立调节视角。',
    ],
    [
      '如何开始',
      '练习局可直接掷骰。在联机大厅创建房间，把房间码交给朋友。房主可添加电脑船长，凑齐至少两位玩家即可开局，最多容纳 12 位。',
    ],
    [
      '掷骰航行',
      '每人以 15,000 现金和初始手牌启航，通常掷两枚六面骰。每位在场玩家行动一次为一轮，轮末人人领取 ' +
        BASE_INCOME +
        ' 经营款。一位玩家沿路再次经过起点才算自己走完一圈，另外领取 2,000。',
    ],
    [
      '在岔路选方向',
      '云轨山城与赤沙商路设有分岔。还有步数时抵达岔路，棋子会等待你选择下一条路。比较预计落点、租金或可买地产后再决定。选择方向会消耗剩余步数，无须重掷骰子。',
    ],
    [
      '购地与收租',
      '停在空置地产可以购入或跳过。其他玩家停在你的地产会自动支付租金。集齐同一街区的全部地产后，该区租金提高 50%。地块索引按街区列出各处地产。',
    ],
    [
      '升级地产',
      '在自己的回合，掷骰前或结算后可升级一处已拥有的地产，最高为 3 级。升级花费约为地价的 55%。2 级与 3 级租金分别为基础租金的 1.85 倍和 3 倍。点击地图上的地块可查看实际金额。',
    ],
    [
      '补给和道具',
      '商店补给、事件与合成都能取得手牌。掷骰前选一张卡，棋盘显示合法目标和影响范围，确认才会消耗。用测程罗盘可以精确停在银行；在岔口设置围栏可以改变后续玩家的路线。合成占用本回合的出牌机会。',
    ],
    [
      '公共地块',
      '集会发放 950 红利，收费地块自动收取港务费。事件地块可能带来现金、道具或维修支出。停在锚地会错过下一次航行，持有通行证时可从背包中使用。',
    ],
    [
      '破产与胜负',
      '费用超过随身现金时先暂停付款。可以取款、卖股、使用授信或出售指定地产。自动清算依次取款、售股、按账面价值从低到高变卖地产，仍不足则破产。仅余一位船长时立即获胜。' +
        limit +
        '达到轮数上限时按现金＋存款＋证券市值＋地产账面价值－贷款排名，同分时现金多者优先。',
    ],
  ];
  return (
    '<div class="guide">' +
    sections.map(([heading, body]) => '<h3>' + heading + '</h3><p>' + body + '</p>').join('') +
    '</div>'
  );
}

function upgradeButton(state, player, tile) {
  const cost = upgradeCost(state, tile.id);
  if (!cost) return '<small>已满级</small>';
  const active = state.players[state.turn].id === player.id && !player.out;
  const allowed =
    active &&
    (state.phase === 'roll' || state.phase === 'end') &&
    !state.upgradedThisTurn &&
    player.cash >= cost;
  let reason = '可在自己的回合掷骰前或结算后升级';
  if (state.upgradedThisTurn && active) reason = '本回合已升级过地产';
  if (player.cash < cost) reason = '可用现金不足';
  return (
    '<button type="button" class="secondary" data-upgrade="' +
    tile.id +
    '"' +
    (allowed ? '' : ' disabled title="' + reason + '"') +
    '>升级 · ' +
    money(cost) +
    '</button>'
  );
}

function assets(state, player) {
  const { tiles: TILES, districts: DISTRICTS } = getMap(state.mapId || 'mistport');
  const owned = TILES.filter((tile) => state.properties[tile.id]?.owner === player.id);
  const summary = accountNav('assets') + accountTotals(financeSummary(state, player));
  if (!owned.length) return summary + note('名下暂无地产。停在空置地产时可按标价购买。');
  const entries = owned.map((tile) => {
    const district = DISTRICTS[tile.district];
    const deed = state.properties[tile.id];
    return (
      '<div class="info-row"><i class="dist-dot" style="background:' +
      district.color +
      '"></i><div class="grow">' +
      '<button type="button" data-tile="' +
      tile.id +
      '"><strong>' +
      tile.name +
      '</strong> ' +
      icon('chev') +
      '</button>' +
      '<small>' +
      district.name +
      ' · ' +
      deed.level +
      ' 级 · 租金 ' +
      money(rentFor(state, tile.id)) +
      '</small></div>' +
      upgradeButton(state, player, tile) +
      '</div>'
    );
  });
  return summary + '<h3 class="h3">我的地产</h3><div class="rows">' + entries.join('') + '</div>';
}

function tileList(map) {
  const { tiles: TILES, districts: DISTRICTS } = map;
  return DISTRICTS.map((district, index) => {
    const tiles = TILES.filter((t) => t.district === index);
    return (
      '<h3 class="h3"><span style="color:' +
      district.color +
      '">◆</span> ' +
      district.name +
      '</h3><div class="tile-list">' +
      tiles
        .map(
          (t) =>
            '<button type="button" data-tile="' +
            t.id +
            '"><small>' +
            num(t.id) +
            '</small> ' +
            t.name +
            '</button>',
        )
        .join('') +
      '</div>'
    );
  }).join('');
}

function describeTile(state, player, tile) {
  const { tiles: TILES, districts: DISTRICTS } = getMap(state.mapId || 'mistport');
  const district = DISTRICTS[tile.district];
  const heading =
    '<div class="info-row"><i class="dist-dot" style="background:' +
    district.color +
    '"></i><div class="grow"><strong>' +
    district.name +
    '</strong><small>' +
    types[tile.type] +
    ' · 航线 ' +
    num(tile.id) +
    '</small></div></div>';
  if (tile.type !== 'property') {
    const mechanic = {
      start: '完成一圈，途经或停靠即可领取 2,000 航线收益。',
      chance: '抽取一次航海事件，可能获得现金、补给道具或承担维修费。',
      delay: '停靠后下一回合将候航。通行证可抵消这次停航。',
      shop: '停靠时可购买一件道具，也可以跳过补给。',
      bonus: '停靠后领取 950 集会红利。',
      bank: '停在门前可办理存取、证券交易与贷款，本地柜台免收借款手续费。打开「银行」可查余额及授信。',
      tax: '停靠时需支付 ' + money(550 + tile.district * 50) + ' 港务费。',
    };
    return heading + note(mechanic[tile.type]);
  }
  const deed = state.properties[tile.id];
  const owner = state.players.find((p) => p.id === deed?.owner);
  const rent = rentFor(state, tile.id);
  const rows =
    stat('地价', money(tile.price)) +
    stat('当前租金', money(rent)) +
    stat('持有人', owner ? escape(owner.name) : '空置待售') +
    stat('地产等级', deed ? deed.level + ' 级' : '待开发');
  let footer = '';
  if (deed) {
    const districtTiles = TILES.filter((t) => t.type === 'property' && t.district === tile.district);
    const held = districtTiles.filter((t) => state.properties[t.id]?.owner === deed.owner).length;
    footer = note(
      '同区持有 ' +
        held +
        ' / ' +
        districtTiles.length +
        ' 处。' +
        (held === districtTiles.length ? '地区租金加成已生效。' : '集齐本区地产，租金提高 50%。'),
    );
    const cost = upgradeCost(state, tile.id);
    if (cost > 0) {
      const nextState = {
        ...state,
        properties: { ...state.properties, [tile.id]: { ...deed, level: deed.level + 1 } },
      };
      footer += note(
        '升至 ' +
          (deed.level + 1) +
          ' 级需 ' +
          money(cost) +
          '，升级后租金为 ' +
          money(rentFor(nextState, tile.id)) +
          '。',
      );
    }
    if (player?.id === deed.owner)
      footer += '<div class="modal-actions">' + upgradeButton(state, player, tile) + '</div>';
  } else if (
    player?.id === state.players[state.turn].id &&
    state.phase === 'buy' &&
    player.pos === tile.id
  ) {
    footer =
      '<div class="modal-actions"><button type="button" class="primary" data-action="buy"' +
      (player.cash < tile.price ? ' disabled' : '') +
      '>购入 · ' +
      money(tile.price) +
      '</button>' +
      '<button type="button" class="secondary" data-action="end">跳过并结束回合</button></div>';
  } else {
    footer = note('停在这处地产时，可以购入并开始收租。');
  }
  return heading + '<div class="detail-data">' + rows + '</div>' + footer;
}

function logs(state) {
  return (
    [...state.log]
      .reverse()
      .map(
        (entry) =>
          '<div class="logline"><span class="roundtag">第 ' +
          Number(entry.round) +
          ' 轮</span><b></b><p>' +
          escape(entry.text) +
          '</p></div>',
      )
      .join('') || note('暂无航行记录。')
  );
}

function results(state) {
  const ranking = state.players.map((player, index) => ({ player, index, total: netWorth(state, player) }));
  ranking.sort(
    (a, b) =>
      Number(a.player.out) - Number(b.player.out) || b.total - a.total || b.player.cash - a.player.cash,
  );
  return ranking
    .map(({ player, index, total }, rank) => {
      let status = player.out ? '已破产' : '现金 ' + money(player.cash);
      if (state.winner === player.id) status = '获胜船长 · ' + status;
      return (
        '<div class="info-row"><span class="roundtag">' +
        num(rank + 1) +
        '</span>' +
        avatar(index) +
        '<div class="grow"><strong>' +
        escape(player.name) +
        '</strong><small>' +
        status +
        '</small></div><strong>' +
        money(total) +
        '</strong></div>'
      );
    })
    .join('');
}

export function details(kind, { state, me }, tileId) {
  const map = getMap(state?.mapId || 'mistport');
  if (kind === 'guide')
    return {
      title: '玩法手册',
      html:
        '<div class="demo-links"><strong>回合演示</strong><a href="./walkthrough.html?case=bank" target="_blank" rel="noopener">控骰到银行</a><a href="./walkthrough.html?case=fork" target="_blank" rel="noopener">岔路设障</a><a href="./walkthrough.html?case=property" target="_blank" rel="noopener">买地与收租</a></div>' +
        guide(state),
    };
  if (kind === 'tiles') return { title: map.name + ' · 地块索引', html: tileList(map) };
  const player = state?.players.find((p) => p.id === me);
  if (!state || !player) return { title: '对局详情', html: note('进入对局后即可查看。') };
  if (['bank', 'market', 'ledger', 'liquidate'].includes(kind)) return accountDetails(kind, state, player);
  if (['bag', 'shop', 'craft'].includes(kind)) return cardDetails(kind, state, player);
  switch (kind) {
    case 'assets':
      return { title: '我的资产', html: assets(state, player) };
    case 'tile': {
      const tile = map.tiles[Number(tileId)];
      const crew = state.players.filter((p) => !p.out && p.pos === tile?.id);
      const route =
        state.phase === 'route' &&
        state.players[state.turn].id === me &&
        state.routeOptions.includes(tile?.id)
          ? '<div class="modal-actions"><button class="primary" data-route="' +
            tile.id +
            '">选择此路线</button></div>'
          : '';
      return tile
        ? {
            title: tile.name,
            html:
              describeTile(state, player, tile) +
              route +
              (crew.length ? note('当前位置 · ' + crew.map((p) => escape(p.name)).join('、')) : ''),
          }
        : { title: '地块详情', html: note('请选择航线上的地块。') };
    }
    case 'logs':
      return { title: '对局日志', html: logs(state) };
    case 'result':
      return {
        title: '对局结算',
        html:
          note('按净资产排名，计入现金、存款、股票现价与地产账面价值，并扣除未偿债务。') + results(state),
      };
    default:
      throw new Error('未知对局详情');
  }
}
