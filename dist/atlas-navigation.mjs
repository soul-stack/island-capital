import { getAtlasView, hitAtlas, transformAtlasView } from './atlas2d.mjs';
import { attachAtlasControls } from './atlas-controls.mjs';
import { icon } from './art.mjs';

// The viewport belongs to this canvas. Room snapshots and turn changes only redraw it.
export function createAtlasNavigation(canvas, toolbar, { redraw, locate, select }) {
  let mapId,
    viewport = null,
    focus = null,
    overview = false;
  toolbar.classList.add('camera-bar', 'atlas-bar');
  toolbar.innerHTML =
    '<span class="camera-help">' +
    icon('map') +
    '<span>拖动平移 · <span class="mouse-instruction">滚轮缩放</span><span class="touch-instruction">双指缩放</span></span></span>' +
    '<div class="camera-controls" role="group" aria-label="二维地图视角">' +
    '<button id="atlas-minus" aria-label="缩小二维地图" title="缩小（−）">' +
    icon('minus') +
    '</button>' +
    '<output id="atlas-scale" aria-label="二维地图缩放比例" aria-live="off">100%</output>' +
    '<button id="atlas-plus" aria-label="放大二维地图" title="放大（+）">' +
    icon('plus') +
    '</button><span></span>' +
    '<button id="atlas-locate" title="定位当前棋子（F）">' +
    icon('pin') +
    '定位</button>' +
    '<button id="atlas-home" title="恢复二维全图（0）">' +
    icon('focus') +
    '全图</button></div>';
  const minus = toolbar.querySelector('#atlas-minus');
  const plus = toolbar.querySelector('#atlas-plus');
  const scale = toolbar.querySelector('#atlas-scale');

  function reset() {
    viewport = null;
    focus = null;
    overview = true;
    redraw();
  }
  function focusOn(tile, context) {
    viewport = null;
    focus = { tile, context };
    overview = false;
  }
  function locatePlayer() {
    const target = locate();
    if (!target) return;
    focusOn(target.tile, target.context);
    redraw();
  }
  const controls = attachAtlasControls(canvas, {
    onTransform(fromX, fromY, toX, toY, factor) {
      const previous = getAtlasView(canvas);
      const next = transformAtlasView(canvas, fromX, fromY, toX, toY, factor);
      if (
        !next ||
        (previous &&
          next.x === previous.x &&
          next.y === previous.y &&
          next.zoom === previous.zoom &&
          next.screenWidth === previous.screenWidth &&
          next.screenHeight === previous.screenHeight)
      )
        return;
      viewport = next;
      focus = null;
      overview = false;
      redraw();
    },
    onPick(x, y) {
      if (!select) return;
      const tile = hitAtlas(canvas, x, y);
      if (tile !== null) select(tile);
    },
    onHover(x, y) {
      canvas.classList.toggle(
        'hover-tile',
        Boolean(select) && x != null && y != null && hitAtlas(canvas, x, y) !== null,
      );
    },
    onReset: reset,
    onFocus: locatePlayer,
  });
  minus.onclick = () => controls.zoom(1 / 1.35);
  plus.onclick = () => controls.zoom(1.35);
  toolbar.querySelector('#atlas-locate').onclick = locatePlayer;
  toolbar.querySelector('#atlas-home').onclick = reset;

  return {
    options(id, selectedTile) {
      if (mapId !== id) {
        controls.cancel();
        mapId = id;
        viewport = null;
        focus = null;
        overview = false;
      }
      return {
        viewport,
        overview,
        focusTile: selectedTile ?? focus?.tile ?? null,
        focusContext: selectedTile != null ? 'detail' : focus?.context,
      };
    },
    sync() {
      const view = getAtlasView(canvas);
      if (!view) return;
      const label = Math.round(view.zoom * 100) + '%';
      if (scale.textContent !== label) scale.textContent = label;
      minus.disabled = view.zoom <= view.minZoom + 0.0001;
      plus.disabled = view.zoom >= view.maxZoom - 0.0001;
    },
    show(visible) {
      toolbar.hidden = !visible;
      if (!visible) controls.cancel();
    },
    focusOn,
    clearFocus() {
      focus = null;
    },
  };
}
