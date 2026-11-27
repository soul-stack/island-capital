import { CARD_SPECS, RECIPES } from './cards-data.mjs';
import { getMap } from './shared/maps.mjs';

export const CARDS = CARD_SPECS;
const byId = new Map(CARDS.map((card) => [card.id, card]));
export const cardShop = CARDS.filter((card) => card.price > 0);
export const cardRecipes = RECIPES.map((recipe) => ({
  ...recipe,
  label:
    Object.entries(recipe.inputs)
      .map(([id, n]) => byId.get(id).name + ' × ' + n)
      .join(' ＋ ') +
    ' → ' +
    byId.get(recipe.out).name,
}));
const eventDeck = CARDS.filter((card) => card.source.includes('机遇'));
const trailMap = (state) => getMap(state.mapId ?? 'mistport');
const active = (state, until) => Number(until) > state.round;
const rule = (ok, text) => {
  if (!ok) throw new Error(text);
};
const effects = (p) => p.effects ?? {};
const marks = (state) => state.cardBoard?.marks ?? {};
const liveMark = (state, id) => {
  const mark = marks(state)[id];
  return mark && active(state, mark.until) ? mark : null;
};
const districtKey = (owner, district) => owner + '|' + district;

export function initCards(state, fresh = false) {
  state.cardBoard ??= { marks: {}, lots: {}, districts: {}, slips: 0 };
  for (const p of state.players) {
    p.effects ??= {};
    p.items ??= {};
    if (fresh) for (const id of ['compass', 'barrier', 'crew']) p.items[id] = (p.items[id] ?? 0) + 1;
  }
}

// The last exit remains traversable even in an imported or outdated snapshot.
export function cardExits(state, player, at, exits) {
  if (exits.length < 2) return exits;
  const allowed = exits.filter((to) => liveMark(state, to)?.kind !== 'barrier');
  const open = allowed.length ? allowed : exits;
  if (effects(player).diversion || effects(player).divertActive) {
    const branch = open.find((to) => to !== exits[0]);
    if (branch !== undefined) return [branch];
  }
  return open;
}

const graphs = new WeakMap();
function bidirectional(map) {
  if (!graphs.has(map)) {
    const graph = map.next.map((exits) => new Set(exits));
    map.next.forEach((exits, from) => exits.forEach((to) => graph[to].add(from)));
    graphs.set(
      map,
      graph.map((ids) => [...ids]),
    );
  }
  return graphs.get(map);
}
function distances(state, p, limit, forward = false) {
  const map = trailMap(state),
    graph = forward ? map.next : bidirectional(map);
  const result = new Map([[p.pos, 0]]),
    queue = [p.pos];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      distance = result.get(id);
    if (distance >= limit) continue;
    const exits = forward ? cardExits(state, p, id, graph[id]) : graph[id];
    for (const to of exits)
      if (!result.has(to)) {
        result.set(to, distance + 1);
        queue.push(to);
      }
  }
  return result;
}

function stopsAt(mark, p) {
  return mark && (mark.kind === 'barrier' || (mark.kind === 'stop' && mark.owner !== p.id));
}
function nearestBank(map, start) {
  const graph = bidirectional(map),
    visited = new Set([start]),
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (map.tiles[id].type === 'bank') return id;
    for (const to of graph[id])
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
  }
  return null;
}
function exchangePair(p, other) {
  const sorted = cardShop.slice().sort((a, b) => a.price - b.price);
  const gift = sorted.find((c) => p.items[c.id] > 0);
  const take = sorted.reverse().find((c) => other.items[c.id] > 0 && c.id !== gift?.id);
  return gift && take ? [gift, take] : null;
}
function swapPartner(s, p, selected) {
  const owned = Object.entries(s.properties).filter(
    ([id, d]) => Number(id) !== selected && d.owner === p.id && d.level !== s.properties[selected]?.level,
  );
  owned.sort(([a, x], [b, y]) => y.level - x.level || Number(a) - Number(b));
  return owned.length ? Number(owned[0][0]) : null;
}
function primeLot(s, p) {
  const tiles = trailMap(s).tiles;
  return (
    tiles.filter((t) => s.properties[t.id]?.owner === p.id).sort((a, b) => b.price - a.price || a.id - b.id)[0]?.id ??
    null
  );
}
function relocation(s, id) {
  const map = trailMap(s),
    mark = liveMark(s, id);
  if (!mark) return null;
  const fork = map.next.find((exits) => exits.length > 1 && exits.includes(id));
  const candidates = fork ?? map.next[id];
  return candidates.find((to) => to !== id && to !== 0 && !liveMark(s, to)) ?? null;
}
function rollEnds(state, p, steps, firstTile = null, alreadySlipped = 0) {
  const map = trailMap(state),
    ends = new Set();
  function step(to, left, slips, consumed) {
    const mark = consumed.includes(to) ? null : liveMark(state, to);
    if (mark?.kind === 'shuttle' && mark.owner !== p.id) {
      ends.add(nearestBank(map, to) ?? to);
      return;
    }
    const followsSlip = mark?.kind === 'slip' && slips < 3;
    const brake = mark?.kind === 'redirector' && mark.owner !== p.id;
    const remaining = left - 1 + Number(followsSlip) - (brake ? 2 : 0);
    if (remaining <= 0 || stopsAt(mark, p)) {
      ends.add(to);
      return;
    }
    const nextConsumed = followsSlip || brake ? [...consumed, to] : consumed;
    for (const next of cardExits(state, p, to, map.next[to])) {
      step(next, remaining, slips + Number(followsSlip), nextConsumed);
    }
  }
  const exits = cardExits(state, p, p.pos, map.next[p.pos]);
  for (const to of exits) if (firstTile === null || firstTile === to) step(to, steps, alreadySlipped, []);
  return [...ends];
}
export function previewRouteStops(state, player, firstTile, stepsRemaining) {
  if (!player || !Number.isInteger(stepsRemaining) || stepsRemaining < 1) return [];
  return rollEnds(state, player, stepsRemaining, firstTile, state.cardBoard?.slips ?? 0);
}

