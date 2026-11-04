// motion.js: stage, steps, controls and a deterministic seek hook for Abstracts explainer artifacts.
// Copy this file into each artifact folder (no shared folders between artifacts). Needs three.js via the import map.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));           // 0..1 progress of t through [a, b]
export const ease = {
  out: t => 1 - (1 - t) ** 3,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  bounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  spring: t => 1 - Math.exp(-6 * t) * Math.cos(9 * t),
};

const ICON = {
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  again: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/**
 * createMotion({ root, title, mode, loop, steps, initial, setup, update, fonts, foot })
 *   mode 'timeline': steps autoplay in order (motion graphic). mode 'interactive': the viewer drives;
 *   each step's animation plays once and holds; Next/Back move; "Watch it" plays the guided tour (step.tour).
 *   steps: [{ dur, kicker, title, text, controls(el, api) -> sync?, ready(api) -> bool, tour(t, api), update(t, api) }]
 */
export function createMotion(o) {
  const root = o.root;
  const steps = o.steps;
  const interactive = o.mode === 'interactive';
  const loop = o.loop ?? !interactive;
  const params = new URLSearchParams(location.search);
  const bare = params.has('bare');                     // ?bare: scene only, for preview images
  const capture = params.has('capture') || bare;
  const reduced = !capture && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starts = []; let total = 0;
  for (const s of steps) { starts.push(total); total += s.dur; }

  /* ---------- DOM ---------- */
  root.classList.add('stage');
  if (capture) root.classList.add('capture');
  if (bare) root.classList.add('bare');
  const view = el('div', 'view'); const canvas = el('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.tabIndex = -1; view.append(canvas);
  const panel = el('section', 'panel'); panel.setAttribute('aria-label', 'Step');
  const bar = el('nav', 'bar'); bar.setAttribute('aria-label', 'Steps');
  const b = {
    prev: el('button', 'btn btn--icon', svg(ICON.prev)),
    next: el('button', 'btn btn--icon', svg(ICON.next)),
    play: el('button', interactive ? 'btn' : 'btn btn--icon'),
    again: el('button', 'btn btn--again', `${svg(ICON.again)}<span class="lbl">${interactive ? 'Start over' : 'Replay'}</span>`),
  };
  b.prev.setAttribute('aria-label', 'Previous step'); b.next.setAttribute('aria-label', 'Next step'); b.again.setAttribute('aria-label', interactive ? 'Start over' : 'Replay');
  for (const k in b) b[k].type = 'button';
  b.again.hidden = true;
  const dots = el('div', 'dots');
  steps.forEach((s, i) => { const d = el('button'); d.type = 'button'; d.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`); d.onclick = () => { api.pause(); go(i); }; dots.append(d); });
  bar.append(b.prev, dots, b.next, b.play, b.again);
  const live = el('p', 'sr'); live.setAttribute('aria-live', 'polite');
  const list = el('ol', 'sr'); list.innerHTML = steps.map(s => `<li>${s.title}. ${s.text || ''}</li>`).join('');
  if (o.title) list.setAttribute('aria-label', o.title);
  root.append(view, panel, bar, live, list);

  /* ---------- state ---------- */
  let index = 0, t = 0, playing = false, clock = 0, hold = 0, version = 0, inView = capture, started = false;
  let sync = null, note = null;
  const changed = {}, prev = {}, touched = new Set();
  const api = {
    THREE, root, reduced, capture, interactive, steps, total,
    state: o.initial ? o.initial() : {},
    get index() { return index; }, get t() { return t; }, get clock() { return clock; }, get playing() { return playing; }, get version() { return version; },
    /** Set a state value. `ago` back-dates the change (seconds) so tours stay deterministic. */
    set(k, v, ago = 0) { if (api.state[k] === v) return; prev[k] = api.state[k]; api.state[k] = v; changed[k] = clock - ago; version++; },
    since: k => (k in changed ? clock - changed[k] : Infinity),
    prev: k => prev[k],
    touched: k => touched.has(k),
    /** Viewer input: marks the key as the viewer's own (tours won't overwrite it) and stops the tour. */
    input(k, v) { touched.add(k); if (playing) api.pause(); api.set(k, v); refreshUI(); wake(); },
    /** Tour helpers: type text at `cps` chars/s from local time t0; pick a value at local time `at`. */
    type(k, text, tt, t0, cps = 9) { if (touched.has(k)) return; const n = tt < t0 ? 0 : Math.min(text.length, Math.floor((tt - t0) * cps) + 1); api.set(k, text.slice(0, n), n ? tt - (t0 + (n - 1) / cps) : 0); },
    pick(k, v, tt, at) { if (!touched.has(k) && tt >= at) api.set(k, v, tt - at); },
    note(text = '', kind = '') { if (!note) return; note.textContent = text; note.className = `note${kind ? ` note--${kind}` : ''}`; },
    view: v => frameView(v),
    go: i => go(i), next: () => go(index + 1), back: () => go(index - 1),
    play() { if (index === steps.length - 1 && t >= steps[index].dur) go(0, true); if (t >= steps[index].dur) t = 0; playing = true; hold = 0; refreshUI(); wake(); },
    pause() { playing = false; refreshUI(); },
    restart() { reset(); go(0, true); if (!reduced && !interactive) api.play(); },
    refresh: () => refreshUI(),
  };

  function reset() { api.state = o.initial ? o.initial() : {}; for (const k in changed) delete changed[k]; for (const k in prev) delete prev[k]; touched.clear(); version++; }

  /* ---------- panel ---------- */
  function renderPanel() {
    const s = steps[index];
    const wrap = el('div', 'fade'); wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const k = el('p', 'kicker'); k.textContent = s.kicker ?? `Step ${index + 1} of ${steps.length}`;
    const h = el('h2', 'title'); h.textContent = s.title;
    wrap.append(k, h);
    if (s.text) { const p = el('p', 'text'); p.textContent = s.text; wrap.append(p); }
    const c = el('div', 'controls');
    note = el('p', 'note'); note.setAttribute('aria-live', 'polite');
    wrap.append(c, note);
    panel.replaceChildren(wrap);
    if (o.foot) { const f = el('p', 'foot'); f.textContent = o.foot; panel.append(f); }
    sync = s.controls ? s.controls(c, api) || null : null;
    if (sync) sync(true);
    live.textContent = `Step ${index + 1} of ${steps.length}. ${s.title}. ${s.text || ''}`;
    layout();
  }

  let lastVersion = -1;
  function refreshUI() {
    const s = steps[index], last = index === steps.length - 1, done = last && t >= s.dur;
    b.prev.disabled = index === 0;
    b.next.disabled = last || (!playing && interactive && s.ready && !s.ready(api));
    [...dots.children].forEach((d, i) => { d.setAttribute('aria-current', i === index ? 'true' : 'false'); d.dataset.done = i < index ? 'true' : 'false'; });
    // Rewrite the label only when it changes: replacing it every frame swallowed clicks (two clicks to start).
    if (b.play.dataset.state !== String(playing)) {
      b.play.dataset.state = String(playing);
      b.play.innerHTML = interactive ? `${svg(playing ? ICON.pause : ICON.play)}<span class="lbl">${playing ? 'Pause' : 'Watch it'}</span>` : svg(playing ? ICON.pause : ICON.play);
      b.play.setAttribute('aria-label', playing ? 'Pause' : interactive ? 'Watch the guided tour' : 'Play');
    }
    b.again.hidden = !(interactive ? last : done && !playing);
    b.play.hidden = !interactive && done && !playing;
    if (sync && lastVersion !== version) { lastVersion = version; sync(false); }
  }

  function go(i, silent) {
    i = clamp(i, 0, steps.length - 1);
    index = i;
    t = reduced && !playing ? steps[i].dur : 0;
    hold = 0;
    if (started) { renderPanel(); refreshUI(); wake(); }
  }

  b.prev.onclick = () => { api.pause(); go(index - 1); };
  b.next.onclick = () => { api.pause(); go(index + 1); };
  b.play.onclick = () => (playing ? api.pause() : api.play());
  b.again.onclick = () => api.restart();

  addEventListener('keydown', e => {
    const tag = e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Enter' && typing) { const s = steps[index]; if (!s.ready || s.ready(api)) { e.preventDefault(); api.pause(); go(index + 1); } return; }
    if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('[role="radiogroup"]') && e.key.startsWith('Arrow')) return;
    if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); playing ? api.pause() : api.play(); }
    else if (e.key === 'ArrowRight' && !b.next.disabled) { e.preventDefault(); api.pause(); go(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); api.pause(); go(index - 1); }
  });

  /* ---------- three ---------- */
  let renderer, scene, camera;
  const frameRect = { x: 0, y: 0, w: 1, h: 1 };
  let W = 1, H = 1;
  function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
    renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    const key = new THREE.DirectionalLight(0xfff3e2, 2.0);
    key.position.set(-1.6, 5, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    scene.add(key, new THREE.HemisphereLight(0xfff8ee, 0xb9ad98, 0.65));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.14 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    Object.assign(api, { renderer, scene, camera, key, ground });
  }

  // Fits a radius-wide, (radius * tall)-high subject into the free area (not under the panel or bar).
  function frameView({ target = [0, 0, 0], radius = 1, tall = 0.75, elev = 35, azim = 0 }) {
    if (!camera) return;
    const el_ = THREE.MathUtils.degToRad(elev), az = THREE.MathUtils.degToRad(azim);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = (r, px) => r / Math.sin(Math.atan(px / H * tanV));
    const d = Math.max(fit(radius, frameRect.w), fit(radius * tall, frameRect.h));
    camera.position.set(target[0] + d * Math.sin(az) * Math.cos(el_), target[1] + d * Math.sin(el_), target[2] + d * Math.cos(az) * Math.cos(el_));
    camera.lookAt(target[0], target[1], target[2]);
    const cx = frameRect.x + frameRect.w / 2, cy = frameRect.y + frameRect.h / 2;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
  }

  function layout() {
    const narrow = !capture && root.clientWidth < (o.narrow ?? 700);
    root.classList.toggle('narrow', narrow);
    if (!renderer) return postHeight();
    const vr = view.getBoundingClientRect();
    W = Math.max(1, Math.round(vr.width)); H = Math.max(1, Math.round(vr.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    if (narrow || bare) Object.assign(frameRect, { x: 8, y: 8, w: W - 16, h: H - 16 - (narrow ? 10 : bare ? 0 : 64) });
    else { const pr = panel.getBoundingClientRect(); const x = pr.right - vr.left + 8; Object.assign(frameRect, { x, y: 12, w: W - x - 12, h: H - 12 - 64 }); }
    postHeight();
    draw();
  }
  function postHeight() { try { parent.postMessage({ abstractsHeight: Math.ceil(document.body.getBoundingClientRect().height) }, '*'); } catch { /* not framed */ } }

  /* ---------- loop ---------- */
  function step(dt) {
    const s = steps[index];
    clock += dt;
    if (playing) {
      t += dt;
      if (t >= s.dur) {
        if (index < steps.length - 1) { const over = t - s.dur; index++; t = over; renderPanel(); }
        else {
          t = s.dur; hold += dt;
          if (!loop) playing = false;
          else if (hold > (o.endHold ?? 6)) { reset(); index = 0; t = 0; hold = 0; renderPanel(); }
        }
      }
    } else if (interactive || !started) t = Math.min(s.dur, t + dt);
    if (playing && steps[index].tour) steps[index].tour(t, api);
  }
  let built = false;
  function draw() {
    if (!built) return;
    const s = steps[index];
    o.update?.(index, t, api);
    s.update?.(t, api);
    refreshUI();
    renderer.render(scene, camera);
  }
  let running = false, last = 0;
  function frame(now) {
    running = false;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000 || 0)); last = now;
    step(dt);
    draw();
    const animating = playing || t < steps[index].dur || !reduced;
    if (inView && !document.hidden && animating && !seeking) wake();
  }
  function wake() { if (running || !started || seeking) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  /* ---------- seek (frame capture) ---------- */
  let seeking = false;
  /** Deterministic: resets state, replays every tour up to T, renders one frame. Interactive input is ignored. */
  function seek(T) {
    seeking = true; playing = false;
    T = clamp(T, 0, total);
    let i = 0; while (i < steps.length - 1 && T >= starts[i + 1]) i++;
    reset(); clock = 0;
    for (let j = 0; j < i; j++) { clock = starts[j] + steps[j].dur; steps[j].tour?.(steps[j].dur, api); }
    clock = T;
    if (i !== index || !panel.firstChild) { index = i; renderPanel(); }
    index = i; t = T - starts[i];
    steps[i].tour?.(t, api);
    draw();
  }

  /* ---------- start ---------- */
  let resolveReady; const ready = new Promise(r => (resolveReady = r));
  async function start() {
    if (started) return;
    started = true;
    initThree();
    try { await Promise.race([Promise.all((o.fonts || []).map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch { /* system fonts */ }
    await o.setup?.(api);
    built = true;
    go(0, true);
    renderPanel();
    layout();
    if (!reduced && !interactive && !capture) api.play();
    wake();
    resolveReady();
  }
  new ResizeObserver(() => layout()).observe(root);
  addEventListener('load', postHeight);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  if (capture) start();
  else new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { start(); wake(); } else if (!interactive) api.pause(); }).observe(root);

  // Panel placeholder before three starts, so captions exist even if WebGL never runs.
  renderPanel = (orig => () => { if (!started) { const s = steps[index]; panel.innerHTML = `<p class="kicker">Step 1 of ${steps.length}</p><h2 class="title"></h2>`; panel.querySelector('.title').textContent = s.title; return; } orig(); })(renderPanel);
  renderPanel();
  layout();

  window.__duration = total;
  window.__ready = ready;
  window.__seek = async T => { await ready; seek(T); return T; };
  return api;
}
