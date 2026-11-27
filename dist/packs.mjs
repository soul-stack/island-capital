import { MAPS } from './shared/maps.mjs';
import { rentFor } from './shared/engine.mjs';
import { previewRouteStops } from './cards.mjs';
import { icon } from './art.mjs';

const sequence = ['skyrail', 'saffron', 'mistport'];
export const orderedPacks = () => sequence.map((id) => MAPS.find((map) => map.id === id));
export function packCards(currentId, inRoom, hasSave) {
  return (
    '<div class="pack-grid">' +
    orderedPacks()
      .map((map) => {
        const forks = map.next.filter((options) => options.length > 1).length;
        const current = map.id === currentId;
        return (
          '<article class="pack-card" style="--pack:' +
          map.color +
          '"><div class="pack-photo"><canvas data-map-preview="' +
          map.id +
          '" role="img" aria-label="' +
          map.name +
          '的棋盘路线预览"></canvas>' +
          (current ? '<span class="pack-current">当前地图</span>' : '') +
          '</div>' +
          '<div class="pack-info"><h3>' +
          map.name +
          '</h3><div class="pack-english">' +
          map.english +
          '</div><p>' +
          map.description +
          '</p><div class="pack-stats"><span>' +
          map.tiles.length +
          ' 格</span><span>' +
          map.districts.length +
          ' 街区</span><span>' +
          (forks ? forks + ' 处岔路' : '单环线') +
          '</span></div>' +
          (inRoom
            ? ''
            : '<div class="pack-actions"><button class="primary" data-pack-play="' +
              map.id +
              '">' +
              (current ? '返回棋盘' : hasSave(map.id) ? '继续练习' : '开始练习') +
              '</button><button class="secondary" data-pack-room="' +
              map.id +
              '">创建房间</button></div>') +
          '</div></article>'
        );
      })
      .join('') +
    '</div>' +
    (inRoom ? '<p class="help">房主在创建新房间时选定地图。当前房间使用的地图已随对局保存。</p>' : '')
  );
}

const typeLabels = {
  bank: '银行 · 柜台借款免手续费',
  start: '起点收益',
  shop: '道具商铺',
  chance: '随机事件',
  bonus: '集会分红',
  tax: '港务收费',
  delay: '停航地块',
};
function destinationText(map, state, id) {
  const tile = map.tiles[id],
    deed = state.properties[id];
  if (tile.type !== 'property') return typeLabels[tile.type] || tile.name;
  if (!deed) return '空地 · ' + tile.price.toLocaleString('en-US');
  if (deed.owner === state.players[state.turn].id) return '你的地产';
  return '应付租金 ' + rentFor(state, id).toLocaleString('en-US');
}
export function routeChoices(map, state, busy) {
  const remaining = state.stepsRemaining;
  return (
    '<div class="route-choices"><strong>' +
    icon('network') +
    '选择岔路 <small>余 ' +
    remaining +
    ' 步</small></strong>' +
    state.routeOptions
      .map((to, index) => {
        const stops = previewRouteStops(state, state.players[state.turn], to, remaining);
        const outcome =
          stops.length === 1
            ? '预计停在' + map.tiles[stops[0]].name + ' · ' + destinationText(map, state, stops[0])
            : '途中仍可选路 · 可能停在' + stops.map((id) => map.tiles[id].name).join('、');
        const name = map.routeLabels?.[state.players[state.turn].pos]?.[to] || '经' + map.tiles[to].name;
        return (
          '<button class="path-choice" data-route="' +
          to +
          '" ' +
          (busy ? 'disabled' : '') +
          '><span class="path-letter">' +
          String.fromCharCode(65 + index) +
          '</span><span><strong>' +
          name +
          '</strong><small>' +
          outcome +
          '</small></span></button>'
        );
      })
      .join('') +
    '</div>'
  );
}
