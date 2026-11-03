import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FACES, END_FRONT, END_BACK, PX_W, PX_H, paint, drawCoverMaps, drawClothMaps } from './pages.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const canvas = document.getElementById('book');
const ui = {
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  dots: document.getElementById('dots'),
  hint: document.getElementById('hint'),
  join: document.getElementById('join'),
  again: document.getElementById('again'),
  live: document.getElementById('live'),
};

/* ---------- dimensions (1 unit = page width) ---------- */
const PW = 1, PH = 4 / 3;
const OH = 0.035;             // cover overhang
const BW = PW + OH, BH = PH + OH * 2;
const CT = 0.028;             // board thickness
const ST = 0.0042;            // gap between sheets
const NS = FACES.length / 2;  // sheets
const SEG = 30;               // bend segments per sheet
const CTRL = 64;              // px reserved for the controls

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
const target = new THREE.Vector3(0, 0.05, 0.02);
const ELEV = THREE.MathUtils.degToRad(63);
const camBase = new THREE.Vector3();

const key = new THREE.DirectionalLight(0xfff3e2, 2.1);
key.position.set(-0.7, 5, 1.1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 10 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.012;
key.shadow.radius = 6;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb9ad98, 0.6));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.013;
ground.receiveShadow = true;
scene.add(ground);

const book = new THREE.Group();
scene.add(book);

// Soft contact shadow under the book (the shadow map only does the sharp part).
const contact = (() => {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(18px)';
  g.fillStyle = '#000';
  g.beginPath(); g.roundRect(48, 44, 416, 168, 24); g.fill();
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.32, depthWrite: false, color: 0x2a2116 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.012;
  m.renderOrder = -1;
  scene.add(m);
  return m;
})();

/* ---------- textures ---------- */
function makeCanvas(w = PX_W, h = PX_H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, { srgb = true, flip = false, rotate = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (flip) { t.repeat.x = -1; t.offset.x = 1; }
  if (rotate) { t.center.set(0.5, 0.5); t.rotation = Math.PI; }
  return t;
}

// Cloth for board edges and the spine.
const clothC = makeCanvas(256, 256), clothB = makeCanvas(256, 256);
drawClothMaps(clothC, clothB);
const clothMap = tex(clothC), clothBump = tex(clothB, { srgb: false });
for (const t of [clothMap, clothBump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); }
const cloth = new THREE.MeshStandardMaterial({ map: clothMap, bumpMap: clothBump, bumpScale: 0.6, roughness: 0.88 });

// Cover art with foil stamping.
const cv = { color: makeCanvas(1024, 1365), rough: makeCanvas(1024, 1365), metal: makeCanvas(1024, 1365), bump: makeCanvas(1024, 1365) };
const coverMat = new THREE.MeshStandardMaterial({
  map: tex(cv.color), roughnessMap: tex(cv.rough, { srgb: false }), metalnessMap: tex(cv.metal, { srgb: false }),
  bumpMap: tex(cv.bump, { srgb: false }), bumpScale: 1.2, roughness: 1, metalness: 1,
});
function paintCover() {
  drawCoverMaps(cv.color, cv.rough, cv.metal, cv.bump);
  for (const k of ['map', 'roughnessMap', 'metalnessMap', 'bumpMap']) coverMat[k].needsUpdate = true;
}

const paperMat = (map, side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ map, roughness: 0.93, metalness: 0, side });

/* ---------- faces ---------- */
// Each face: a canvas + texture; animated faces repaint while visible.
const faces = FACES.map((f, i) => {
  const c = makeCanvas();
  const back = i % 2 === 1;
  return { ...f, canvas: c, texture: tex(c, { flip: back }), t0: 0, visible: false, dirty: true };
});
const endFront = { draw: END_FRONT, canvas: makeCanvas(), static: true };
endFront.texture = tex(endFront.canvas, { rotate: true });
const endBack = { draw: END_BACK, canvas: makeCanvas(), static: true };
endBack.texture = tex(endBack.canvas);

function paintStatic() {
  for (const f of [endFront, endBack]) { paint(f.canvas, f.draw, 0); f.texture.needsUpdate = true; }
  paintCover();
  for (const f of faces) f.dirty = true;
}



