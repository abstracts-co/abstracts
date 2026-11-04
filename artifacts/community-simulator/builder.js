// Community simulator: the viewer picks a name, a vibe (cover picture), rules and a first pinned artifact;
// each choice shows up in 3D, and the pinned artifact opens live, as it looks on abstracts.co.
// "Watch it" plays the guided tour (also the mp4 via window.__seek).
import { createMotion, THREE, ease, seg, clamp, lerp } from './motion.js';
import { C, SERIF, MONO, paper, shadowed, card, canvasTexture, rr, person, robot, idle, pin, gear, blob, postFace } from './cast.js';
import { VIBES, vibe, vibeURL } from './vibes.js';
import { createShowcase } from './showcase.js';

const SITE = 'https://abstracts.co';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;                 // the site's own rule (worker/registry.ts)
const validName = s => s.length >= 2 && s.length <= 40 && SLUG.test(s);
const accentOf = k => (k ? vibe(k)[2] : C.kraft);
const RULES = ['Be kind.', 'Link your sources.', 'Say if an AI helped.', 'No spam.'];
const PINS = [['scene', '3D scene'], ['map', 'Map'], ['doc', 'Document']];

/* ---------- dimensions: a paper box that folds into the community card ---------- */
const BW = 1.0, BD = 0.7, BH = 0.2, TH = 0.012;
const WALL = { x: 1.12, z: -0.42, w: 0.9, h: 0.78, ry: -0.32 };

let box, base, flaps, lidPivot, lidFace, lidTex, disc, discTex, stamp, pinOnCard, thumb, thumbPin, thumbTex;
let wall, roll, wallSheet, sign, signTex, signPivot, me, bot, folder, confetti, gearMesh, posts;
let outerMats = [], show, cap, viewEl;
// One short caption per beat, shown only while the guided tour plays (and in the video), next to what it names.
const CAPS = [   // a small story, told while "Watch it" plays: the screen shows the how
  "Sam's been dreaming up an indie games corner.",
  'a/indie-games. Taken? Nope.',
  t => (t < 2.8 ? 'Cozy? Calm? Hmm.' : 'Neon arcade. Obviously.'),   // the tour browses, then lands on arcade at 2.8 s
  'A few house rules.',
  "Sam's island goes up front.",
  'Open for business.',
];
const capText = (i, t) => (typeof CAPS[i] === 'function' ? CAPS[i](t) : CAPS[i]);
const COVER = BW / 3;                                     // a 3:1 cover across the top of the card

