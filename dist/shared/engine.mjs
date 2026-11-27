// The same rules run on the room server and in a browser practice game.
import { MAPS, getMap } from './maps.mjs';
import { BASE_INCOME, ensureEconomy, financeSummary, loanLimit, saleValue, addCash, charge, closeRound, doFinance, financeBot } from './economy.mjs';
import { CARDS, initCards, cardExits, cardRentFactor, cardDistance, enterCardTile, beginCardTurn, awardCardEvent, applyCardAction, cardBotAction } from '../cards.mjs';
export { BASE_INCOME, ensureEconomy, financeSummary, loanLimit, saleValue };

// Old snapshots and callers without a map selection use the original trade loop.
export const DISTRICTS = getMap('mistport').districts;
export const TILES = getMap('mistport').tiles;

export function hasGameMap(id) {
  return MAPS.some(map => map.id === id);
}

const mapOf = state => getMap(state.mapId ?? 'mistport');

// Retain the original public three-item list for existing browser integrations.
export const ITEMS=Object.freeze(CARDS.filter(item=>['shield','boost','permit'].includes(item.id)));

const MAX_LEVEL = 3;
const SALARY = 2000;
const MAX_LOG = 100;
const portsByMap = new Map();
for (const map of MAPS) {
  const groups = map.districts.map((_, index) =>
    map.tiles.filter(tile => tile.district === index && tile.type === 'property')
  );
  portsByMap.set(map.id, groups);
}
const rentalMultipliers = [0, 1, 1.85, 3];
const randomInt = (rng, length) => {
  const value = rng();
  if (!(value >= 0 && value < 1)) throw new Error('随机数无效');
  return Math.floor(value * length);
};
const requireRule = (condition, message) => {
  if (!condition) throw new Error(message);
};
const money = value => value.toLocaleString('en-US');

function record(state, text, type = 'event') {
  state.log.push({ id: ++state.eventSeq, round: state.round, playerId: state.players[state.turn]?.id, type, text });
  if (state.log.length > MAX_LOG) state.log.shift();
}

const cardContext={
  record,
  addCash:(s,p,amount,kind,text)=>addCash(s,p,amount,kind==='purchase'?'buy':kind,text),
  charge:(s,p,amount,reason,to)=>charge(s,p,amount,reason,to,'card'),
  maxLevel:()=>MAX_LEVEL
};

export function createGame(players, { maxRounds = 30, mapId = 'mistport' } = {}) {
  requireRule(hasGameMap(mapId), '请选择有效地图');
  requireRule(Array.isArray(players) && players.length >= 2 && players.length <= 12, '每局需要 2 至 12 位玩家');
  requireRule(Number.isInteger(maxRounds) && maxRounds > 0 && maxRounds <= 150, '轮数须为 1 至 150 的整数');
  const ids = new Set();
  const roster = players.map(player => {
    requireRule(typeof player?.id === 'string' && player.id.trim() && player.id.length <= 80 && !ids.has(player.id), '玩家编号无效或重复');
    requireRule(typeof player.name === 'string' && player.name.trim(), '玩家需要昵称');
    ids.add(player.id);
    return { id: player.id, name: Array.from(player.name.trim()).slice(0, 24).join(''), bot: Boolean(player.bot),
      pos: 0, cash: 0, out: false, items: { shield: 1, boost: 0, permit: 0 },
      shield: false, boost: false, permit: false, delayed: false };
  });
  const state = { mapId, stepsRemaining: 0, routeOptions: [], lastMove: null, lastRoll:null, players: roster, turn: 0, round: 1, maxRounds, phase: 'roll', properties: {}, dice: [],
    usedThisTurn: false, upgradedThisTurn: false, eventSeq: 0, log: [], winner: null };
  ensureEconomy(state);
  initCards(state,true);
  for(const p of roster)addCash(state,p,15000,'opening','开局资金');
  record(state, `玩家已在${mapOf(state).tiles[0].name}集结，每人获得 15,000 启动资金及免租券、测程罗盘、岔口围栏、街区工程队各一张。`, 'start');
  return state;
}

const buildPrice = tile => Math.round(tile.price * 0.55 / 50) * 50;

export function upgradeCost(state, tileId) {
  const tile = mapOf(state).tiles[tileId];
  const property = state.properties[tileId];
  if (tile?.type !== 'property' || !property || property.level >= MAX_LEVEL) return 0;
  return buildPrice(tile);
}

export function rentFor(state, tileId) {
  const map = mapOf(state);
  const tile = map.tiles[tileId];
  if (tile?.type !== 'property') return 0;
  const deed = state.properties[tileId];
  const monopoly = deed && portsByMap.get(map.id)[tile.district].every(t => state.properties[t.id]?.owner === deed.owner);
  return Math.round(tile.price * 0.18 * rentalMultipliers[deed?.level ?? 1] * (monopoly ? 1.5 : 1) * cardRentFactor(state,tileId,deed?.owner) / 10) * 10;
}