/* ---------- boards ---------- */
function board(artMat, artSide) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(BW, CT, BH), cloth);
  box.position.set(BW / 2, CT / 2, 0);
  box.castShadow = box.receiveShadow = true;
  g.add(box);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.012, BH - 0.012), artMat);
  plane.rotation.x = artSide > 0 ? -Math.PI / 2 : Math.PI / 2;
  plane.position.set(BW / 2, artSide > 0 ? CT + 0.0006 : -0.0006, 0);
  plane.receiveShadow = true;
  g.add(plane);
  return g;
}
const backBoard = board(paperMat(endBack.texture), 1);
book.add(backBoard);

const frontBoard = new THREE.Group();
const fb = board(coverMat, 1);
frontBoard.add(fb);
const inside = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.012, BH - 0.012), paperMat(endFront.texture));
inside.rotation.x = Math.PI / 2;
inside.position.set(BW / 2, -0.0006, 0);
inside.receiveShadow = true;
frontBoard.add(inside);
book.add(frontBoard);

const SPINE_L = CT * 2 + NS * ST + 0.006;
const spine = new THREE.Group();
const spineBox = new THREE.Mesh(new THREE.BoxGeometry(SPINE_L, 0.008, BH), cloth);
spineBox.position.set(SPINE_L / 2, 0.004, 0);
spineBox.castShadow = true;
spine.add(spineBox);
book.add(spine);