function hasHarm(s, p) {
  const e = effects(p);
  return Boolean(
    e.limit ||
      e.invoice ||
      e.diversion ||
      e.divertActive ||
      e.nap ||
      e.caseLot != null ||
      active(s, e.lockedUntil) ||
      active(s, e.embargoUntil),
  );
}
function hasBenefit(p) {
  return Boolean(effects(p).grant || effects(p).convoy);
}
function selfAvailable(s, p, id) {
  const e = effects(p);
  if (id === 'shield' || id === 'permit' || id === 'boost') return !p[id] && !(id === 'boost' && p.delayed);
  if (id === 'ward' || id === 'mirror' || id === 'convoy') return !e[id];
  if (id === 'patron' || id === 'guild') return !e.grant;
  if (id === 'boom') return !active(s, e.boomUntil) && Object.values(s.properties).some((deed) => deed.owner === p.id);
  return true;
}
function personAvailable(s, p, other, id) {
  const e = effects(other);
  if (id === 'dispel') return other.id === p.id ? hasHarm(s, p) : hasBenefit(other);
  if (other.id === p.id) return false;
  if (id === 'slow' || id === 'hold') return !e.limit;
  if (id === 'deadline') return !e.invoice;
  if (id === 'fog') return !active(s, e.lockedUntil);
  if (id === 'sample') return cardShop.some((c) => other.items[c.id] > 0);
  if (id === 'exchange') return Boolean(exchangePair(p, other));
  if (id === 'diversion') return !e.diversion && !e.divertActive && trailMap(s).next.some((exits) => exits.length > 1);
  if (id === 'hibernate') return !other.delayed;
  if (id === 'casework') return e.caseLot == null && primeLot(s, other) != null;
  if (id === 'dispatch') return nearestBank(trailMap(s), other.pos) !== other.pos;
  if (id === 'embargo')
    return !active(s, e.embargoUntil) && Object.values(s.properties).some((d) => d.owner === other.id);
  if (id === 'levy' || id === 'fee') return other.cash > 0;
  if (id === 'settle') return Math.abs(other.cash - p.cash) >= 2;
  return true;
}
const choice = (value, label, tiles, description) => ({ value, label, tiles, description });
function lotAvailable(s, p, t, id) {
  if (t.type !== 'property') return false;
  const d = s.properties[t.id],
    flags = s.cardBoard?.lots?.[t.id] ?? {};
  if (id === 'charter') return !d && p.cash >= t.price;
  if (id === 'crew') return d?.owner === p.id && d.level < 3 && !s.upgradedThisTurn;
  if (id === 'swapgrade') return d?.owner === p.id && swapPartner(s, p, t.id) != null;
  if (id === 'refit') return d?.owner === p.id && !active(s, flags.refit);
  if (id === 'promotion')
    return d?.owner === p.id && !active(s, s.cardBoard?.districts?.[districtKey(p.id, t.district)]);
  if (!d || d.owner === p.id) return false;
  if (id === 'closure') return !active(s, flags.closure);
  if (id === 'districtAudit') return !active(s, flags.inspection);
  return d.level > 1;
}
function affectedLots(s, p, t, id) {
  const map = trailMap(s);
  if (id === 'promotion')
    return map.tiles.filter((x) => x.district === t.district && s.properties[x.id]?.owner === p.id).map((x) => x.id);
  if (id === 'rezone')
    return map.tiles
      .filter((x) => x.district === t.district && lotAvailable(s, p, x, id))
      .sort((a, b) => s.properties[b.id].level - s.properties[a.id].level || a.id - b.id)
      .slice(0, 2)
      .map((x) => x.id);
  if (id === 'swapgrade') return [t.id, swapPartner(s, p, t.id)];
  if (id === 'districtAudit')
    return [t.id, ...bidirectional(map)[t.id]].filter((id) => s.properties[id] && s.properties[id].owner !== p.id);
  return [t.id];
}