export function netWorth(state,playerOrId){
  return financeSummary(state,playerOrId)?.netWorth??0;
}

function finish(state) {
  const survivors = state.players.filter(p => !p.out);
  survivors.sort((a, b) => netWorth(state, b) - netWorth(state, a) || b.cash - a.cash);
  const winner = survivors[0];
  state.phase = 'finished';
  state.winner = winner.id;
  record(state, `${winner.name} 以 ${money(netWorth(state, winner))} 总资产赢得${mapOf(state).name}经营权！`, 'finish');
}

const localNews = {
  mistport: ['远洋订单成交', '风暴损坏货物', '船队赠礼', '港务嘉奖', '商会赠礼', '渔获分红'],
  skyrail: ['山货专列满载发车', '山洪冲坏货箱', '索道站寄来快件', '车务所发来调度许可', '山城商会赠礼', '观景列车分红'],
  saffron: ['香料商队签下订单', '沙暴损坏货架', '绿洲驿站赠礼', '商路关卡签发许可', '行商公会赠礼', '椰枣丰收分红']
};

const delays = {
  mistport: ['锚地放行', '需停航一回合'],
  skyrail: ['获准搭乘加班列车', '错过班车，需等候一回合'],
  saffron: ['获准随领队穿越风沙', '需留在驿站避沙一回合']
};

function chance(state, player, rng) {
  const card = randomInt(rng, 8);
  if(card>=6)return awardCardEvent(state,player,rng,cardContext);
  const news = (localNews[state.mapId] ?? localNews.mistport)[card];
  switch (card) {
    case 0:
      addCash(state,player,1200,'bonus',news);
      return record(state, `${news}，${player.name} 获得 1,200。`, 'bonus');
    case 1:
      record(state, `${news}，${player.name} 需支付维修费 650。`, 'tax');
      charge(state,player,650,news+'维修费');
      return;
    case 2:
      player.items.boost++;
      return record(state, `${news}，${player.name} 获得一面顺风帆。`, 'item');
    case 3:
      player.items.permit++;
      return record(state, `${news}，${player.name} 获得一张通行证。`, 'item');
    case 4:
      player.items.shield++;
      return record(state, `${news}，${player.name} 获得一张免租券。`, 'item');
    default:
      addCash(state,player,650,'bonus',news);
      return record(state, `${news}，${player.name} 获得 650。`, 'bonus');
  }
}

function land(state, player, rng) {
  const tile = mapOf(state).tiles[player.pos];
  state.phase = 'end';
  switch (tile.type) {
    case 'property': {
      const deed = state.properties[tile.id];
      if (!deed) {
        state.phase = 'buy';
      } else if (deed.owner !== player.id) {
        const owner = state.players.find(p => p.id === deed.owner);
        const rent = rentFor(state, tile.id);
        if (!rent) {
          record(state,`${tile.name} 本回合免收租金。`,'rent');
        } else if (player.shield) {
          player.shield = false;
          record(state, `${player.name} 兑付免租券，免除本次租金。`, 'item');
        } else {
          charge(state,player,rent,tile.name+'租金',owner);
        }
      }
      break;
    }
    case 'bank':
      state.phase='bank';record(state,player.name+' 抵达'+tile.name+'，本回合在柜台借款免手续费。','bank');break;
    case 'shop':
      state.phase = 'shop';
      break;
    case 'tax': {
      const tax = 550 + tile.district * 50;
      record(state, `${player.name} 需支付${tile.name} ${money(tax)}。`, 'tax');
      charge(state,player,tax,tile.name);
      break;
    }
    case 'bonus':
      addCash(state,player,950,'bonus',tile.name+'红利');
      record(state, `${tile.name} 向${player.name} 发放红利 950。`, 'bonus');
      break;
    case 'chance':
      chance(state, player, rng);
      break;
    case 'delay': {
      const [cleared, waiting] = delays[state.mapId] ?? delays.mistport;
      if (player.permit) {
        player.permit = false;
        record(state, `${player.name} 出示通行证，${cleared}。`, 'item');
      } else {
        player.delayed = true;
        record(state, `${player.name} ${waiting}，可用通行证放行。`, 'delay');
      }
      break;
    }
  }
}