/* ---------- sheets ---------- */
function sheetGeometry() {
  const g = new THREE.BufferGeometry();
  const n = (SEG + 1) * 2;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  for (let i = 0; i <= SEG; i++) {
    uv.set([i / SEG, 1, i / SEG, 0], i * 4);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < SEG; i++) {
    const a = i * 2, c = a + 1, b = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  g.setIndex(idx);
  return g;
}

// Leaf 0 is the front board; leaves 1..NS are the sheets.
const leaves = [{ kind: 'cover', p: 0, target: 0, anim: null, curl: 1, object: frontBoard }];
for (let s = 0; s < NS; s++) {
  const geo = sheetGeometry();
  const front = new THREE.Mesh(geo, paperMat(faces[s * 2].texture));
  const back = new THREE.Mesh(geo, paperMat(faces[s * 2 + 1].texture, THREE.BackSide));
  for (const m of [front, back]) { m.castShadow = true; m.receiveShadow = true; }
  const group = new THREE.Group();
  group.add(front, back);
  book.add(group);
  leaves.push({ kind: 'sheet', p: 0, target: 0, anim: null, curl: 1, geo, index: s + 1, shown: -1, object: group });
}

const GUT = 0.2;
function shapeSheet(leaf, p) {
  const j = leaf.index;
  const yR = CT + (NS - j) * ST + ST, yL = CT + (j - 1) * ST + ST;
  const hy = lerp(yR, yL, p) + Math.sin(p * Math.PI) * 0.012;
  const pos = leaf.geo.attributes.position.array;
  const L = PW / SEG, s = Math.sin(p * Math.PI), theta = p * Math.PI;
  let x = 0, y = hy;
  const put = (i, x, y) => { pos.set([x, y, -PH / 2, x, y, PH / 2], i * 6); };
  put(0, x, y);
  for (let i = 0; i < SEG; i++) {
    const u = (i + 0.5) / SEG;
    const gut = GUT * Math.pow(Math.max(0, 1 - u / 0.16), 1.6);
    const phi = theta + gut * (1 - 2 * p) + leaf.curl * 0.95 * s * u;
    x += L * Math.cos(phi);
    y += L * Math.sin(phi);
    put(i + 1, x, y);
  }
  leaf.geo.attributes.position.needsUpdate = true;
  leaf.geo.computeVertexNormals();
  leaf.geo.computeBoundingSphere();
}

function shapeCover(p) {
  const yR = CT + NS * ST + ST * 1.5, yL = CT;
  frontBoard.position.y = lerp(yR, yL, p) + Math.sin(p * Math.PI) * 0.02;
  frontBoard.rotation.z = p * Math.PI;
  spine.rotation.z = Math.PI / 2 + (Math.PI / 2) * p;
  spine.scale.x = lerp(1, 0.6, p);
  book.position.x = -BW / 2 * (1 - ease(p));
  const w = lerp(BW, BW * 2, ease(p));
  contact.scale.set(w * 1.24, (BH + 0.02) * 1.5, 1);
  contact.position.x = book.position.x + lerp(BW / 2, 0, ease(p)) + 0.03;
  contact.position.z = 0.03;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t * t * (3 - 2 * t);

/* ---------- state ---------- */
let peek = { leaf: -1, amt: 0, goal: 0 };
let drag = null;
let started = false;

const spreadCount = leaves.length + 1; // closed, then one spread per turned leaf
const spread = () => leaves.filter(l => l.target === 1).length;
const nextLeaf = () => leaves.findIndex(l => l.target === 0);
const prevLeaf = () => { for (let i = leaves.length - 1; i >= 0; i--) if (leaves[i].target === 1) return i; return -1; };

const LABELS = ['Cover', FACES[0].title];
for (let i = 1; i < FACES.length - 1; i += 2) LABELS.push(`${FACES[i].title} ${FACES[i + 1].title}`);
LABELS.push(`${FACES[FACES.length - 1].title} Come build with us.`);

function go(dir) {
  const i = dir > 0 ? nextLeaf() : prevLeaf();
  if (i < 0) return false;
  turn(leaves[i], dir > 0 ? 1 : 0);
  leaves[i].curl = dir > 0 ? 1 : -1;
  // on a phone, land on the page you'd read next
  focus = dir > 0 ? (spread() >= 2 ? -1 : 1) : 1;
  interacted();
  syncUI();
  return true;
}

// Narrow screens show one page at a time; `focus` is -1 (left) or 1 (right).
let narrow = false, focus = 1, camX = 0;
const leftReadable = () => spread() >= 2;
function step(dir) {
  const s = spread();
  if (narrow && s > 0) {
    if (dir > 0 && focus === -1) { focus = 1; interacted(); syncUI(); wake(); return true; }
    if (dir < 0 && focus === 1 && leftReadable()) { focus = -1; interacted(); syncUI(); wake(); return true; }
  }
  return go(dir);
}

function restart() {
  const turned = leaves.map((l, i) => i).filter(i => leaves[i].target === 1).reverse();
  focus = 1;
  turned.forEach((i, n) => setTimeout(() => { turn(leaves[i], 0); leaves[i].curl = -1; syncUI(); }, n * (reduced ? 0 : 110)));
}

function interacted() {
  if (started) return;
  started = true;
  ui.hint.classList.add('gone');
}

function syncUI() {
  const s = spread();
  ui.prev.disabled = s === 0;
  ui.next.disabled = false;
  const last = s === spreadCount - 1 && (!narrow || focus === 1);
  ui.next.hidden = last;
  ui.again.hidden = !last;
  ui.join.hidden = !last;
  [...ui.dots.children].forEach((d, i) => d.setAttribute('aria-current', i === s ? 'true' : 'false'));
  ui.live.textContent = `Page ${s + 1} of ${spreadCount}: ${LABELS[s]}`;
}

for (let i = 0; i < spreadCount; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', `Go to ${LABELS[i]}`);
  b.addEventListener('click', () => {
    interacted();
    const s = spread();
    for (let k = 0; k < Math.abs(i - s); k++) setTimeout(() => { go(Math.sign(i - s)); if (k === Math.abs(i - s) - 1 && i >= 2) { focus = -1; syncUI(); } }, k * (reduced ? 0 : 120));
  });
  ui.dots.append(b);
}
ui.prev.addEventListener('click', () => step(-1));
ui.next.addEventListener('click', () => step(1));
ui.again.addEventListener('click', restart);
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { step(1); e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
});

/* ---------- pointer: click, swipe, drag, peek ---------- */
const v3 = new THREE.Vector3();
function screenX(x) {
  v3.set(x, 0, 0);
  book.localToWorld(v3);
  v3.project(camera);
  const r = canvas.getBoundingClientRect();
  return r.left + (v3.x + 1) / 2 * r.width;
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId, leaf: -1, dir: 0, moved: false, hist: [[performance.now(), e.clientX]] };
});
canvas.addEventListener('pointermove', e => {
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      const dir = dx < 0 ? 1 : -1;
      drag.moved = true;
      if (narrow && spread() > 0 && ((dir > 0 && focus === -1) || (dir < 0 && focus === 1 && leftReadable()))) { step(dir); return; }
      const i = dir > 0 ? nextLeaf() : prevLeaf();
      if (i >= 0) {
        drag.leaf = i; drag.dir = dir;
        leaves[i].curl = dir;
        canvas.setPointerCapture(e.pointerId);
        interacted();
      }
    }
    if (drag.leaf >= 0) {
      const page = Math.abs(screenX(PW) - screenX(0)) || 300;
      const f = clamp(Math.abs(dx) / (page * 1.7));
      const l = leaves[drag.leaf];
      l.p = drag.dir > 0 ? f * Math.sign(-dx) : 1 - f * Math.sign(dx);
      l.p = clamp(l.p);
      l.anim = null;
      drag.hist.push([performance.now(), e.clientX]);
      if (drag.hist.length > 6) drag.hist.shift();
    }
    return;
  }
  if (e.pointerType !== 'mouse' || narrow) return;
  // hover: lift the corner of the page under the pointer
  const sx = screenX(0), page = Math.abs(screenX(PW) - sx);
  const rel = (e.clientX - sx) / page;
  const r = canvas.getBoundingClientRect();
  const yIn = e.clientY > r.top + r.height * 0.08 && e.clientY < r.bottom - CTRL;
  const s = spread();
  let leaf = -1, goal = 0;
  if (s === 0) { if (rel > -0.6 && rel < 0.6 && yIn) { leaf = 0; goal = 0.06; } }
  else if (yIn && rel > 0.72 && rel < 1.05) { leaf = nextLeaf(); goal = 0.05; }
  else if (yIn && rel < -0.72 && rel > -1.05) { leaf = prevLeaf(); goal = -0.05; }
  if (leaf !== peek.leaf && peek.amt !== 0 && leaf !== -1) peek.amt = 0;
  if (leaf !== -1) peek.leaf = leaf;
  peek.goal = leaf === -1 ? 0 : goal;
  canvas.style.cursor = yIn && Math.abs(rel) < 1.05 ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { peek.goal = 0; });

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.leaf >= 0) {
    const l = leaves[d.leaf];
    const h = d.hist, a = h[0], b = h[h.length - 1];
    const page = Math.abs(screenX(PW) - screenX(0)) || 300;
    const vel = b[0] > a[0] ? -(b[1] - a[1]) / (b[0] - a[0]) * 1000 / (page * 1.7) : 0; // p per second, + = forward
    const to = d.dir > 0 ? (l.p > 0.4 || vel > 1.4 ? 1 : 0) : (l.p < 0.6 || vel < -1.4 ? 0 : 1);
    const completed = d.dir > 0 ? to === 1 : to === 0;
    turn(l, to, true);
    l.curl = l.target === 1 ? 1 : -1;
    if (completed) focus = d.dir > 0 ? (spread() >= 2 ? -1 : 1) : 1;
    syncUI();
    return;
  }
  if (d.moved) return;
  // a click: right side forward, left side back
  const r = canvas.getBoundingClientRect();
  const sx = narrow ? r.left + r.width / 2 : screenX(0);
  if (spread() === 0) step(1);
  else step(e.clientX >= sx ? 1 : -1);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', e => { if (drag && drag.leaf >= 0) { const l = leaves[drag.leaf]; turn(l, l.p > 0.5 ? 1 : 0, true); syncUI(); } drag = null; });