export function cardTargets(state, playerId, cardId) {
  const c = byId.get(cardId),
    p = state.players.find((v) => v.id === playerId);
  if (!c || !p || p.out) return [];
  const map = trailMap(state);
  if (c.aim === 'self' || c.aim === 'all') {
    if (!selfAvailable(state, p, c.id)) return [];
    let tiles = [p.pos];
    if (c.id === 'cleanup')
      tiles = [
        ...new Set([
          ...Object.keys(marks(state))
            .filter((id) => liveMark(state, id))
            .map(Number),
          ...state.players
            .filter(
              (v) =>
                hasHarm(state, v) ||
                hasBenefit(v) ||
                v.effects?.ward ||
                v.effects?.mirror ||
                v.effects?.exact ||
                active(state, v.effects?.boomUntil) ||
                v.shield ||
                v.boost ||
                v.permit,
            )
            .map((v) => v.pos),
        ]),
      ];
    else if (c.id === 'boom')
      tiles = Object.keys(state.properties)
        .filter((id) => state.properties[id].owner === p.id)
        .map(Number);
    else if (c.id === 'fleet')
      tiles = state.players
        .filter((v) => v.id !== p.id && !v.out && v.cash > 0)
        .sort((a, b) => b.cash - a.cash)
        .slice(0, 3)
        .map((v) => v.pos);
    else if (c.id === 'pool') {
      const ordered = state.players.filter((v) => !v.out).sort((a, b) => b.cash - a.cash);
      if (ordered[0].cash - ordered.at(-1).cash < 2) return [];
      tiles = [ordered[0].pos, ordered.find((v) => v.cash === ordered.at(-1).cash).pos];
    } else if (c.aim === 'all') tiles = [...new Set(state.players.filter((v) => !v.out).map((v) => v.pos))];
    if (!tiles.length) return [];
    return [choice('self', c.aim === 'all' ? '全场' : p.name, tiles, c.description)];
  }
  if (c.aim === 'steps') {
    if (p.delayed || effects(p).exact) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const tiles = rollEnds(state, p, i + 1);
      return choice(i + 1, i + 1 + ' 步', tiles, '可能落点：' + tiles.map((n) => map.tiles[n].name).join('、'));
    });
  }
  const radius = c.radius || map.tiles.length;
  const nearby = distances(state, p, radius, c.id === 'beacon');
  if (c.aim === 'person' || c.aim === 'negative') {
    return state.players
      .filter((v) => !v.out && nearby.has(v.pos) && personAvailable(state, p, v, c.id))
      .map((v) =>
        choice(
          v.id,
          v.name,
          c.id === 'dispatch'
            ? [v.pos, nearestBank(map, v.pos)]
            : c.id === 'casework'
              ? [v.pos, primeLot(state, v)]
              : [v.pos],
          map.tiles[v.pos].name + ' · ' + c.description,
        ),
      );
  }
  const forked = map.next.some((exits) => exits.length > 1);
  const forkEntries = new Set(map.next.filter((exits) => exits.length > 1).flat());
  const targets = [];
  for (const [id, distance] of nearby) {
    const tile = map.tiles[id],
      mark = liveMark(state, id);
    let tiles = [id];
    if (c.aim === 'fork') {
      if (mark || !distance || id === 0) continue;
      if (
        forked &&
        (!forkEntries.has(id) ||
          map.next.some(
            (exits) =>
              exits.length > 1 &&
              exits.includes(id) &&
              !exits.some((to) => to !== id && liveMark(state, to)?.kind !== 'barrier'),
          ))
      )
        continue;
    } else if (c.aim === 'mark') {
      if (!mark) continue;
      if (c.id === 'signal') {
        const to = relocation(state, id);
        if (to == null) continue;
        tiles = [id, to];
      }
    } else if (c.aim === 'street') {
      if (c.id === 'areaFee') {
        const area = distances(state, { ...p, pos: id }, 2);
        if (!state.players.some((v) => v.id !== p.id && !v.out && v.cash > 0 && area.has(v.pos))) continue;
        tiles = [...area.keys()];
      } else {
        if (!distance || (c.id === 'beacon' ? p.delayed || effects(p).exact : mark || id === 0)) continue;
        if (c.id === 'beacon' && !rollEnds(state, p, distance).includes(id)) continue;
        if (c.id === 'shuttle') {
          const bank = nearestBank(map, id);
          if (bank == null || bank === id) continue;
          tiles = [id, bank];
        }
      }
    } else {
      if (!lotAvailable(state, p, tile, c.id)) continue;
      tiles = affectedLots(state, p, tile, c.id);
    }
    const label = tile.name + ' · ' + distance + ' 格';
    targets.push(
      choice(id, label, tiles, c.id === 'beacon' ? '设定 ' + distance + ' 步，岔路需自行选择。' : c.description),
    );
  }
  return targets;
}