function advanceTurn(state,rng) {
  state.stepsRemaining = 0;
  state.routeOptions = [];
  if (state.players.filter(p => !p.out).length <= 1) return finish(state);
  let next = (state.turn + 1) % state.players.length;
  while (state.players[next].out) next = (next + 1) % state.players.length;
  if (next <= state.turn) {
    closeRound(state,rng);
    if (state.round >= state.maxRounds) return finish(state);
    state.round++;
  }
  state.turn = next;
  state.phase = 'roll';
  state.dice = [];
  state.lastRoll=null;
  state.usedThisTurn = false;
  state.upgradedThisTurn = false;
  beginCardTurn(state,state.players[next],cardContext);
}

function travel(state, player, rng, choice) {
  const map = mapOf(state);
  const path = [player.pos];
  state.routeOptions = [];
  while (state.stepsRemaining > 0) {
    const originalExits=map.next[player.pos];
    const exits = cardExits(state,player,player.pos,originalExits);
    if(originalExits.length>1&&exits.length===1){
      const skipped=originalExits.filter(id=>id!==exits[0]);
      const names=skipped.map(id=>map.tiles[id].name).join('、');
      const blocked=skipped.every(id=>{
        const mark=state.cardBoard?.marks[id];
        return mark?.kind==='barrier'&&mark.until>state.round;
      });
      const cause=blocked?names+'出口被围栏封闭':'临时调度跳过'+names+'出口';
      record(state,`${player.name} 到达${map.tiles[player.pos].name}岔口，${cause}，改走${map.tiles[exits[0]].name}。`,'route');
    }
    if (exits.length > 1 && choice === undefined) {
      state.routeOptions = [...exits];
      break;
    }
    player.pos = choice ?? exits[0];
    choice = undefined;
    path.push(player.pos);
    state.stepsRemaining--;
    enterCardTile(state,player,cardContext);
    if(path.at(-1)!==player.pos)path.push(player.pos);
    if (player.pos === 0) {
      addCash(state,player,SALARY,'salary','经过起点');
      record(state, `${player.name} 经过${map.tiles[0].name}，领取路线收益 2,000。`, 'salary');
    }
  }
  if (path.length > 1) {
    state.lastMove = { id: (state.lastMove?.id ?? 0) + 1, playerId: player.id, path };
  }
  const tile = map.tiles[player.pos];
  if (state.stepsRemaining) {
    state.phase = 'route';
    record(state, `${player.name} 在${tile.name}选择路线，剩余 ${state.stepsRemaining} 步。`, 'route');
    return;
  }
  record(state, `${player.name} 抵达${tile.name}。`, 'move');
  land(state, player, rng);
  if (player.out) advanceTurn(state,rng);
}

function roll(state, player, rng) {
  requireRule(state.phase === 'roll', '当前不能掷骰');
  if (player.delayed) {
    player.delayed = false;
    if(player.effects)delete player.effects.nap;
    state.phase = 'end';
    record(state, `${player.name} 在${mapOf(state).tiles[player.pos].name}等候，将于下次回合恢复行进。`, 'delay');
    return;
  }
  const dice = [1 + randomInt(rng, 6), 1 + randomInt(rng, 6)];
  state.dice = dice;
  const exact=Boolean(player.effects?.exact);
  const distance = cardDistance(state,player,dice[0] + dice[1] + (player.boost ? 3 : 0));
  state.lastRoll={playerId:player.id,dice:[...dice],distance,exact};
  player.boost = false;
  state.stepsRemaining = distance;
  const movement=exact?'按卡牌指定步数前进':'前进';
  record(state, `${player.name} 掷出 ${dice.join(' + ')}，${movement} ${distance} 格。`, 'roll');
  travel(state, player, rng);
}

function applyToDraft(state, player, action, rng) {
  if(applyCardAction(state,player,action,cardContext))return;
  switch (action.type) {
    case 'roll': return roll(state, player, rng);
    case 'route': {
      requireRule(state.phase === 'route' && state.stepsRemaining > 0, '当前无需选择路线');
      const exits = cardExits(state,player,player.pos,mapOf(state).next[player.pos]);
      requireRule(Number.isInteger(action.to) && exits.includes(action.to) && state.routeOptions.includes(action.to), '请选择当前岔口的一条路线');
      return travel(state, player, rng, action.to);
    }
    case 'buy': {
      const tile = mapOf(state).tiles[player.pos];
      requireRule(state.phase === 'buy' && tile.type === 'property' && !state.properties[tile.id], '当前没有可购买的地产');
      requireRule(player.cash >= tile.price, '现金不足，无法购入地产');
      addCash(state,player,-tile.price,'buy','购入'+tile.name);
      state.properties[tile.id] = { owner: player.id, level: 1 };
      state.phase = 'end';
      record(state, `${player.name} 斥资 ${money(tile.price)} 购入${tile.name}。`, 'buy');
      return;
    }
    case 'upgrade': {
      requireRule((state.phase === 'roll' || state.phase === 'end') && !state.upgradedThisTurn, '每回合掷骰前或结束前可升级一处地产');
      requireRule(Number.isInteger(action.tile) && mapOf(state).tiles[action.tile]?.type === 'property', '请选择要升级的地产');
      const deed = state.properties[action.tile];
      requireRule(deed?.owner === player.id, '只能升级自己的地产');
      const cost = upgradeCost(state, action.tile);
      requireRule(cost > 0, '已达到最高等级');
      requireRule(player.cash >= cost, '现金不足，无法升级');
      addCash(state,player,-cost,'upgrade','升级'+mapOf(state).tiles[action.tile].name);
      deed.level++;
      state.upgradedThisTurn = true;
      record(state, `${player.name} 支出 ${money(cost)}，将${mapOf(state).tiles[action.tile].name} 升至 ${deed.level} 级。`, 'upgrade');
      return;
    }
    case 'bank':
    case 'stock':
    case 'liquidate':
      doFinance(state,player,action);
      if(player.out)advanceTurn(state,rng);
      return;
    case 'end':
      requireRule(['end', 'buy', 'shop','bank'].includes(state.phase), '请先完成本回合的移动');
      return advanceTurn(state,rng);
    default:
      throw new Error('未知的游戏操作');
  }
}