/* ---------- layout ---------- */
let W = 0, H = 0;
function layout() {
  const r = stage.getBoundingClientRect();
  W = Math.round(r.width); H = Math.round(r.height);
  if (!W || !H) return;
  renderer.setSize(W, H, false);
  const VH = H + CTRL;
  camera.aspect = W / VH;
  const dir = new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
  narrow = W < 640;
  const half = narrow ? BW / 2 + 0.02 : BW;
  const pts = [];
  for (const x of [-half, half]) for (const z of [-BH / 2, BH / 2]) pts.push(new THREE.Vector3(x, 0, z));
  pts.push(new THREE.Vector3(0, narrow ? 0.25 : 0.5, -PH / 2), new THREE.Vector3(-half, 0.05, BH / 2), new THREE.Vector3(half, 0.05, BH / 2));
  const ylim = (H - CTRL) / VH;
  const mx = W < 520 ? 0.985 : 0.95, my = 0.97;
  const place = d => {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of pts) {
      const q = p.clone().project(camera);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    return { fits: Math.max(-x0, x1) <= mx && (y1 - y0) / 2 <= ylim * my, cy: (y0 + y1) / 2 };
  };
  let lo = 1, hi = 30;
  for (let k = 0; k < 40; k++) {
    const d = (lo + hi) / 2;
    if (place(d).fits) hi = d; else lo = d;
  }
  const { cy } = place(hi);
  camBase.copy(camera.position);
  syncUI();
  camera.setViewOffset(W, VH, 0, CTRL - (VH / 2) * cy, W, H);
  camera.updateProjectionMatrix();
  postHeight();
  wake();
}

