const ZOOM_STEP = 1.25;
const WHEEL_RATE = 0.002;

function point(event) {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  return { x: event.clientX, y: event.clientY };
}

function pairGeometry(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    // A near-coincident pair can move its centre without producing a scale spike.
    span: Math.max(8, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}

/**
 * Report incremental transforms in client CSS pixels. The drawing surface owns
 * the viewport, including clamping and hit testing. A null hover clears the tip.
 */
export function attachAtlasControls(canvas, { onTransform, onPick, onHover, onReset, onFocus } = {}) {
  const pointers = new Map();
  const listeners = [];
  const doc = canvas.ownerDocument;
  let disposed = false;
  const addedTabIndex = !canvas.hasAttribute('tabindex');
  if (addedTabIndex) canvas.setAttribute('tabindex', '0');

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function transform(fromX, fromY, toX, toY, scale = 1) {
    if (fromX !== toX || fromY !== toY || scale !== 1) {
      onTransform?.(fromX, fromY, toX, toY, scale);
    }
  }

  function release(id) {
    try {
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    } catch {
      /* The browser can cancel a capture when the canvas is detached. */
    }
  }

  function down(event) {
    const xy = point(event);
    if (!xy || pointers.has(event.pointerId)) return;
    const type = event.pointerType || 'mouse';
    if (type !== 'touch' && event.button !== 0) return;
    if (pointers.size && (type !== 'touch' || pointers.values().next().value.type !== 'touch')) return;
    const finger = { ...xy, startX: xy.x, startY: xy.y, type, dragging: false };
    pointers.set(event.pointerId, finger);
    if (pointers.size > 1) {
      // A finger left behind after a pinch can pan, but can no longer tap.
      for (const contact of pointers.values()) contact.dragging = true;
    }
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      /* Document listeners cover this case. */
    }
    onHover?.(null, null);
  }

  function updateTracked(event) {
    const finger = pointers.get(event.pointerId);
    const xy = point(event);
    if (!finger || !xy) return;
    if (pointers.size > 1) {
      const [first, second] = pointers.values();
      const before = pairGeometry(first, second);
      Object.assign(finger, xy);
      if (finger !== first && finger !== second) return;
      const after = pairGeometry(first, second);
      transform(before.x, before.y, after.x, after.y, after.span / before.span);
      return;
    }
    const previousX = finger.x,
      previousY = finger.y;
    Object.assign(finger, xy);
    if (finger.dragging) {
      transform(previousX, previousY, xy.x, xy.y);
      return;
    }
    const threshold = finger.type === 'touch' ? 7 : 5;
    if (Math.hypot(xy.x - finger.startX, xy.y - finger.startY) < threshold) return;
    finger.dragging = true;
    transform(finger.startX, finger.startY, xy.x, xy.y);
  }

  function move(event) {
    if (pointers.has(event.pointerId)) {
      updateTracked(event);
    } else if (!pointers.size && event.pointerType !== 'touch') {
      const xy = point(event);
      if (xy) onHover?.(xy.x, xy.y);
    }
  }

  function end(event) {
    const id = event.pointerId,
      finger = pointers.get(id);
    if (!finger) return;
    const released = event.type === 'pointerup';
    if (released) updateTracked(event);
    pointers.delete(id);
    release(id);
    if (!released || finger.dragging || pointers.size) return;
    const xy = point(event),
      r = canvas.getBoundingClientRect();
    if (xy && xy.x >= r.left && xy.x < r.left + r.width && xy.y >= r.top && xy.y < r.top + r.height) {
      onPick?.(xy.x, xy.y);
    }
  }

  function wheel(event) {
    const xy = point(event);
    if (!xy || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1;
    event.preventDefault();
    const exponent = Math.max(-6, Math.min(6, -event.deltaY * unit * WHEEL_RATE));
    transform(xy.x, xy.y, xy.x, xy.y, Math.exp(exponent));
  }

  function zoom(factor) {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    const r = canvas.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return;
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    transform(x, y, x, y, factor);
  }

  function keydown(event) {
    if (event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return;
    const key = event.key;
    const direction = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    if (Array.isArray(direction)) {
      const r = canvas.getBoundingClientRect();
      const x = r.left + r.width / 2,
        y = r.top + r.height / 2;
      const step = Math.max(24, Math.min(96, Math.min(r.width, r.height) * 0.15));
      event.preventDefault();
      transform(x, y, x + direction[0] * step, y + direction[1] * step);
    } else if (['+', '=', 'Add', '-', '_', 'Subtract'].includes(key)) {
      event.preventDefault();
      zoom(['+', '=', 'Add'].includes(key) ? ZOOM_STEP : 1 / ZOOM_STEP);
    } else if (key === '0' || key === 'Home') {
      event.preventDefault();
      onReset?.();
    } else if (key === 'f' || key === 'F') {
      event.preventDefault();
      onFocus?.();
    }
  }

  function cancel() {
    const ids = [...pointers.keys()];
    pointers.clear();
    for (const id of ids) release(id);
    onHover?.(null, null);
  }

  function outside(handler) {
    return (event) => {
      if (pointers.has(event.pointerId) && !event.composedPath().includes(canvas)) handler(event);
    };
  }

  listen(canvas, 'pointerdown', down);
  listen(canvas, 'pointermove', move);
  listen(canvas, 'pointerup', end);
  listen(canvas, 'pointercancel', end);
  listen(canvas, 'lostpointercapture', end);
  listen(canvas, 'pointerleave', () => onHover?.(null, null));
  listen(canvas, 'wheel', wheel, { passive: false });
  listen(canvas, 'keydown', keydown);
  listen(doc, 'pointermove', outside(updateTracked));
  listen(doc, 'pointerup', outside(end));
  listen(doc, 'pointercancel', outside(end));
  listen(doc?.defaultView, 'blur', cancel);

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const remove of listeners) remove();
    cancel();
    if (addedTabIndex && canvas.getAttribute('tabindex') === '0') canvas.removeAttribute('tabindex');
  }
  return { zoom, cancel, dispose };
}
