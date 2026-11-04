// A close-up of a pinned artifact as it appears on abstracts.co: the live artifact in its frame, then the
// Like / Dislike / Save / Share / Full screen row. Three live examples: a 3D scene you orbit, a map you pan
// with pins you tap, a document you scroll.
import * as THREE from 'three';

const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = { up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>', save: '<path d="M6 3h12v18l-6-4-6 4z"/>', share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>', full: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>' };
export const TITLES = { scene: 'Low-poly island', map: 'Trail map', doc: 'Field notes' };

const MAP_PINS = [[180, 300, 'Trailhead'], [430, 170, 'Waterfall'], [650, 330, 'Summit']];
const MAP = `<svg class="map" viewBox="0 0 900 560" aria-label="Trail map: drag to move, tap a pin">
  <rect width="900" height="560" fill="#cfe6ef"/>
  <path d="M60 420 C 80 200 300 80 520 110 C 760 140 860 300 800 450 C 740 560 200 560 60 420 Z" fill="#a9d6ac"/>
  <path d="M300 300 C 340 220 470 200 560 250 C 620 290 560 380 460 380 C 360 380 280 360 300 300 Z" fill="#86c08d"/>
  <path d="M520 250 C 560 210 640 220 680 270 C 700 310 650 350 600 340 Z" fill="#6aae75"/>
  <path d="M180 300 C 260 230 340 160 430 170 C 520 180 560 300 650 330" fill="none" stroke="#ef6b4e" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/>
  <path d="M420 120 q 6 30 -4 60" stroke="#6fb0e6" stroke-width="8" fill="none" stroke-linecap="round"/>
  ${MAP_PINS.map(([x, y, n], i) => `<g class="map__pin" tabindex="0" role="button" aria-label="${n}" data-i="${i}" transform="translate(${x} ${y})"><circle r="26" fill="rgba(239,107,78,.18)"/><path d="M0 0 C -14 -18 -14 -34 0 -38 C 14 -34 14 -18 0 0 Z" fill="#ef6b4e"/><circle cy="-26" r="6" fill="#fff"/><g class="map__tip" opacity="0"><rect x="-70" y="-92" width="140" height="40" rx="12" fill="#1f2436"/><text y="-66" text-anchor="middle" fill="#f7f1e4" font-family="IBM Plex Mono, monospace" font-size="20" font-weight="600">${n}</text></g></g>`).join('')}
</svg>`;
const DOC = `<article class="doc" tabindex="0" aria-label="Field notes, scrollable">
  <h3>Field notes</h3>
  <p>Three things we learned this month, written down so the next person doesn't have to learn them the hard way.</p>
  <h4>1. Start small</h4>
  <p>The best first projects fit on one page. Ship it, post it on the Wall, and let people tell you what to build next.</p>
  <h4>2. Show your sources</h4>
  <p>Link the tutorial, the paper or the thread you started from. It saves everyone a search and gives credit where it's due.</p>
  <h4>3. Say what helped</h4>
  <p>If an AI assistant drafted part of it, say so. Nobody minds; everybody likes knowing.</p>
  <h4>4. Keep a changelog</h4>
  <p>One line per change, newest first. It's the fastest way for a newcomer to see what moved and why.</p>
  <h4>5. Ask early</h4>
  <p>Post the half-finished version. The Wall is better at spotting a wrong turn on day two than on day twenty.</p>
  <h4>Next</h4>
  <p>We'll pick the next topic together on the Wall. Bring ideas, sketches or a link to something you liked.</p>
</article>`;

export function createShowcase(host) {
  const el = document.createElement('section');
  el.className = 'site'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'A pinned artifact, as it looks on Abstracts');
  el.innerHTML = `<header class="site__head"><span class="site__avatar" aria-hidden="true"></span><b class="site__community"></b><span class="site__title"></span><button class="site__close" type="button" aria-label="Close">${icon(I.x)}</button></header>
    <div class="site__stage"></div>
    <footer class="site__actions"><span class="act">${icon(I.up)}<b>24</b></span><span class="act">${icon(I.down)}<b>1</b></span><span class="act">${icon(I.save)}Save</span><span class="act" aria-label="Share">${icon(I.share)}</span><span class="act">${icon(I.full)}Full screen</span></footer>`;
  host.append(el);
  const stage = el.querySelector('.site__stage');
  let kind = null, three = null, onClose = () => {};
  const drag = { yaw: 0, pitch: 0.42, panX: -40, panY: -10, active: null };

  function buildScene() {
    const canvas = document.createElement('canvas'); canvas.className = 'scene'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Low-poly island: drag or use the arrow keys to turn it');
    stage.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a7a96, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 5, 2); scene.add(sun);
    const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
    const g = new THREE.Group(); scene.add(g);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 6), m('#6fb0e6')); water.position.y = -0.1; g.add(water);
    const land = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.35, 7), m('#e9d6a3')); land.position.y = 0.05; g.add(land);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.12, 7), m('#7fbf88')); grass.position.y = 0.28; g.add(grass);
    for (const [x, z, s] of [[-0.5, -0.3, 1], [-0.2, -0.65, 0.8], [0.55, -0.4, 0.9], [-0.7, 0.3, 0.7], [0.15, 0.55, 0.75]]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.6 * s, 6), m('#2f6e4b')); t.position.set(x, 0.34 + 0.3 * s, z); g.add(t);
    }
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.3), m('#f7f1e4')); house.position.set(0.35, 0.48, 0.2); g.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 4), m('#ef6b4e')); roof.position.set(0.35, 0.74, 0.2); roof.rotation.y = Math.PI / 4; g.add(roof);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.7, 8), m('#f7f1e4')); tower.position.set(-0.15, 0.68, 0.05); g.add(tower);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#f4b63f', emissive: '#f4b63f', emissiveIntensity: 0.8 })); lamp.position.set(-0.15, 1.08, 0.05); g.add(lamp);
    three = { renderer, scene, cam, g, canvas };
    canvas.addEventListener('keydown', e => { const d = { ArrowLeft: -0.2, ArrowRight: 0.2 }[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); drag.yaw += d; drag.touched = true; } });
    pointerDrag(canvas, (dx, dy) => { drag.yaw += dx * 0.01; drag.pitch = Math.min(1.2, Math.max(0.1, drag.pitch + dy * 0.005)); drag.touched = true; });
  }
  function pointerDrag(target, fn) {
    // Capture the pointer only once it really drags, so a plain tap still reaches a pin.
    target.addEventListener('pointerdown', e => { drag.active = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; });
    target.addEventListener('pointermove', e => {
      if (!drag.active) return;
      const dx = e.clientX - drag.active.x, dy = e.clientY - drag.active.y; drag.active.x = e.clientX; drag.active.y = e.clientY;
      drag.active.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.active.moved > 4 && !target.hasPointerCapture(drag.active.id)) target.setPointerCapture(drag.active.id);
      fn(dx, dy);
    });
    const end = () => { drag.lastMoved = (drag.active?.moved || 0) > 6; drag.active = null; };
    target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
  }
  function buildMap() {
    stage.innerHTML = `<div class="mapwrap">${MAP}</div>`;
    const wrap = stage.firstChild, svgEl = wrap.firstElementChild;
    const place = () => { svgEl.style.transform = `translate(${drag.panX}px, ${drag.panY}px)`; };
    pointerDrag(wrap, (dx, dy) => { drag.panX = Math.min(0, Math.max(-(svgEl.clientWidth - wrap.clientWidth), drag.panX + dx)); drag.panY = Math.min(0, Math.max(-(svgEl.clientHeight - wrap.clientHeight), drag.panY + dy)); place(); });
    const tap = p => { for (const o of svgEl.querySelectorAll('.map__tip')) o.setAttribute('opacity', o.parentNode === p && o.getAttribute('opacity') === '0' ? '1' : '0'); };
    svgEl.querySelectorAll('.map__pin').forEach(p => {
      p.addEventListener('click', () => { if (!drag.lastMoved) tap(p); });
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tap(p); } });
    });
    place();
  }

  el.querySelector('.site__close').onclick = () => onClose();
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } });

  return {
    el,
    set onClose(fn) { onClose = fn; },
    /** Show `k` ('scene' | 'map' | 'doc') for community name `name`, with the card's accent color. */
    open(k, name, accent) {
      el.querySelector('.site__community').textContent = `a/${name || 'your-name'}`;
      el.querySelector('.site__avatar').textContent = (name || 'a')[0].toUpperCase();
      el.querySelector('.site__avatar').style.background = accent;
      el.querySelector('.site__title').textContent = TITLES[k];
      if (k === kind) return;
      if (three) { three.renderer.dispose(); three = null; }
      stage.innerHTML = ''; kind = k;
      Object.assign(drag, { yaw: 0, pitch: 0.42, panX: -40, panY: -10, touched: false });
      if (k === 'scene') buildScene(); else if (k === 'map') buildMap(); else stage.innerHTML = DOC;
    },
    /** Called every frame while visible. `clock` drives the slow auto-turn until someone drags. */
    render(clock, reduced) {
      if (!three) return;
      const { renderer, scene, cam, g, canvas } = three;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
      cam.aspect = w / h;
      const yaw = drag.yaw + (drag.touched || reduced ? 0 : clock * 0.35), d = 5.2;
      cam.position.set(Math.sin(yaw) * Math.cos(drag.pitch) * d, Math.sin(drag.pitch) * d + 0.3, Math.cos(yaw) * Math.cos(drag.pitch) * d);
      cam.lookAt(0, 0.35, 0); cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
  };
}
