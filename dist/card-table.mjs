import { CARDS, cardIcon, cardCanUse, cardRecipes, cardShop, cardTargets } from './cards.mjs';
import { getMap } from './shared/maps.mjs';

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const byId = (id) => CARDS.find((c) => c.id === id);
const categories = [...new Set(CARDS.map((c) => c.category))];
export function cardSeal(card) {
  return '<span class="card-seal">' + cardIcon(card.id) + '</span>';
}
export function quickBag(p) {
  if (!p) return '';
  const held = CARDS.filter((c) => (p.items?.[c.id] || 0) > 0);
  if (!held.length) return '<button class="bag-empty" data-menu="bag">背包为空 · 查看卡册</button>';
  return (
    held
      .slice(0, 5)
      .map(
        (c) =>
          '<button data-menu="bag" title="' +
          esc(c.name) +
          ' × ' +
          p.items[c.id] +
          '" aria-label="' +
          esc(c.name) +
          '">' +
          cardSeal(c) +
          '<small>×' +
          p.items[c.id] +
          '</small></button>',
      )
      .join('') +
    (held.length > 5
      ? '<button data-menu="bag" aria-label="查看其余卡牌">+' + (held.length - 5) + '</button>'
      : '')
  );
}
export function statusText(s, p) {
  const e = p.effects || {},
    labels = [];
  if (p.shield) labels.push('下笔租金免付');
  if (p.permit) labels.push('一次停航放行');
  if (p.delayed) labels.push('下回合停航');
  if (p.boost) labels.push('本次多走 3 步');
  if (e.exact) labels.push('本次指定 ' + e.exact + ' 步');
  if (e.limit) labels.push('限行 ' + e.limit.max + ' 步 · 余 ' + e.limit.rolls + ' 次');
  if (e.convoy) labels.push('联运加速余 ' + e.convoy + ' 次');
  if (e.ward) labels.push('抗辩待触发');
  if (e.mirror) labels.push('反制回执待触发');
  if (e.invoice) labels.push('下次行动有到期函');
  if (e.diversion || e.divertActive) labels.push('下次岔口受调度');
  if (e.nap) labels.push('临时休航');
  if (e.caseLot != null) labels.push(getMap(s.mapId || 'mistport').tiles[e.caseLot].name + ' 暂停收租');
  if (e.grant) labels.push('赞助 ' + e.grant.amount + ' · 余 ' + e.grant.left + ' 次');
  for (const [key, label] of [
    ['lockedUntil', '手牌封存'],
    ['embargoUntil', '联合休市'],
    ['boomUntil', '全城商展'],
  ]) {
    if (e[key] > s.round) labels.push(label + '至第 ' + (e[key] - 1) + ' 轮末');
  }
  return labels.join(' · ');
}
function recipeRows(p, s) {
  return cardRecipes
    .map((r) => {
      const out = byId(r.out);
      const ingredients = Object.entries(r.inputs);
      const ok = ingredients.every(([k, n]) => (p.items[k] || 0) >= n);
      const active =
        p.id === s.players[s.turn].id &&
        s.phase === 'roll' &&
        !s.usedThisTurn &&
        !p.out &&
        !(p.effects?.lockedUntil > s.round);
      return (
        '<div class="info-row">' +
        cardSeal(out) +
        '<div class="grow"><strong>' +
        esc(out.name) +
        '</strong><small>' +
        ingredients
          .map(([k, n]) => esc(byId(k).name) + ' × ' + n + '（持有 ' + (p.items[k] || 0) + '）')
          .join(' ＋ ') +
        '</small></div><button class="secondary" data-craft="' +
        out.id +
        '"' +
        (ok && active ? '' : ' disabled') +
        '>合成</button></div>'
      );
    })
    .join('');
}
function cardRows(cards, s, p, mode) {
  return cards
    .map((c) => {
      const count = p.items?.[c.id] || 0,
        shop = mode === 'shop';
      const allowed = shop
        ? s.phase === 'shop' && p.id === s.players[s.turn].id && p.cash >= c.price
        : cardCanUse(s, p.id, c.id);
      const action = shop ? 'data-shop' : 'data-use';
      return (
        '<article class="card-entry"><div class="info-row">' +
        cardSeal(c) +
        '<div class="grow"><strong>' +
        esc(c.name) +
        '</strong><small>' +
        esc(c.category) +
        ' · 持有 ' +
        count +
        '</small></div>' +
        (count || shop
          ? '<button class="secondary" ' +
            action +
            '="' +
            c.id +
            '"' +
            (allowed ? '' : ' disabled') +
            '>' +
            (shop ? '购买 ' + c.price : '选卡') +
            '</button>'
          : '') +
        '</div>' +
        '<p>' +
        esc(c.description) +
        '</p><details><summary>规则与取得方式</summary><dl>' +
        [
          ['时机', c.timing],
          ['目标', c.target],
          ['范围', c.range],
          ['持续', c.duration],
          ['叠加', c.stack],
          ['解除', c.clear],
          ['取得', c.source],
        ]
          .map(([l, v]) => '<dt>' + l + '</dt><dd>' + esc(v) + '</dd>')
          .join('') +
        '</dl></details></article>'
      );
    })
    .join('');
}
export function cardDetails(page, s, p) {
  if (page === 'craft')
    return {
      title: '卡片合成',
      html: '<p class="help">配方会消耗所列材料，产物进入你的背包。</p>' + recipeRows(p, s),
    };
  if (page === 'shop')
    return {
      title: '补给商店',
      html:
        '<p class="help">本次停靠可买一张。现金 ' +
        p.cash.toLocaleString('zh-CN') +
        '。</p>' +
        cardRows(cardShop, s, p, 'shop') +
        '<button class="secondary" data-action="end">结束补给回合</button>',
    };
  const held = CARDS.filter((c) => p.items?.[c.id] > 0);
  return {
    title: '道具背包',
    html:
      '<div class="account-nav"><button data-menu="bag" aria-pressed="true">手牌 ' +
      held.length +
      ' 种</button><button data-menu="craft">合成</button></div>' +
      (statusText(s, p) ? '<p class="help">生效中　' + statusText(s, p) + '</p>' : '') +
      (held.length
        ? cardRows(held, s, p, 'bag')
        : '<p class="help">暂无手牌，可从商店和机遇事件取得。</p>') +
      '<details class="library"><summary>全部卡牌 · ' +
      CARDS.length +
      ' 种</summary>' +
      categories
        .map(
          (cat) =>
            '<details class="library-group"><summary>' +
            esc(cat) +
            '</summary>' +
            cardRows(
              CARDS.filter((c) => c.category === cat),
              s,
              p,
              'catalog',
            ) +
            '</details>',
        )
        .join('') +
      '</details>',
  };
}
export function targetOptions(s, id, item) {
  return cardTargets(s, id, item);
}
export function targetTileIds(s, item, choice) {
  const aim = byId(item)?.aim;
  if (aim === 'person' || aim === 'negative') {
    const player = s.players.find((p) => p.id === choice.value);
    return player ? [player.pos] : [];
  }
  if (aim !== 'steps' && typeof choice.value === 'number') return [choice.value];
  return choice.tiles || [];
}
export function previewBar(s, p, draft, options) {
  const c = byId(draft.item),
    map = getMap(s.mapId || 'mistport');
  const i = draft.index,
    choice = options[i];
  return (
    '<div class="target-title">' +
    cardSeal(c) +
    '<div><strong>' +
    esc(c.name) +
    '</strong><small>' +
    esc(c.description) +
    '</small></div></div>' +
    '<div class="target-controls"><label>选择目标<select id="card-target"><option value="-1">点地图或在此选择</option>' +
    options
      .map(
        (o, k) =>
          '<option value="' + k + '"' + (i === k ? ' selected' : '') + '>' + esc(o.label) + '</option>',
      )
      .join('') +
    '</select></label>' +
    '<button class="secondary" data-action="cancelCard">取消</button><button class="primary" data-action="confirmCard"' +
    (!choice ? ' disabled' : '') +
    '>确认使用</button></div>' +
    (choice
      ? '<p class="target-help">' +
        esc(choice.description || choice.label) +
        (choice.tiles?.length
          ? ' · ' +
            choice.tiles.map((id) => esc(map.tiles[id]?.short || map.tiles[id]?.name || '')).join('、')
          : '') +
        '</p>'
      : '<p class="target-help">绿色为合法目标，橙色为选中后的影响范围。</p>')
  );
}