export function cardCanUse(state, playerId, id) {
  const p = state.players[state.turn];
  return Boolean(
    p?.id === playerId &&
      !p.out &&
      p.items?.[id] > 0 &&
      state.phase === 'roll' &&
      !state.usedThisTurn &&
      !active(state, effects(p).lockedUntil) &&
      cardTargets(state, playerId, id).length,
  );
}
export function cardRentFactor(state, tileId, ownerId) {
  if (!ownerId) return 1;
  const map = trailMap(state),
    tile = map.tiles[tileId],
    owner = state.players.find((p) => p.id === ownerId);
  if (!tile || !owner) return 1;
  const e = effects(owner),
    flags = state.cardBoard?.lots?.[tileId] ?? {};
  if (e.caseLot === Number(tileId)) return 0;
  const growth = Math.max(
    1,
    active(state, e.boomUntil) ? 1.55 : 1,
    active(state, state.cardBoard?.districts?.[districtKey(ownerId, tile.district)]) ? 1.4 : 1,
    active(state, flags.refit) ? 1.3 : 1,
  );
  const discount =
    active(state, e.embargoUntil) || active(state, flags.closure) ? 0.5 : active(state, flags.inspection) ? 0.7 : 1;
  return growth * discount;
}
export function cardDistance(state, p, distance) {
  const e = (p.effects ??= {});
  if (state.cardBoard) state.cardBoard.slips = 0;
  if (e.diversion) {
    e.divertActive = true;
    delete e.diversion;
  } else delete e.divertActive;
  if (e.convoy) {
    distance += 2;
    if (--e.convoy === 0) delete e.convoy;
  }
  if (e.limit) {
    distance = Math.min(distance, e.limit.max);
    if (--e.limit.rolls === 0) delete e.limit;
  }
  if (e.exact) {
    distance = e.exact;
    delete e.exact;
  }
  return distance;
}

function takeFee(s, p, maximum, reason, ctx, recipient = null) {
  const amount = Math.min(p.cash, Math.max(0, Math.floor(maximum)));
  if (amount > 0) ctx.charge(s, p, amount, reason, recipient);
  return amount;
}
function protectedFrom(s, victim, actor, card, ctx) {
  if (!victim || victim.id === actor.id) return false;
  const e = victim.effects;
  if (e.mirror) {
    delete e.mirror;
    const amount = takeFee(s, actor, 320, '回执印反制', ctx);
    ctx.record(s, `${victim.name} 的回执印撤回了${actor.name}的${card.name}，发起人另付 ${amount}。`, 'item');
    return true;
  }
  if (e.ward) {
    delete e.ward;
    ctx.record(s, `${victim.name} 以抗辩函抵消了${actor.name}的${card.name}。`, 'item');
    return true;
  }
  return false;
}

function resolveMark(s, p, ctx) {
  const source = p.pos,
    mark = liveMark(s, source);
  if (!mark) return;
  const where = trailMap(s).tiles[p.pos].name;
  if (mark.kind === 'slip') {
    if (s.cardBoard.slips >= 3) return;
    s.cardBoard.slips++;
    s.stepsRemaining++;
    ctx.record(s, `${p.name} 经过${where}的顺流标，额外前进一格。`, 'move');
  } else if (stopsAt(mark, p)) {
    s.stepsRemaining = 0;
    ctx.record(s, `${p.name} 受${where}的${byId.get(mark.kind).name}拦停，在此结算。`, 'move');
  } else if ((mark.kind === 'toll' || mark.kind === 'bondgate') && mark.owner !== p.id) {
    const collector = mark.kind === 'bondgate' ? s.players.find((v) => v.id === mark.owner && !v.out) : null;
    const fee = takeFee(s, p, mark.kind === 'toll' ? 380 : 250, byId.get(mark.kind).name, ctx, collector);
    ctx.record(s, `${p.name} 经过${where}，向${collector?.name ?? '公共资金'}支付 ${fee}。`, 'item');
  } else if (mark.kind === 'redirector' && mark.owner !== p.id) {
    s.stepsRemaining = Math.max(0, s.stepsRemaining - 2);
    ctx.record(s, `${p.name} 经过${where}的缓冲带，本程剩 ${s.stepsRemaining} 步。`, 'move');
  } else if (mark.kind === 'shuttle' && mark.owner !== p.id) {
    const map = trailMap(s),
      dest = nearestBank(map, p.pos);
    if (dest == null) return;
    p.pos = dest;
    s.stepsRemaining = 0;
    ctx.record(s, `${p.name} 从${where}转乘摆渡，直达${map.tiles[dest].name}。`, 'move');
  } else return;
  delete s.cardBoard.marks[source];
}
export function enterCardTile(s, p, ctx) {
  resolveMark(s, p, ctx);
  if (s.stepsRemaining === 0) delete p.effects.divertActive;
}

