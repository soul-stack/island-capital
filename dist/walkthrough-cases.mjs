import { applyAction, createGame } from './shared/engine.mjs';

export const scenarios = {
  bank: {
    name: '控骰到银行',
    mapId: 'skyrail',
    start: 23,
    intro: '从天车坊旅行补给启程。银行在前方三步，先存一笔备用金，再规划路线。',
    steps: [
      { label: '存入 1,600', action: { type: 'bank', operation: 'deposit', amount: 1600 } },
      { label: '罗盘指定三步', action: { type: 'use', item: 'compass', target: 3 }, highlight: [26] },
      { label: '掷骰抵达银行', action: { type: 'roll' }, highlight: [26] },
      {
        label: '柜台取出 1,000',
        action: { type: 'bank', operation: 'withdraw', amount: 1000 },
        highlight: [26],
      },
      { label: '结束银行回合', action: { type: 'end' } },
    ],
  },
  fork: {
    name: '岔路设障与改道',
    mapId: 'skyrail',
    start: 0,
    intro: '两人从山城总站出发。青石埠岔口可以前往清波码头，也可以转入内街。',
    steps: [
      {
        label: '封闭清波码头入口',
        action: { type: 'use', item: 'barrier', target: 3 },
        highlight: [3, 58],
      },
      { label: '房主走到岔口', action: { type: 'roll' }, highlight: [2, 3, 58] },
      { label: '交给下一位玩家', action: { type: 'end' }, highlight: [2, 3, 58] },
      { label: '对手掷出四步', action: { type: 'roll' }, rng: 0.2, highlight: [3, 58, 59] },
      { label: '结束改道回合', action: { type: 'end' } },
    ],
  },
  property: {
    name: '从门前停靠到收租',
    mapId: 'mistport',
    start: 0,
    intro: '两人从启航码头出发。棋子经过灯芯作坊，停在晨雾渔市门前。',
    steps: [
      { label: '沿路走两步', action: { type: 'roll' }, highlight: [1, 2] },
      { label: '购入晨雾渔市', action: { type: 'buy' }, highlight: [2] },
      { label: '升级到二级', action: { type: 'upgrade', tile: 2 }, highlight: [2] },
      { label: '交给下一位玩家', action: { type: 'end' }, highlight: [2] },
      { label: '对手走到门前付租', action: { type: 'roll' }, highlight: [2] },
      { label: '结束收租回合', action: { type: 'end' }, highlight: [2] },
    ],
  },
};
export function startScenario(id) {
  const scenario = scenarios[id];
  const state = createGame(
    [
      { id: 'captain', name: '海岬船长' },
      { id: 'trader', name: '青帆商人' },
    ],
    { mapId: scenario.mapId, maxRounds: 8 },
  );
  state.players[0].pos = scenario.start;
  return state;
}
export function advanceScenario(id, index, state) {
  const step = scenarios[id].steps[index];
  applyAction(state, state.players[state.turn].id, step.action, () => step.rng ?? 0);
  return step;
}