function buildBox(scene) {
  box = new THREE.Group(); scene.add(box);
  const crease = (w, d, mark) => canvasTexture(Math.round(w * 400), Math.round(d * 400), (g, cw, ch) => {
    g.fillStyle = C.card; g.fillRect(0, 0, cw, ch);
    g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeStyle = 'rgba(31,36,54,.16)'; g.strokeRect(6, 6, cw - 12, ch - 12); g.setLineDash([]);
    if (mark) { g.fillStyle = 'rgba(31,36,54,.13)'; g.font = `600 ${Math.round(ch * 0.34)}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('a/', cw / 2, ch / 2); }
  });
  const inners = {};
  const innerFor = (w, d, mark) => (inners[`${w}x${d}${mark}`] ||= paper('#ffffff', { map: crease(w, d, mark), bumpScale: 0.2 }));
  const outer = paper(C.kraft);
  outerMats.push(outer);
  const panel = (w, d, mark = false) => {   // a flat panel; +y is the inner face, -y the outer one
    const inner = innerFor(w, d, mark);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, TH, d), [outer, outer, inner, outer, outer, outer]);
    m.castShadow = m.receiveShadow = true; return m;
  };
  base = panel(BW, BD, true); base.position.y = TH / 2; box.add(base);
  const mk = (w, d, pos, off) => { const p = new THREE.Group(); p.position.copy(pos); const m = panel(w, d); m.position.copy(off); p.add(m); box.add(p); return p; };
  flaps = {
    front: mk(BW, BH, new THREE.Vector3(0, TH / 2, BD / 2), new THREE.Vector3(0, 0, BH / 2)),
    back: mk(BW, BH, new THREE.Vector3(0, TH / 2, -BD / 2), new THREE.Vector3(0, 0, -BH / 2)),
    right: mk(BH, BD, new THREE.Vector3(BW / 2, TH / 2, 0), new THREE.Vector3(BH / 2, 0, 0)),
    left: mk(BH, BD, new THREE.Vector3(-BW / 2, TH / 2, 0), new THREE.Vector3(-BH / 2, 0, 0)),
  };
  lidPivot = new THREE.Group(); lidPivot.position.z = -BH; flaps.back.add(lidPivot);
  const lid = panel(BW, BD); lid.position.z = -BD / 2; lidPivot.add(lid);
  // The card face sits on the lid's outer side; in lidFace, +y is up and +z is the front once the box is closed.
  lidFace = new THREE.Group(); lidFace.position.z = -BD / 2; lidFace.rotation.x = Math.PI; lidPivot.add(lidFace);
  lidTex = canvasTexture(1024, Math.round(1024 * BD / BW));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.97, BD * 0.96), paper('#ffffff', { map: lidTex, bumpScale: 0.12 }));
  face.rotation.x = -Math.PI / 2; face.position.y = TH / 2 + 0.001; face.receiveShadow = true; lidFace.add(face);
  // Avatar disc in the corner (first letter of the name).
  discTex = canvasTexture(256, 256);
  disc = new THREE.Group();
  const discSide = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 40), paper(C.teal));
  const discTop = new THREE.Mesh(new THREE.CircleGeometry(0.08, 40), new THREE.MeshStandardMaterial({ map: discTex, roughness: 0.8 }));
  discTop.rotation.x = -Math.PI / 2; discTop.position.y = 0.0115;
  disc.add(shadowed(discSide), discTop); disc.position.set(-BW / 2 + 0.13, TH / 2 + 0.011, -BD / 2 + COVER);
  disc.userData.side = discSide; lidFace.add(disc);
  // The first pin, in the first slot on the cover strip.
  pinOnCard = pin(C.coral); pinOnCard.scale.setScalar(0.9); lidFace.add(pinOnCard);
}

const SLOT = i => new THREE.Vector3(BW / 2 - 0.1 - (2 - i) * 0.11, TH / 2, -BD / 2 + 0.095);

function paintLid(s) {
  const col = accentOf(s.vibe);
  lidTex.paint((g, w, h) => {
    g.fillStyle = C.card; g.fillRect(0, 0, w, h);
    const ch = Math.round(w / 3);
    if (s.vibe) vibe(s.vibe)[3](g, w, ch); else { g.fillStyle = '#e6d6b8'; g.fillRect(0, 0, w, ch); }
    g.fillStyle = 'rgba(31,36,54,.08)'; g.fillRect(0, ch - 3, w, 3);
    // pin slots on the cover
    for (let i = 0; i < 3; i++) {
      const p = SLOT(i), x = (p.x / BW + 0.5) * w, y = (p.z / BD + 0.5) * h;
      g.fillStyle = 'rgba(31,36,54,.28)'; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill();
      g.setLineDash([7, 6]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,253,248,.9)';
      g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    const name = s.name || 'your-name';
    g.fillStyle = s.name ? C.ink : 'rgba(31,36,54,.28)'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let size = 100, px = 0;
    const span = () => { g.font = `700 ${Math.round(size * 0.8)}px ${MONO}`; px = g.measureText('a/').width; g.font = `600 ${size}px ${SERIF}`; return px + 8 + g.measureText(name).width; };
    while (span() > w * 0.86 && size > 28) size -= 4;
    g.font = `700 ${Math.round(size * 0.8)}px ${MONO}`; g.fillText('a/', w * 0.07, h * 0.77);
    g.font = `600 ${size}px ${SERIF}`; g.fillText(name, w * 0.07 + px + 8, h * 0.77);
    g.fillStyle = 'rgba(31,36,54,.62)'; g.font = `500 36px ${MONO}`;
    g.fillText('Owner: you · 1 member', w * 0.07, h * 0.9);
  });
  discTex.paint((g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = C.card; g.font = `600 150px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((s.name || 'a')[0].toUpperCase(), w / 2, h / 2 + 8);
  });
  disc.userData.side.material.color.set(col);
}

const allRules = s => [...s.rules, ...(s.custom.trim() ? [s.custom.trim()] : [])];
function paintSign(s) {
  signTex.paint((g, w, h) => {
    g.fillStyle = C.card; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(31,36,54,.12)'; g.lineWidth = 4; rr(g, 10, 10, w - 20, h - 20, 18); g.stroke();
    g.fillStyle = C.ink; g.font = `600 44px ${SERIF}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('Rules', 40, 30);
    const list = allRules(s);
    if (!list.length) { g.fillStyle = 'rgba(31,36,54,.3)'; g.font = `600 40px ${SERIF}`; g.fillText('…', 40, 100); return; }
    let size = 38, lines;
    const wrap = (text, max) => { const out = []; let cur = ''; for (const wd of text.split(/\s+/)) { const t = cur ? `${cur} ${wd}` : wd; if (g.measureText(t).width > max && cur) { out.push(cur); cur = wd; } else cur = t; } out.push(cur); return out; };
    do { g.font = `500 ${size}px ${SERIF}`; lines = list.flatMap((r, i) => wrap(r, w - 130).map((l, k) => [i, k, l])); } while (lines.length * size * 1.2 > h - 120 && --size > 16);
    lines.forEach(([i, k, l], n) => {
      const y = 96 + n * size * 1.2;
      if (k === 0) { g.fillStyle = 'rgba(31,36,54,.55)'; g.font = `600 ${size * 0.8}px ${MONO}`; g.fillText(`${i + 1}`, 42, y + size * 0.12); }
      g.fillStyle = C.ink; g.font = `500 ${size}px ${SERIF}`; g.fillText(l, 84, y);
    });
  });
}

const ART = {
  scene: (g, w, h) => {
    g.fillStyle = '#20263a'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.55, s = w * 0.2;
    const face = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x * s, cy + y * s) : g.moveTo(cx + x * s, cy + y * s))); g.closePath(); g.fill(); };
    face([[0, -1], [0.87, -0.5], [0, 0], [-0.87, -0.5]], C.sun);
    face([[-0.87, -0.5], [0, 0], [0, 1], [-0.87, 0.5]], C.teal);
    face([[0.87, -0.5], [0, 0], [0, 1], [0.87, 0.5]], '#1d7a6e');
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((i * 97) % w, (i * 53) % (h * 0.4), 3, 0, 7); g.fill(); }
  },
  map: (g, w, h) => {
    g.fillStyle = '#cfe6ef'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fd0a6'; g.beginPath(); g.ellipse(w * 0.42, h * 0.5, w * 0.36, h * 0.32, 0.3, 0, 7); g.fill();
    g.fillStyle = '#7fbf88'; g.beginPath(); g.ellipse(w * 0.5, h * 0.46, w * 0.16, h * 0.12, -0.4, 0, 7); g.fill();
    g.setLineDash([10, 9]); g.strokeStyle = C.coral; g.lineWidth = 7; g.beginPath(); g.moveTo(w * 0.18, h * 0.65); g.bezierCurveTo(w * 0.35, h * 0.2, w * 0.6, h * 0.8, w * 0.8, h * 0.3); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.coral; g.beginPath(); g.arc(w * 0.8, h * 0.3, 13, 0, 7); g.fill();
  },
  doc: (g, w, h) => {
    g.fillStyle = C.card; g.fillRect(0, 0, w, h);
    g.fillStyle = C.ink; g.font = `600 44px ${SERIF}`; g.fillText('Field notes', w * 0.1, h * 0.26);
    g.fillStyle = 'rgba(31,36,54,.22)'; [0.9, 0.75, 0.85, 0.6, 0.8].forEach((f, i) => { rr(g, w * 0.1, h * (0.38 + i * 0.11), w * 0.8 * f, 14, 7); g.fill(); });
  },
};

function buildWorld(api) {
  const { scene } = api;
  buildBox(scene);
  // Wall: a paper sheet that unrolls upward, with a roll on top.
  wall = new THREE.Group(); wall.position.set(WALL.x, 0, WALL.z); wall.rotation.y = WALL.ry; scene.add(wall);
  const wallTex = canvasTexture(900, 780, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.ink; g.font = `600 56px ${SERIF}`; g.textBaseline = 'top'; g.fillText('The Wall', 48, 40);
  });
  wallTex.wrapS = THREE.ClampToEdgeWrapping;
  wallSheet = new THREE.Mesh(new THREE.PlaneGeometry(WALL.w, WALL.h), paper('#ffffff', { map: wallTex, side: THREE.DoubleSide, bumpScale: 0.2 }));
  wallSheet.castShadow = wallSheet.receiveShadow = true; wall.add(wallSheet);
  roll = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, WALL.w + 0.04, 28), paper('#f3ead8')));
  roll.rotation.z = Math.PI / 2; wall.add(roll);
  const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(WALL.w + 0.08, 0.03, 0.08), paper(C.kraft))); foot.position.y = 0.015; wall.add(foot);
  posts = [[C.sky, false, -0.2, 0.2], [C.plum, true, 0.08, 0.17], [C.green, false, 0.3, 0.24]].map(([c, b, x, y], i) => {
    const p = card(0.22, 0.15, { face: postFace(c, [0.9, 0.6 + i * 0.1, 0.4], b), thick: 0.006, px: 900 });
    p.rotation.x = Math.PI / 2; p.position.set(x, y, 0.006); p.userData.home = p.position.clone(); wall.add(p); return p;
  });
  // The rule sign hangs from a pin near the top of the wall.
  signTex = canvasTexture(640, 480);
  signPivot = new THREE.Group(); signPivot.position.set(-0.13, WALL.h - 0.16, 0.02); wall.add(signPivot);
  sign = card(0.38, 0.285, { thick: 0.01 }); sign.rotation.x = Math.PI / 2; sign.position.set(0, -0.17, 0.012);
  const signFace = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.278), paper('#ffffff', { map: signTex, bumpScale: 0.12 })); signFace.position.set(0, 0, 0); signFace.rotation.x = -Math.PI / 2; signFace.position.y = 0.0055;
  sign.add(signFace);
  const hook = pin(C.ink); hook.scale.setScalar(0.55); hook.rotation.x = Math.PI / 2; hook.position.z = 0.0;
  const string = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.002, 4, 30, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: C.ink }));
  string.rotation.z = Math.PI * 1.19; string.position.y = -0.105;
  signPivot.add(sign, hook, string);
  // The pinned artifact's thumbnail on the wall.
  thumbTex = canvasTexture(420, 300);
  thumb = new THREE.Group();
  const thumbCard = card(0.26, 0.19, { thick: 0.008 }); thumbCard.rotation.x = Math.PI / 2;
  const tf = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.17), new THREE.MeshStandardMaterial({ map: thumbTex, roughness: 0.75 })); tf.position.z = 0.0045;
  thumbPin = pin(C.coral); thumbPin.scale.setScalar(0.6); thumbPin.rotation.x = Math.PI / 2; thumbPin.position.set(0, 0.07, 0.004);
  thumb.add(thumbCard, tf, thumbPin); scene.add(thumb);
  // Cast.
  me = person(C.coral); scene.add(me);
  bot = robot(); scene.add(bot);
  // Rubber stamp for the name.
  stamp = new THREE.Group();
  const block = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.1), paper('#b98a5a')));
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.09), gloss(C.ink)); pad.position.y = -0.03;
  const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.12, 20), paper('#8a5d3b'))); handle.position.y = 0.085;
  const knob = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), paper(C.coral))); knob.position.y = 0.16;
  stamp.add(block, pad, handle, knob); scene.add(stamp);
  // Folder for the end: "public, on GitHub".
  folder = new THREE.Group(); scene.add(folder);
  const fb = new THREE.Group();
  const backPane = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.92, 0.014), paper('#e9c97d')));
  backPane.position.y = 0.46;
  const tabTex = canvasTexture(560, 120, (g, w, h) => { g.fillStyle = '#e9c97d'; g.fillRect(0, 0, w, h); g.fillStyle = C.ink; g.font = `600 44px ${MONO}`; g.textBaseline = 'middle'; g.fillText('public · on GitHub', 26, h / 2 + 2); });
  const tab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.014), [paper('#e9c97d'), paper('#e9c97d'), paper('#e9c97d'), paper('#e9c97d'), paper('#ffffff', { map: tabTex }), paper('#e9c97d')]));
  tab.position.set(-0.3, 0.98, 0);
  fb.add(backPane, tab); fb.position.z = -0.12; folder.add(fb);
  const front = new THREE.Group(); front.position.z = 0.17;
  const frontPane = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 0.014), paper('#f0d590'))); frontPane.position.y = 0.13;
  front.add(frontPane); folder.add(front); folder.userData.front = front;
  folder.add(blob(1.7, 0.7, 0.3));
  gearMesh = gear(C.ink, 0.1); scene.add(gearMesh);
  // Paper confetti (skipped with reduced motion).
  confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.024), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), 60);
  const cols = [C.coral, C.sun, C.teal, C.sky, C.plum, C.pink];
  for (let i = 0; i < 60; i++) confetti.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  scene.add(confetti);
  viewEl = api.root.querySelector('.view');
  show = createShowcase(viewEl);
  cap = document.createElement('p'); cap.className = 'tourcap'; cap.hidden = true; cap.setAttribute('aria-hidden', 'true');
  viewEl.append(cap);
  show.onClose = () => api.input('viewing', false);
  const b = new THREE.Vector3(0.27, 0.43, 0.012); wall.updateMatrixWorld(true); wall.localToWorld(b);
  CLOSE.target = [b.x, b.y, b.z];
}
const CLOSE = { target: [0, 0, 0], radius: 0.2, tall: 0.75, elev: 4, azim: -18 };
const gloss = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 });

/* ---------- pose: everything from (step, local t, state) ---------- */
const CAM = [   // each frame spans the whole subject: you on the left, the wall (from step 3) on the right
  { target: [-0.12, 0.02, -0.3], radius: 1.0, tall: 0.9, elev: 44, azim: -14 },
  { target: [-0.16, 0.14, 0], radius: 0.9, tall: 0.62, elev: 38, azim: -8 },
  { target: [-0.16, 0.12, 0], radius: 0.86, tall: 0.62, elev: 46, azim: 4 },
  { target: [0.42, 0.3, -0.18], radius: 1.5, tall: 0.5, elev: 22, azim: 6 },
  { target: [0.42, 0.26, -0.12], radius: 1.48, tall: 0.5, elev: 28, azim: -6 },
  { target: [0.36, 0.42, -0.15], radius: 1.48, tall: 0.62, elev: 18, azim: -10 },
];
const mixCam = (a, b, k) => ({ target: a.target.map((v, i) => lerp(v, b.target[i], k)), radius: lerp(a.radius, b.radius, k), tall: lerp(a.tall, b.tall, k), elev: lerp(a.elev, b.elev, k), azim: lerp(a.azim, b.azim, k) });
const foldOf = name => (!name ? 0 : name.length < 2 ? 0.5 : 1);
const hide = (o, v) => { o.visible = !!v; };
let painted = -1;
const v3 = new THREE.Vector3(), q = new THREE.Quaternion();

function pose(i, t, api) {
  const s = api.state, c = api.clock, R = api.reduced;
  if (painted !== api.version) { painted = api.version; paintLid(s); paintSign(s); thumbTex.paint(ART[s.pin] || ART.scene); }

  // camera
  const pinned = s.pin && s.pin !== 'none';
  const viewing = pinned && s.viewing;
  const from = i === 5 && viewing ? CLOSE : CAM[Math.max(0, i - 1)];
  let cam = mixCam(from, CAM[i], i === 0 ? 1 : ease.inOut(seg(t, 0, 1.3)));
  if (i === 0) cam = { ...cam, radius: lerp(1.25, CAM[0].radius, ease.inOut(seg(t, 0, 3))) };
  if (i === 5 && !R) cam = { ...cam, azim: cam.azim + Math.sin(c * 0.25) * 4 };
  // picking an artifact zooms into it on the wall, then opens it as it looks on the site
  const zk = i !== 4 ? 0 : viewing ? ease.inOut(clamp((api.since('viewing') - 0.3) / 0.8)) : api.prev('viewing') ? 1 - ease.inOut(clamp(api.since('viewing') / 0.8)) : 0;
  if (zk > 0) cam = mixCam(cam, CLOSE, zk);
  api.view(cam);
  const sa = i === 4 && viewing ? clamp((api.since('viewing') - 0.9) / 0.3) : 0;
  show.el.hidden = sa <= 0;
  if (sa > 0) {
    show.open(s.pin, s.name, accentOf(s.vibe));
    show.el.style.opacity = sa; show.el.style.transform = `scale(${0.94 + 0.06 * ease.out(sa)})`;
    show.render(c, R);
  }

  // fold: the box folds up as the name is typed
  let fold;
  if (i === 0) fold = R ? 0 : 0.09 * (0.5 - 0.5 * Math.cos(seg(t, 1.2, 5) * Math.PI * 3));
  else {
    // the fold follows the name, and keeps going if a suggestion moved straight on to the next step
    const k = ease.inOut(clamp(api.since('name') / 0.9));
    fold = lerp(foldOf(api.prev('name') ?? ''), foldOf(s.name), k);
    if (i >= 2 && !validName(s.name)) fold = 1;
  }
  const side = k => ease.inOut(seg(fold, k, k + 0.5)) * Math.PI / 2;
  flaps.front.rotation.x = -side(0); flaps.back.rotation.x = side(0.05);
  flaps.right.rotation.z = side(0.1); flaps.left.rotation.z = -side(0.1);
  lidPivot.rotation.x = ease.inOut(seg(fold, 0.5, 1)) * Math.PI / 2;

  // the box's outside takes the vibe's accent
  const tint = new THREE.Color(accentOf(api.prev('vibe'))).lerp(new THREE.Color(accentOf(s.vibe)), clamp(api.since('vibe') / 0.6));
  for (const m of outerMats) m.color.copy(tint);

  // avatar disc pops on with the first vibe
  const discK = s.vibe ? (api.prev('vibe') ? 1 : ease.back(clamp(api.since('vibe') / 0.45))) : 0;
  disc.scale.setScalar(Math.max(0.0001, discK)); hide(disc, discK > 0.001 && fold > 0.95);

  // stamp: during the name step, taps on each new letter, following the text
  const stampOn = i === 1 && fold > 0.9;
  hide(stamp, stampOn || (i === 1 && !!s.name));
  {
    const len = (s.name || '').length, sx = -0.32 + Math.min(1, len / 14) * 0.62;
    const tap = clamp(api.since('name') / 0.35), down = Math.sin(Math.min(1, tap) * Math.PI);
    const yTop = BH + TH + 0.035;
    const away = i === 1 ? ease.out(seg(t, 0.8, 1.6)) : 0;
    stamp.position.set(sx, yTop + 0.22 - (fold > 0.95 ? down * 0.2 : 0) + (1 - away) * 0.5, 0.03);
    stamp.rotation.z = Math.sin(c * 1.3) * 0.03;
  }

  // the first pin on the card, and its thumbnail on the wall
  const pinT = api.since('pin');
  const hasPin = s.pin && s.pin !== 'none' && i >= 4;
  hide(pinOnCard, hasPin && fold > 0.95);
  if (hasPin) {
    const p = SLOT(0), drop = api.prev('pin') && api.prev('pin') !== 'none' ? 1 : ease.bounce(clamp(pinT / 0.7));
    pinOnCard.position.set(p.x, p.y + (1 - drop) * 0.9, p.z);
    pinOnCard.rotation.y = (1 - drop) * 2;
  }
  const thumbK = hasPin ? (api.prev('pin') && api.prev('pin') !== 'none' ? 1 : ease.inOut(clamp((pinT - 0.5) / 0.9))) : 0;
  hide(thumb, thumbK > 0);
  if (thumbK > 0) {
    lidFace.updateWorldMatrix(true, false);
    const a = SLOT(0).clone(); lidFace.localToWorld(a);
    wall.updateWorldMatrix(true, false);
    const b = new THREE.Vector3(0.27, 0.43, 0.012); wall.localToWorld(b);
    thumb.position.lerpVectors(a, b, thumbK); thumb.position.y += Math.sin(thumbK * Math.PI) * 0.35;
    thumb.quaternion.copy(wall.quaternion); thumb.rotateZ((1 - thumbK) * 0.9);
    thumb.scale.setScalar(0.4 + 0.6 * thumbK);
    thumbPin.visible = thumbK > 0.9;
  }

  // wall unrolls on the rule step
  const u = i < 3 ? 0 : i === 3 ? (R ? 1 : ease.inOut(seg(t, 0.3, 1.7))) : 1;
  hide(wall, u > 0.001);
  wallSheet.scale.y = Math.max(0.001, u); wallSheet.position.y = (WALL.h * u) / 2;
  wallSheet.material.map.repeat.y = Math.max(0.001, u); wallSheet.material.map.offset.y = 1 - u;
  roll.position.set(0, WALL.h * u + 0.035, 0.02);
  posts.forEach((p, k) => { const pk = i === 3 ? ease.back(seg(t, 1.5 + k * 0.15, 1.9 + k * 0.15)) : i > 3 ? 1 : 0; p.scale.setScalar(Math.max(0.001, pk)); });
  const sk = i < 3 ? 0 : i === 3 ? (R ? 1 : seg(t, 1.6, 2.4)) : 1;
  hide(signPivot, sk > 0);
  signPivot.position.y = WALL.h - 0.16 + (1 - ease.bounce(sk)) * 0.3;
  signPivot.rotation.z = R ? 0 : Math.sin(c * 1.6) * 0.035 * (1 + Math.exp(-Math.min(api.since('rules'), api.since('custom')) * 2) * 4);

  // robot walks up and reads the rule
  const walk = i < 3 ? 0 : i === 3 ? (R ? 1 : ease.inOut(seg(t, 2.0, 4.2))) : 1;
  hide(bot, walk > 0);
  bot.position.set(lerp(2.1, 0.86, walk), Math.abs(Math.sin(walk * Math.PI * 7)) * 0.02 * (walk < 1 ? 1 : 0), lerp(0.7, 0.05, walk));
  bot.rotation.y = walk < 1 ? -1.0 : Math.PI - 0.2;           // walking in, then turned toward the sign
  idle(bot, c, 1.1);
  bot.userData.head.rotation.x = walk >= 1 ? -0.25 + (R ? 0 : Math.sin(c * 0.9) * 0.05) : 0;
  if (i === 5) bot.rotation.y = lerp(Math.PI - 0.2, 0.4, ease.inOut(seg(t, 2.6, 3.4)));

  // you, the owner
  me.position.set(-0.82, 0, 0.18); me.rotation.y = 0.5;
  idle(me, c, 0);
  const wave = i === 0 ? seg(t, 1, 3) : i === 5 ? seg(t, 3.2, 5) : 0;
  me.userData.head.rotation.z = Math.sin(wave * Math.PI * 4) * 0.12 * Math.sin(wave * Math.PI);
  me.position.y = Math.abs(Math.sin(wave * Math.PI * 3)) * 0.03;
  if (i === 1 && api.since('name') < 0.4) me.userData.head.rotation.x = -0.15;

  // end: the card slides into the folder
  const fIn = i === 5 ? (R ? 1 : ease.back(seg(t, 0, 0.7))) : 0;
  hide(folder, fIn > 0.001);
  folder.scale.set(1, Math.max(0.001, fIn), 1);
  folder.position.set(0, 0, 0);
  folder.userData.front.rotation.x = 0.12;
  const slide = i === 5 ? (R ? 1 : ease.inOut(seg(t, 0.6, 2.5))) : 0;
  box.position.set(0, slide * (0.04 + Math.sin(slide * Math.PI) * 0.5), slide * 0.03);
  box.rotation.set(0, 0, 0);
  // rotate so the card face points at the camera, and lift into the pocket
  if (slide > 0) {
    box.rotation.x = slide * Math.PI / 2;
    box.position.y = slide * (BD / 2 + 0.17) + Math.sin(slide * Math.PI) * 0.35;
    box.position.z = lerp(0, 0.03 - BH / 2 + 0.01, slide);
  }
  hide(gearMesh, i === 5);
  gearMesh.position.set(-0.45, 0.11 * (R ? 1 : ease.back(seg(t, 2.4, 3))), 0.5);
  gearMesh.rotation.set(0, 0.35, c * 0.8);

  placeCaption(i, t, api, sa);

  // confetti
  const conf = i === 5 && !R && t > 2.5;
  hide(confetti, conf);
  if (conf) {
    const m = new THREE.Matrix4(), e = new THREE.Euler();
    for (let k = 0; k < 60; k++) {
      const tt = t - 2.5 - (k % 12) * 0.05, h1 = Math.sin(k * 12.9898) * 43758.5453, r1 = h1 - Math.floor(h1), r2 = (k * 0.618) % 1;
      const y = 1.4 - tt * (0.35 + r1 * 0.25), x = -0.8 + r2 * 1.9 + Math.sin(tt * 2 + k) * 0.08, z = -0.3 + r1 * 0.8;
      e.set(tt * (2 + r1 * 3), tt * (1 + r2 * 2), k);
      m.compose(v3.set(x, Math.max(0.005, y), z), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
      confetti.setMatrixAt(k, m);
    }
    confetti.instanceMatrix.needsUpdate = true;
  }
}

function captionOn(api) {
  if (!cap) return false;
  const on = (api.playing || api.capture) && !api.root.classList.contains('bare');
  api.root.classList.toggle('touring', on);
  cap.hidden = !on;
  if (on) { const text = capText(api.index, api.t); if (cap.textContent !== text) cap.textContent = text; }
  return on;
}
function placeCaption(i, t, api, sa) {
  if (!captionOn(api)) return;
  const W = viewEl.clientWidth, H = viewEl.clientHeight;
  let x, y;
  if (i === 4 && sa > 0) {                       // over the opened artifact
    const r = show.el.getBoundingClientRect(), v = viewEl.getBoundingClientRect();
    x = r.left - v.left + r.width / 2; y = r.top - v.top + 112;
  } else {
    const p = new THREE.Vector3();
    if (i === 0) p.set(0, 0.02, -0.3);
    else if (i === 1 || i === 2) { p.set(0, 0.03, -BD / 2); lidFace.updateWorldMatrix(true, false); lidFace.localToWorld(p); }
    else if (i === 3) { p.set(-0.13, WALL.h + 0.1, 0); wall.updateWorldMatrix(true, false); wall.localToWorld(p); }
    else if (i === 4) p.set(CLOSE.target[0], CLOSE.target[1] + 0.14, CLOSE.target[2]);
    else p.set(-0.1, 1.12, -0.12);
    api.camera.updateMatrixWorld(); p.project(api.camera);
    x = (p.x + 1) / 2 * W; y = (1 - p.y) / 2 * H - 10;
  }
  const text = capText(i, t); if (cap.textContent !== text) cap.textContent = text;
  const half = Math.min(cap.offsetWidth, W - 16) / 2 + 8;
  cap.style.left = `${clamp(x, half, W - half)}px`;
  cap.style.top = `${clamp(y, 52, H - 12)}px`;
  cap.style.opacity = api.reduced ? 1 : ease.out(clamp(t / 0.25));
}

/* ---------- panel controls ---------- */
function nameFeedback(api, dropped) {
  const n = api.state.name;
  if (dropped) return api.note('Letters, numbers and hyphens only', 'warn');
  if (!n) return api.note('');
  if (n.length < 2) return api.note('Two characters or more', 'warn');
  if (n.startsWith('-') || n.endsWith('-')) return api.note('Start and end with a letter or number', 'warn');
  if (n.includes('--')) return api.note('One hyphen at a time', 'warn');
  api.note('');
}

const radios = (el, api, key, sel, after) => {
  const btns = [...el.querySelectorAll(sel)];
  const pick = (b, focus) => { api.input(key, b.dataset.k); after?.(b.dataset.k); if (focus) b.focus(); };
  btns.forEach((b, n) => {
    b.onclick = () => pick(b);
    b.onkeydown = e => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); pick(btns[(n + d + btns.length) % btns.length], true); } };
  });
  return () => { const k = api.state[key]; btns.forEach((b, n) => { b.setAttribute('aria-checked', String(b.dataset.k === k)); b.tabIndex = (k ? b.dataset.k === k : n === 0) ? 0 : -1; }); };
};

const steps = [
  {
    dur: 4.3, title: 'Community Simulator',
    controls(el, api) {
      el.innerHTML = '<div class="row"><button class="btn btn--primary btn--big" type="button">Start</button></div>';
      el.querySelector('button').onclick = () => { api.pause(); api.next(); };
    },
  },
  {
    dur: 6.6, title: 'Pick a name',
    controls(el, api) {
      el.innerHTML = `<label class="field"><span aria-hidden="true">a/</span><input type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40" placeholder="my-community" aria-label="Community name, after a/"></label>
        <div class="chips" aria-label="Suggestions">${['indie-games', 'home-cooks', 'vibe-coders'].map(n => `<button class="chip" type="button">${n}</button>`).join('')}</div>`;
      const input = el.querySelector('input');
      input.addEventListener('input', () => {
        const raw = input.value.toLowerCase().replace(/\s/g, '-');
        const clean = raw.replace(/[^a-z0-9-]/g, '').slice(0, 40);
        if (clean !== input.value) input.value = clean;
        api.input('name', clean); nameFeedback(api, clean !== raw);
      });
      // a suggestion fills the name and moves straight on
      el.querySelectorAll('.chip').forEach(b => (b.onclick = () => { api.input('name', b.textContent); api.next(); }));
      return () => { if (input.value !== api.state.name) input.value = api.state.name; if (!api.touched('name') || validName(api.state.name)) nameFeedback(api); };
    },
    ready: api => validName(api.state.name),
    tour: (t, api) => api.type('name', 'indie-games', t, 1.0, 6),
  },
  {
    dur: 5.1, title: 'Set the vibes',
    controls(el, api) {
      el.innerHTML = `<div class="vibes" role="radiogroup" aria-label="Cover picture">${VIBES.map(([k, label]) => `<button class="vibe" type="button" role="radio" aria-checked="false" aria-label="${label}" data-k="${k}" style="--img:url(${vibeURL(k)})"></button>`).join('')}</div>`;
      return radios(el, api, 'vibe', '.vibe');
    },
    tour(t, api) { api.pick('vibe', 'forest', t, 0.8); api.pick('vibe', 'ocean', t, 1.8); api.pick('vibe', 'arcade', t, 2.8); },
  },
  {
    dur: 6.7, title: 'Add rules',
    controls(el, api) {
      el.innerHTML = `<div class="chips">${RULES.map(r => `<button class="chip" type="button" aria-pressed="false">${r}</button>`).join('')}</div>
        <label class="field"><input type="text" maxlength="120" placeholder="Your own" aria-label="Your own rule"></label>`;
      const input = el.querySelector('input'), chips = [...el.querySelectorAll('.chip')];
      input.addEventListener('input', () => api.input('custom', input.value));
      chips.forEach(b => (b.onclick = () => { const on = api.state.rules.includes(b.textContent); api.input('rules', on ? api.state.rules.filter(r => r !== b.textContent) : RULES.filter(r => r === b.textContent || api.state.rules.includes(r))); }));
      return () => {
        if (input.value !== api.state.custom) input.value = api.state.custom;
        chips.forEach(b => b.setAttribute('aria-pressed', String(api.state.rules.includes(b.textContent))));
        api.note(api.state.custom.length > 80 ? 'Keep it to one line' : '', 'warn');
      };
    },
    tour(t, api) { api.pick('rules', ['Be kind.'], t, 2.2); api.pick('rules', ['Be kind.', 'Say if an AI helped.'], t, 3.0); api.pick('rules', ['Be kind.', 'Link your sources.', 'Say if an AI helped.'], t, 3.8); },
  },
  {
    dur: 7.4, title: 'Pin an artifact',
    controls(el, api) {
      el.innerHTML = `<div class="options" role="radiogroup" aria-label="Pick an example artifact">${PINS.map(([k, l]) => `<button class="option" type="button" role="radio" aria-checked="false" data-k="${k}">${l}</button>`).join('')}<button class="option" type="button" role="radio" aria-checked="false" data-k="none">None</button></div>`;
      return radios(el, api, 'pin', '.option', k => api.input('viewing', k !== 'none'));
    },
    tour(t, api) { api.pick('pin', 'scene', t, 1.0); api.pick('viewing', true, t, 1.0); },
  },
  {
    dur: 7.0, title: 'Make it real',
    controls(el) {
      el.innerHTML = `<ul class="facts">
          <li>It's yours, on your own GitHub</li>
          <li>Anyone can read it, no account needed</li>
          <li>Add rules and pins anytime</li>
        </ul>
        <div class="row"><a class="btn btn--primary btn--big" href="${SITE}/communities/new" target="_blank" rel="noopener">Create a community</a></div>`;
    },
  },
];

createMotion({
  root: document.getElementById('stage'),
  title: 'Community Simulator',
  mode: 'interactive',
  fonts: ['700 92px "IBM Plex Mono"', '600 112px Fraunces', '600 40px Fraunces', '500 30px "IBM Plex Mono"', '600 44px "IBM Plex Mono"'],
  initial: () => ({ name: '', vibe: null, rules: [], custom: '', pin: null, viewing: false }),
  steps,
  setup: buildWorld,
  update: pose,
  ui: captionOn,
});