export function beginCardTurn(s, p, ctx) {
  initCards(s);
  const board = s.cardBoard;
  for (const [id, m] of Object.entries(board.marks)) if (!active(s, m.until)) delete board.marks[id];
  for (const [key, until] of Object.entries(board.districts)) if (!active(s, until)) delete board.districts[key];
  for (const [id, flags] of Object.entries(board.lots)) {
    for (const [key, until] of Object.entries(flags)) if (!active(s, until)) delete flags[key];
    if (!Object.keys(flags).length) delete board.lots[id];
  }
  const e = p.effects;
  if (!p.delayed) delete e.nap;
  if (e.caseLot != null) {
    ctx.record(s, `${p.name} 领回营业执照，原地产恢复收租。`, 'item');
    delete e.caseLot;
  }
  for (const key of ['lockedUntil', 'embargoUntil', 'boomUntil']) if (e[key] && !active(s, e[key])) delete e[key];
  if (e.invoice) {
    const amount = takeFee(s, p, 500, '到期函兑付', ctx);
    delete e.invoice;
    ctx.record(s, `${p.name} 的到期函已兑付 ${amount}。`, 'item');
  }
  if (e.grant) {
    const amount = e.grant.amount;
    ctx.addCash(s, p, amount, 'card', '赞助合约入账');
    if (--e.grant.left === 0) delete e.grant;
    ctx.record(s, `${p.name} 收到本回合合约赞助 ${amount}。`, 'bonus');
  }
}

export function awardCardEvent(s, p, rng, ctx) {
  initCards(s);
  const index = Math.floor(rng() * eventDeck.length);
  rule(index >= 0 && index < eventDeck.length, '补给抽取无效');
  const c = eventDeck[index];
  p.items[c.id] = (p.items[c.id] ?? 0) + 1;
  ctx.record(s, `${p.name} 在机遇补给中收到${c.name}。`, 'item');
  return c.id;
}