function postHeight() {
  parent.postMessage({ abstractsHeight: Math.ceil(document.body.getBoundingClientRect().height) }, '*');
}
new ResizeObserver(layout).observe(stage);
addEventListener('resize', postHeight);
addEventListener('load', postHeight);

/* ---------- animation ---------- */
// Turns are timed tweens on the wall clock, so they land exactly flat at any frame rate.
const TURN = reduced ? 0.28 : 1.05;
function turn(l, to, released = false) {
  l.target = to;
  const dist = Math.abs(to - l.p);
  l.anim = dist ? { from: l.p, to, start: performance.now(), dur: Math.max(0.22, TURN * (released ? 0.75 : 1) * Math.sqrt(dist)), out: released } : null;
  wake();
}
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeO = t => 1 - Math.pow(1 - t, 3);
let last = performance.now(), paintClock = 0, running = false, inView = true;

function visibleFaces(vp) {
  const set = new Set();
  let rightTop = -1, leftTop = -1;
  for (let i = 0; i < leaves.length; i++) {
    if (vp[i] <= 0.001 && rightTop < 0) rightTop = i;
    if (vp[i] >= 0.999) leftTop = i;
    if (vp[i] > 0.001 && vp[i] < 0.999 && i > 0) { set.add((i - 1) * 2); set.add((i - 1) * 2 + 1); }
  }
  if (rightTop > 0) set.add((rightTop - 1) * 2);
  if (leftTop > 0) set.add((leftTop - 1) * 2 + 1);
  return set;
}

function frame(now) {
  running = false;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // springs
  for (const l of leaves) {
    if (drag && leaves[drag.leaf] === l) continue;
    if (!l.anim) continue;
    const k = clamp((now - l.anim.start) / 1000 / l.anim.dur);
    l.p = lerp(l.anim.from, l.anim.to, (l.anim.out ? easeO : easeIO)(k));
    if (k >= 1) { l.p = l.anim.to; l.anim = null; }
  }
  peek.amt += (peek.goal - peek.amt) * (1 - Math.exp(-dt * 10));
  if (Math.abs(peek.amt) < 0.0005 && peek.goal === 0) peek.amt = 0;

  // visual progress: never let a lower sheet pass the one above it
  const vp = leaves.map((l, i) => clamp(l.p + (i === peek.leaf ? peek.amt : 0)));
  for (let i = 1; i < vp.length; i++) vp[i] = Math.min(vp[i], vp[i - 1]);

  shapeCover(vp[0]);
  const goalX = narrow && vp[0] > 0.5 ? focus * BW / 2 : 0;
  const nx = camX + (goalX - camX) * (1 - Math.exp(-dt * (reduced ? 30 : 6)));
  const camMoving = Math.abs(goalX - nx) > 0.0005;
  camX = camMoving ? nx : goalX;
  camera.position.set(camBase.x + camX, camBase.y, camBase.z);
  camera.lookAt(target.x + camX, target.y, target.z);
  for (let i = 1; i < leaves.length; i++) {
    const l = leaves[i];
    if (l.shown !== vp[i]) { shapeSheet(l, vp[i]); l.shown = vp[i]; }
  }

  // page art
  const vis = visibleFaces(vp);
  paintClock += dt;
  const paintNow = paintClock >= 1 / 30;
  if (paintNow) paintClock = 0;
  faces.forEach((f, i) => {
    const on = vis.has(i);
    if (on && !f.visible) { f.t0 = now; f.dirty = true; }
    f.visible = on;
    if (!on) return;
    if (reduced ? f.dirty : (paintNow || f.dirty)) {
      paint(f.canvas, f.draw, reduced ? f.still : (now - f.t0) / 1000);
      f.texture.needsUpdate = true;
      f.dirty = false;
    }
  });

  renderer.render(scene, camera);
  const moving = leaves.some(l => l.anim) || peek.amt !== 0 || peek.goal !== 0 || drag || camMoving;
  if (inView && !document.hidden && (moving || !reduced)) wake();
}

function wake() {
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) wake(); }).observe(stage);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); wake(); } });

/* ---------- start ---------- */
async function fontsReady() {
  const want = ['600 60px Fraunces', '500 30px Fraunces', 'italic 500 30px Fraunces', '500 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"'];
  try {
    await Promise.race([Promise.all(want.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]);
  } catch { /* fall back to system fonts */ }
}

paintStatic();
syncUI();
layout();
wake();
fontsReady().then(() => { paintStatic(); wake(); document.documentElement.classList.add('ready'); });