export function applyAction(state, playerId, action, rng = Math.random) {
  requireRule(state.phase !== 'finished', '对局已结束');
  requireRule(state.players[state.turn].id === playerId, '请等待自己的回合');
  requireRule(action && typeof action.type === 'string', '操作格式无效');
  // Only commit a successful operation, including results from an injected dice source.
  const draft = JSON.parse(JSON.stringify(state));
  draft.mapId ??= 'mistport';
  draft.stepsRemaining ??= 0;
  draft.routeOptions ??= [];
  draft.lastMove ??= null;
  draft.lastRoll ??= null;
  ensureEconomy(draft);
  initCards(draft);
  applyToDraft(draft, draft.players[draft.turn], action, rng);
  Object.assign(state, draft);
  return state;
}

// Compare reachable landing tiles for the actual remaining dice distance.
// A future junction is another decision, so choose its best continuation.
function chooseRoute(state, player) {
  const map = mapOf(state);
  const scores = new Map();
  function destination(id) {
    const tile = map.tiles[id];
    switch (tile.type) {
      case 'property': {
        const owner = state.properties[id]?.owner;
        if (owner) return owner === player.id || player.shield ? 0 : -rentFor(state, id);
        if (player.cash < tile.price + 1100) return 0;
        const group = portsByMap.get(map.id)[tile.district];
        const owned = group.filter(other => state.properties[other.id]?.owner === player.id).length;
        return tile.price * (.18 + .3 * owned / group.length);
      }
      case 'bonus': return 950;
      case 'tax': return -(550 + tile.district * 50);
      case 'delay': return player.permit ? 0 : -750;
      case 'bank': return player.debt ? 370 : 220;
      case 'shop': return 180;
      case 'chance': return 220;
      default: return 0;
    }
  }
  function score(id, steps) {
    const key = steps * map.tiles.length + id;
    if (!scores.has(key)) {
      const value = steps === 1 ? destination(id) : Math.max(...cardExits(state,player,id,map.next[id]).map(to => score(to, steps - 1)));
      scores.set(key, value + (id === 0 ? SALARY : 0));
    }
    return scores.get(key);
  }
  return state.routeOptions.reduce((best, to) => score(to, state.stepsRemaining) > score(best, state.stepsRemaining) ? to : best);
}

export function botAction(state) {
  const player = state.players[state.turn];
  if (state.phase === 'finished') throw new Error('对局已结束');
  if(state.market){const finance=financeBot(state,player);if(finance)return finance}
  if (state.phase === 'route') return { type: 'route', to: chooseRoute(state, player) };
  if (state.phase === 'buy') {
    const tile = mapOf(state).tiles[player.pos];
    return { type: player.cash >= tile.price + 1100 ? 'buy' : 'end' };
  }
  if(state.phase==='roll'||state.phase==='shop'){
    const card=cardBotAction(state,player);
    if(card)return card;
    if(state.phase==='shop')return {type:'end'};
  }
  if (state.phase === 'end' && !state.upgradedThisTurn) {
    const affordable = Object.entries(state.properties).filter(([id, deed]) =>
      deed.owner === player.id && deed.level < MAX_LEVEL && player.cash - upgradeCost(state, id) >= 5500);
    affordable.sort(([a], [b]) => rentFor(state, b) - rentFor(state, a));
    if (affordable.length) return { type: 'upgrade', tile: Number(affordable[0][0]) };
  }
  return { type: state.phase === 'roll' ? 'roll' : 'end' };
}