function applyEffect(s, p, c, target, ctx) {
  const map = trailMap(s),
    board = s.cardBoard;
  const who = s.players.find((v) => v.id === target.value);
  const tile = typeof target.value === 'number' ? map.tiles[target.value] : null;
  const owner = tile && s.players.find((v) => v.id === s.properties[tile.id]?.owner);
  const e = p.effects;
  const hostile = who ?? (c.aim === 'rivalLot' ? owner : null);
  if (!['rezone', 'districtAudit'].includes(c.id) && protectedFrom(s, hostile, p, c, ctx)) return;
  switch (c.id) {
    case 'permit':
      if (p.delayed) {
        p.delayed = false;
        delete e.nap;
      } else p.permit = true;
      break;
    case 'shield':
    case 'boost':
      p[c.id] = true;
      break;
    case 'compass':
      e.exact = target.value;
      break;
    case 'beacon':
      e.exact = distances(s, p, c.radius, true).get(target.value);
      break;
    case 'crew':
      s.properties[tile.id].level++;
      s.upgradedThisTurn = true;
      break;
    case 'charter':
      ctx.addCash(s, p, -tile.price, 'purchase', c.name + ' · ' + tile.name);
      s.properties[tile.id] = { owner: p.id, level: 1 };
      break;
    case 'refit':
    case 'closure':
      (board.lots[tile.id] ??= {})[c.id] = s.round + 2;
      break;
    case 'inspect':
      s.properties[tile.id].level--;
      break;
    case 'swapgrade': {
      const [a, b] = target.tiles,
        first = s.properties[a],
        second = s.properties[b];
      [first.level, second.level] = [second.level, first.level];
      ctx.record(s, `${p.name} 调换了${map.tiles[a].name}与${map.tiles[b].name}的建设等级。`, 'item');
      break;
    }
    case 'districtAudit': {
      const owners = new Map();
      for (const id of target.tiles) {
        const rival = s.players.find((v) => v.id === s.properties[id].owner);
        if (!owners.has(rival.id)) owners.set(rival.id, protectedFrom(s, rival, p, c, ctx));
        if (!owners.get(rival.id)) (board.lots[id] ??= {}).inspection = s.round + 2;
      }
      break;
    }
    case 'rezone': {
      const denied = new Map();
      for (const id of target.tiles) {
        const d = s.properties[id],
          rival = s.players.find((v) => v.id === d.owner);
        if (!denied.has(rival.id)) denied.set(rival.id, protectedFrom(s, rival, p, c, ctx));
        if (!denied.get(rival.id)) {
          d.level--;
          ctx.record(s, `${rival.name} 的${map.tiles[id].name}已降至 ${d.level} 级。`, 'item');
        }
      }
      break;
    }
    case 'promotion':
      board.districts[districtKey(p.id, tile.district)] = s.round + 2;
      break;
    case 'barrier':
    case 'toll':
    case 'slip':
    case 'stop':
    case 'bondgate':
    case 'redirector':
    case 'shuttle':
      board.marks[tile.id] = { kind: c.id, owner: p.id, until: s.round + 2 };
      break;
    case 'sweep':
      delete board.marks[tile.id];
      break;
    case 'signal': {
      const to = target.tiles[1];
      board.marks[to] = board.marks[tile.id];
      delete board.marks[tile.id];
      ctx.record(s, `${p.name} 将${tile.name}的路标移至${map.tiles[to].name}。`, 'item');
      break;
    }
    case 'ward':
    case 'mirror':
      e[c.id] = true;
      break;
    case 'slow':
      who.effects.limit = { rolls: 2, max: 3 };
      break;
    case 'hold':
      who.effects.limit = { rolls: 1, max: 1 };
      break;
    case 'diversion':
      who.effects.diversion = true;
      break;
    case 'hibernate':
      if (who.permit) {
        who.permit = false;
        ctx.record(s, `${who.name} 的通行证已抵消休整。`, 'item');
      } else {
        who.delayed = true;
        who.effects.nap = true;
      }
      break;
    case 'casework':
      who.effects.caseLot = primeLot(s, who);
      break;
    case 'dispatch': {
      const old = who.pos;
      who.pos = nearestBank(map, old);
      s.lastMove = { id: (s.lastMove?.id ?? 0) + 1, playerId: who.id, path: [old, who.pos] };
      ctx.record(s, `${who.name} 搭乘联络线抵达${map.tiles[who.pos].name}，下次从这里出发。`, 'move');
      break;
    }
    case 'fog':
      who.effects.lockedUntil = s.round + 2;
      break;
    case 'deadline':
      who.effects.invoice = true;
      break;
    case 'fee':
      takeFee(s, who, 450, c.name, ctx);
      break;
    case 'areaFee':
      for (const rival of s.players.filter((v) => v.id !== p.id && !v.out && target.tiles.includes(v.pos))) {
        if (!protectedFrom(s, rival, p, c, ctx)) takeFee(s, rival, 270, c.name, ctx);
      }
      break;
    case 'levy':
      takeFee(s, who, Math.min(500, who.cash * 0.1), c.name, ctx, p);
      break;
    case 'settle': {
      const [rich, poor] = p.cash >= who.cash ? [p, who] : [who, p];
      takeFee(s, rich, Math.min(650, (rich.cash - poor.cash) / 2), c.name, ctx, poor);
      break;
    }
    case 'pool': {
      const ordered = s.players
          .filter((v) => !v.out)
          .slice()
          .sort((a, b) => b.cash - a.cash),
        rich = ordered[0];
      const poor = ordered.find((v) => v.cash === ordered.at(-1).cash);
      if (rich !== poor && !protectedFrom(s, rich, p, c, ctx))
        takeFee(s, rich, Math.min(850, (rich.cash - poor.cash) / 2), c.name, ctx, poor);
      break;
    }
    case 'patron':
      e.grant = { left: 2, amount: 240 };
      break;
    case 'guild':
      e.grant = { left: 3, amount: 450 };
      break;
    case 'dispel':
      if (who === p && who.effects.nap) who.delayed = false;
      for (const key of who === p
        ? ['limit', 'invoice', 'lockedUntil', 'embargoUntil', 'diversion', 'divertActive', 'nap', 'caseLot']
        : ['grant', 'convoy'])
        delete who.effects[key];
      break;
    case 'sample': {
      const loot = cardShop.filter((v) => who.items[v.id] > 0).sort((a, b) => b.price - a.price)[0];
      who.items[loot.id]--;
      p.items[loot.id] = (p.items[loot.id] ?? 0) + 1;
      ctx.record(s, `${p.name} 从${who.name}处调入${loot.name}一张。`, 'item');
      break;
    }
    case 'exchange': {
      const [gift, take] = exchangePair(p, who);
      p.items[gift.id]--;
      who.items[gift.id] = (who.items[gift.id] ?? 0) + 1;
      who.items[take.id]--;
      p.items[take.id] = (p.items[take.id] ?? 0) + 1;
      ctx.record(s, `${p.name} 给${who.name}一张${gift.name}，换回一张${take.name}。`, 'item');
      break;
    }
    case 'convoy':
      e.convoy = 2;
      break;
    case 'fleet':
      for (const rival of s.players
        .filter((v) => !v.out && v.id !== p.id)
        .sort((a, b) => b.cash - a.cash)
        .slice(0, 3)) {
        if (!protectedFrom(s, rival, p, c, ctx)) takeFee(s, rival, 350, c.name, ctx);
      }
      break;
    case 'boom':
      e.boomUntil = s.round + 3;
      break;
    case 'embargo':
      who.effects.embargoUntil = s.round + 2;
      break;
    case 'cleanup':
      board.marks = {};
      for (const v of s.players) {
        if (v.effects.nap) v.delayed = false;
        v.effects = {};
        v.shield = false;
        v.boost = false;
        v.permit = false;
      }
      break;
    default:
      throw new Error('未知卡牌');
  }
}

