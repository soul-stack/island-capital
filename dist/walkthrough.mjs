import { advanceScenario, scenarios, startScenario } from './walkthrough-cases.mjs';
import { getMap } from './shared/maps.mjs';
import { drawAtlas } from './atlas2d.mjs';
import { createAtlasNavigation } from './atlas-navigation.mjs';

const $ = (id) => document.getElementById(id);
let id = new URLSearchParams(location.search).get('case');
if (!Object.hasOwn(scenarios, id)) id = 'bank';
let state,
  index,
  viewer,
  use3d = false,
  events,
  highlight = [],
  viewEpoch = 0;
for (const [key, s] of Object.entries(scenarios)) $('scenario').add(new Option(s.name, key));
const atlas = createAtlasNavigation($('flat'), $('atlas-tools'), {
  redraw: draw,
  locate: () => ({ tile: state.players[state.turn].pos, context: state.phase }),
});
function draw() {
  const map = getMap(state.mapId),
    opts = { selected: highlight.at(-1) ?? null, affectedTiles: highlight, me: 'captain' };
  if (use3d && viewer) viewer.update(state, opts);
  else {
    drawAtlas($('flat'), state, { ...opts, ...atlas.options(map.id) });
    atlas.sync();
  }
}
async function toggle3D(on) {
  const epoch = ++viewEpoch;
  if (on) {
    try {
      const { createBoard3D } = await import('./board3d.mjs');
      if (epoch !== viewEpoch) return;
      $('three').hidden = false;
      viewer ??= createBoard3D($('three'), {
        mapId: state.mapId,
        onTile(tile) {
          viewer.focusTile(tile, 'detail');
        },
      });
    } catch {
      on = false;
    }
  }
  use3d = on;
  atlas.show(!on);
  $('flat').hidden = on;
  $('three').hidden = !on;
  $('view').textContent = on ? '查看 2D 路线' : '查看 3D 沙盘';
  draw();
  viewer?.resize();
}
function render() {
  const s = scenarios[id],
    map = getMap(state.mapId);
  $('map').textContent = map.name;
  $('heading').textContent = s.name;
  $('counter').textContent = index + ' / ' + s.steps.length;
  $('next').textContent = s.steps[index]?.label || '演示完成';
  $('next').disabled = index >= s.steps.length;
  $('positions').replaceChildren(
    ...state.players.map((p) => {
      const line = document.createElement('p');
      line.textContent =
        p.name +
        ' · ' +
        map.tiles[p.pos].name +
        ' · 现金 ' +
        p.cash.toLocaleString('zh-CN') +
        ' · 存款 ' +
        p.deposit.toLocaleString('zh-CN');
      return line;
    }),
  );
  $('events').replaceChildren(
    ...events
      .slice()
      .reverse()
      .map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }),
  );
  draw();
}
function start() {
  const oldView = use3d;
  viewer?.dispose();
  viewer = null;
  viewEpoch++;
  use3d = false;
  state = startScenario(id);
  index = 0;
  events = [];
  highlight = [];
  $('scenario').value = id;
  $('intro').textContent = scenarios[id].intro;
  history.replaceState({}, '', location.pathname + '?case=' + id);
  render();
  toggle3D(oldView);
}
$('next').onclick = () => {
  if (index >= scenarios[id].steps.length) return;
  const seq = state.eventSeq,
    step = advanceScenario(id, index, state);
  highlight = step.highlight || [];
  index++;
  const entries = state.log.filter((x) => x.id > seq);
  events.push(step.label + ' · ' + (entries.map((x) => x.text).join(' ') || '操作已结算。'));
  render();
  if (highlight.length) viewer?.focusTile(highlight.at(-1), id === 'fork' ? 'route' : 'detail');
};
$('scenario').onchange = (e) => {
  id = e.target.value;
  start();
};
$('reset').onclick = start;
$('view').onclick = () => toggle3D(!use3d);
new ResizeObserver(() => {
  if (state) draw();
}).observe($('flat'));
start();
toggle3D(true);