export function applyCardAction(s, p, action, ctx) {
  if (!['use', 'shop', 'craft'].includes(action.type)) return false;
  const c = byId.get(action.item);
  rule(c, '未知卡牌');
  initCards(s);
  if (action.type === 'shop') {
    rule(s.phase === 'shop' && c.price > 0, '请在商店选择一张上架卡牌');
    rule(p.cash >= c.price, '现金不足，无法购买卡牌');
    ctx.addCash(s, p, -c.price, 'shop', '购入' + c.name);
    p.items[c.id] = (p.items[c.id] ?? 0) + 1;
    s.phase = 'end';
    ctx.record(s, `${p.name} 花费 ${c.price} 购入${c.name}。`, 'shop');
    return true;
  }
  rule(s.phase === 'roll' && !s.usedThisTurn, '每回合掷骰前可用卡或合成一次');
  rule(!active(s, p.effects.lockedUntil), '手牌正被封存，待封签解除后可用');
  if (action.type === 'craft') {
    const recipe = cardRecipes.find((r) => r.out === c.id);
    rule(recipe && Object.entries(recipe.inputs).every(([id, n]) => (p.items[id] ?? 0) >= n), '合成材料不足');
    for (const [id, n] of Object.entries(recipe.inputs)) p.items[id] -= n;
    p.items[c.id] = (p.items[c.id] ?? 0) + 1;
    s.usedThisTurn = true;
    ctx.record(s, `${p.name} 完成合成：${recipe.label}。`, 'item');
    return true;
  }
  rule(p.items[c.id] > 0, '背包中没有这张卡');
  const candidates = cardTargets(s, p.id, c.id);
  const specified = action.target ?? (c.aim === 'self' || c.aim === 'all' ? 'self' : undefined);
  const selected = candidates.find(
    (t) =>
      t.value === specified ||
      (typeof t.value === 'number' && typeof specified === 'string' && String(t.value) === specified),
  );
  rule(selected, '目标不合法或同类效果已生效');
  p.items[c.id]--;
  s.usedThisTurn = true;
  ctx.record(s, `${p.name} 使用${c.name}，目标${selected.label}。${c.description}`, 'item');
  applyEffect(s, p, c, selected, ctx);
  return true;
}

export function cardBotAction(s, p) {
  if (s.phase === 'shop') {
    const needed = p.cash < 2700 ? ['sweep', 'compass'] : ['compass', 'ward', 'barrier', 'crew', 'shield'];
    const card = needed
      .map((id) => byId.get(id))
      .find(
        (c) =>
          !p.items[c.id] &&
          p.cash >= c.price + 1300 &&
          (c.id !== 'sweep' || Object.keys(marks(s)).some((id) => liveMark(s, id))),
      );
    return card ? { type: 'shop', item: card.id } : { type: 'end' };
  }
  if (s.phase !== 'roll' || s.usedThisTurn || active(s, effects(p).lockedUntil)) return null;
  const map = trailMap(s);
  function option(id, select = (choices) => choices[0]) {
    if (!p.items[id]) return null;
    const target = select(cardTargets(s, p.id, id));
    return target ? { type: 'use', item: id, target: target.value } : null;
  }
  const enemies = s.players.filter((x) => !x.out && x.id !== p.id);
  const estateValue = (id) => (s.properties[id]?.owner === p.id ? map.tiles[id].price : 0);
  const bestEstate = (list) => list.sort((a, b) => estateValue(b.value) - estateValue(a.value))[0];
  if (p.delayed) return option('permit');
  const choice1 =
    option('dispel', (list) => list.find((t) => t.value === p.id)) ||
    (p.cash < 8000 &&
      option(
        'levy',
        (list) =>
          list.sort(
            (a, b) => s.players.find((x) => x.id === b.value).cash - s.players.find((x) => x.id === a.value).cash,
          )[0],
      )) ||
    option('crew', bestEstate) ||
    option('guild') ||
    option('patron') ||
    option('boom');
  if (choice1) return choice1;
  if (p.cash < 3600 || p.cash > 20000) {
    const bank = option('compass', (list) => list.find((t) => t.tiles.some((id) => map.tiles[id].type === 'bank')));
    if (bank) return bank;
  }
  if (p.items.barrier) {
    const blockedChoices = cardTargets(s, p.id, 'barrier');
    const fence = option('barrier', () => {
      // Shut the less profitable exit when a rival is poised at a junction.
      for (const rival of enemies) {
        const exits = map.next[rival.pos];
        if (exits.length < 2) continue;
        const candidates = blockedChoices.filter((t) => exits.includes(t.value));
        candidates.sort((a, b) => estateValue(a.value) - estateValue(b.value));
        if (candidates.length) return candidates[0];
      }
    });
    if (fence) return fence;
  }
  const recipe = cardRecipes.find((r) => Object.entries(r.inputs).every(([id, n]) => p.items[id] >= n));
  if (recipe) return { type: 'craft', item: recipe.out };
  if (s.round > 1) {
    const defense =
      option('ward') ||
      option('mirror') ||
      (Object.values(s.properties).some((d) => d.owner !== p.id) && option('shield'));
    if (defense) return defense;
    for (const id of [
      'fleet',
      'embargo',
      'rezone',
      'sample',
      'exchange',
      'inspect',
      'districtAudit',
      'promotion',
      'refit',
      'closure',
      'casework',
      'swapgrade',
      'areaFee',
      'slow',
      'fee',
      'fog',
      'convoy',
      'boost',
      'hold',
      'deadline',
      'settle',
      'beacon',
      'stop',
      'toll',
      'slip',
      'charter',
      'pool',
      'cleanup',
      'sweep',
      'diversion',
      'hibernate',
      'signal',
      'bondgate',
      'redirector',
      'shuttle',
      'dispatch',
    ]) {
      const use = option(id, (list) =>
        id === 'settle' ? list.find((t) => s.players.find((v) => v.id === t.value).cash > p.cash) : list[0],
      );
      if (use) return use;
    }
  }
  return null;
}

const emblems = {
  travel: 'M3 15 19 6l-6 15-2-8z M11 13l8-7',
  roads: 'M3 18 8 5h8l5 13 M5 12h14 M11 6v3m1 5v3',
  estate: 'M3 19h18M5 18V9l7-5 7 5v9M8 11h1m5 0h1m-7 3h1m5 0h1',
  funds: 'M4 9l8-5 8 5-8 5z M4 13l8 5 8-5m-16 4 8 5 8-5',
  ward: 'M4 6l8-3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9z M8 11l3 3 5-6',
  status: 'M5 4h14M5 20h14M7 4c0 4 1 5 5 8-4 3-5 5-5 8m10-16c0 4-1 5-5 8 4 3 5 5 5 8',
};
const details = {
  shield: 'M9 11l2 2 4-5',
  boost: 'M4 9h5M3 12h4',
  permit: 'M9 13h6m-3-3v6',
  compass: 'M5 5l2 1m11 12 2 1',
  barrier: 'M4 9l3 3m1-3 3 3m2-3 3 3',
  crew: 'M3 4h9m-2-2 2 2-2 2',
  sweep: 'M2 19l4-2m-3 4 4-2',
  ward: 'M9 9h6v6H9z',
  slow: 'M4 17h5m-7 3h5',
  hold: 'M8 9v5m4-5v5',
  fog: 'M2 13h7m-5 3h6',
  toll: 'M16 3h5v4h-5z',
  slip: 'M2 19q3-4 6 0t6 0',
  stop: 'M9 9h6v6H9z',
  deadline: 'M15 7l2 2 3-3',
  fee: 'M3 6h4m-4 2h4',
  levy: 'M15 4v6m-3-3 3 3 3-3',
  settle: 'M4 9h5l-2-2m14 10h-5l2 2',
  pool: 'M5 4l3 3m11-3-3 3',
  patron: 'M18 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  dispel: 'M4 18 20 4',
  sample: 'M3 7h5v5H3z',
  mirror: 'M10 6l-3 3m5-2-4 4',
  charter: 'M14 3h6v6m-6 0 6-6',
  refit: 'M4 7l7-5 3 2',
  closure: 'M8 11l7 5m-7 0 7-5',
  inspect: 'M13 13a3 3 0 1 0 .1 0m2 5 4 3',
  promotion: 'M3 8l3-1V3l4 2',
  beacon: 'M5 10V3l5 2-5 2',
  convoy: 'M2 8h4m-1 11h4m7-16h4',
  fleet: 'M2 7h7m-7 3h4m12 9 3 2',
  boom: 'M4 10V4m-2 2 2-2 2 2',
  embargo: 'M2 6h7m-6 2h5',
  cleanup: 'M16 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z',
  rezone: 'M5 5h4l-2 3 3 1-3 3',
  guild: 'M3 6l2 2 2-3 2 3 2-2-1 5H4z',
  swapgrade: 'M2 10l4-4 3 3m13 4-4 4-3-3',
  districtAudit: 'M2 14h8m-5 3h5',
  diversion: 'M2 18l4-3v-4l5-2',
  hibernate: 'M3 7h6l-6 4h6',
  casework: 'M12 3h7v4h-7z',
  areaFee: 'M2 5h5m-5 0v5m20 10h-5m5 0v-5',
  bondgate: 'M2 7l6-2 5 2m-8 1v3m4-3v3',
  redirector: 'M2 12h7l-3-3m3 3-3 3',
  shuttle: 'M3 6q4 6 9 0l-2 4H6z',
  dispatch: 'M15 7h6l-3-3m3 3-3 3',
  exchange: 'M2 5h7l-2-2m15 15h-7l2 2',
  signal: 'M3 18l4-7m-1-2 5-3',
};
export function cardIcon(id) {
  const c = byId.get(id);
  if (!c) return '';
  const index = CARDS.indexOf(c);
  const detail = Array.from(
    { length: 1 + (Math.floor(index / 6) % 3) },
    (_, n) => `<circle cx="${18 + n * 2}" cy="22" r=".65"/>`,
  ).join('');
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="${emblems[c.group]}"/><path d="${details[id]}" stroke-width="1.15"/><g fill="currentColor" stroke="none">${detail}</g></svg>`;
}
