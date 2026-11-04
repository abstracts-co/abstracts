// Moderating 101: a scenario game. Six situation cards, the site's real moderation controls, a 3D Wall that reacts.
// Labels match the site as shipped: the post "…" menu (Hide post, Lock post, Pin post, Restrict author), the artifact page (Pin)
// and the community's Moderation panel (Invite, Rename, Delist community, Pause writes, Turn off anonymous posts).
import { createMotion, ease, seg, lerp, clamp, THREE } from './motion.js';
import { person, card, pin, gear, idle, paper, shiny, shadowed, canvasTexture, rr, C, SERIF, MONO } from './cast.js';

const TOOLS = [
  { id: 'hide', label: 'Hide post' },
  { id: 'lock', label: 'Lock post' },
  { id: 'pin', label: 'Pin' },
  { id: 'invite', label: 'Invite' },
  { id: 'rename', label: 'Rename' },
  { id: 'kind', label: 'Reply kindly', soft: true },
];
const HOLD = 2.5; // the tour lets the situation card sit this long before anything else happens
const AT = 3.8; // when the guided tour plays the card (seconds into a situation)
const THROW = 0.6; // the played card's flight to the Wall, before the Wall reacts
const PHONE = 2.1; // seconds after a pick when the real-screen phone slides in (after the Wall has reacted)
const SIT = [
  { title: 'The same spam post, three times.', best: 'hide', art: 'spam', caps: ['Someone’s selling watches. Again.', 'Gone.'] },
  { title: 'A thread turned into insults.', best: 'lock', art: 'fight', caps: ['Kit’s dark-mode thread is getting heated.', 'Locked. Everyone cools off.'] },
  { title: 'Everyone loves this artifact.', best: 'pin', art: 'love', caps: ['Rosa’s lighthouse is a hit.', 'Pinned where everyone sees it.'] },
  { title: 'A regular offers to help.', best: 'invite', art: 'help', caps: ['Leo keeps helping newcomers.', 'Leo’s a moderator now.'] },
  { title: 'The name no longer fits.', best: 'rename', art: 'name', caps: ['The community outgrew its name.', 'New name. Old links still work.'] },
  { title: 'A newcomer asks why their post was hidden.', best: 'kind', art: 'ask', caps: ['A newcomer’s post got hidden. They’re confused.', 'A kind word goes further.'] },
];
const SWITCHES = [{ id: 'delist', label: 'Delist community' }, { id: 'pause', label: 'Pause writes' }, { id: 'anon', label: 'Turn off anonymous posts' }];

/* ---------- world layout (units: a person is 0.36 tall) ---------- */
const CW = 0.38, CH = 0.25, GAP = 0.045, GX = -0.88, GY = 1.27;
const slot = i => [GX + CW / 2 + (i % 3) * (CW + GAP), GY - CH / 2 - Math.floor(i / 3) * (CH + GAP)];
const RAIL_X = 0.66, RAIL_Y = [1.08, 0.81, 0.54, 0.27], SW = 0.34, SH = 0.22;
const POSTS = {
  A: { who: 'u/ana', color: C.coral, title: 'Welcome to a/vibe-coders!', body: 'Say hi and share what you’re making.', foot: '♥ 24 · 9 replies' },
  S: { spam: true, who: 'u/deals4u', title: 'CHEAP WATCHES 90% OFF!!!', body: 'click here → best-deals', foot: '' },
  T: { who: 'u/kit', color: C.sky, title: 'Dark mode: yes or no?', body: 'Honest question about our theme…', foot: '38 replies', heat: true },
  R: { who: 'u/rosa', color: C.green, title: 'My 3D lighthouse', tag: 'ARTIFACT', foot: '♥ 61', narrow: true },
  D: { who: 'u/leo', color: C.sun, title: 'Show your desk setup', foot: '♥ 12 · 7 replies' },
  J: { who: 'u/rosa', color: C.green, title: 'Weekend build jam?', foot: '♥ 18 · 11 replies' },
  P: { who: 'u/sam', color: C.plum, title: 'Prompt of the week', foot: '♥ 9 · 3 replies' },
  N: { who: 'u/newbie', color: C.pink, title: 'Why was my post hidden?', body: 'I’m new here. Did I break a rule?', foot: '1 reply' },
};
const START = ['A', 'S1', 'T', 'S2', 'R', 'D', 'S3', 'J', 'P'];
const AFTER = { A: 0, T: 1, R: 2, D: 3, J: 4, P: 5 };
// Camera per step: [target x, y, z, radius, elev, azim]
const SHOTS = [
  [-0.2, 0.8, 0, 1.3, 8, -6, 0.66],
  [-0.25, 0.78, 0, 1.2, 6, -4, 0.66],
  [-0.25, 0.9, 0, 0.95, 6, -6, 0.8],
  [0.32, 0.8, 0, 0.95, 6, 10, 0.8],
  [-1.0, 0.45, 0.2, 0.8, 10, -8, 0.8],
  [0.1, 1.2, 0, 1.05, 4, 4, 0.55],
  [-0.4, 0.5, 0, 0.9, 6, 6, 0.8],
  [-0.2, 0.8, 0, 1.3, 8, 8, 0.66],
];

const TARGET = [
  () => [slot(3)[0], slot(3)[1], 0.05],
  () => [slot(1)[0], slot(1)[1], 0.05],
  () => [slot(2)[0], slot(2)[1], 0.05],
  () => [-1.43, 0.3, 0.3],
  () => [0, 1.52, 0.05],
  () => [slot(6)[0], slot(6)[1], 0.05],
];

/* ---------- textures ---------- */
function wrap(g, text, max) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
const postFace = p => (g, w, h) => {
  g.fillStyle = p.spam ? '#fbe7a1' : C.card; g.fillRect(0, 0, w, h);
  const pad = w * 0.07, r = h * 0.06;
  g.fillStyle = p.spam ? '#d6332a' : p.color; g.beginPath(); g.arc(pad + r, h * 0.15, r, 0, Math.PI * 2); g.fill();
  g.textBaseline = 'middle'; g.fillStyle = 'rgba(31,36,54,.72)'; g.font = `500 ${Math.round(h * 0.075)}px ${MONO}`;
  g.fillText(p.who, pad + r * 2.6, h * 0.155);
  if (p.tag) {
    g.font = `600 ${Math.round(h * 0.06)}px ${MONO}`; const tw = g.measureText(p.tag).width + h * 0.08;
    g.fillStyle = C.teal; rr(g, w - pad - tw, h * 0.1, tw, h * 0.11, h * 0.05); g.fill();
    g.fillStyle = '#fff'; g.fillText(p.tag, w - pad - tw + h * 0.04, h * 0.157);
  }
  const maxW = (p.narrow ? 0.56 : 0.86) * w;
  g.font = p.spam ? `700 ${Math.round(h * 0.095)}px ${MONO}` : `600 ${Math.round(h * 0.125)}px ${SERIF}`;
  g.fillStyle = p.spam ? '#c0392b' : C.ink;
  const lines = wrap(g, p.title, maxW).slice(0, 2);
  lines.forEach((l, i) => g.fillText(l, pad, h * (0.36 + i * 0.15)));
  const by = h * (0.36 + lines.length * 0.15 + 0.03);
  if (p.body) { g.font = `400 ${Math.round(h * 0.066)}px ${MONO}`; g.fillStyle = p.spam ? '#8a4b12' : 'rgba(31,36,54,.62)'; g.fillText(wrap(g, p.body, w - pad * 2)[0], pad, by); }
  else { g.fillStyle = 'rgba(31,36,54,.16)'; rr(g, pad, by - h * 0.03, maxW * 0.8, h * 0.055, h * 0.03); g.fill(); }
  g.font = `500 ${Math.round(h * 0.066)}px ${MONO}`; g.fillStyle = 'rgba(31,36,54,.6)';
  if (p.foot) g.fillText(p.foot, pad, h * 0.87);
  if (p.heat) for (let i = 0; i < 3; i++) { g.fillStyle = C.coral; rr(g, w * (0.5 + i * 0.13), h * 0.82, w * 0.1, h * 0.1, h * 0.05); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${Math.round(h * 0.07)}px ${MONO}`; g.fillText('!!', w * (0.53 + i * 0.13), h * 0.872); }
  if (p.spam) { g.strokeStyle = '#d6332a'; g.lineWidth = h * 0.02; g.setLineDash([h * 0.05, h * 0.03]); g.strokeRect(h * 0.02, h * 0.02, w - h * 0.04, h - h * 0.04); }
};
const labelFace = (text, { size = 0.5, weight = 500, family = MONO, color = C.ink, bg = C.card, align = 'center', italic = false } = {}) => (g, w, h) => {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = align;
  let s = Math.round(h * size);
  const font = () => `${italic ? 'italic ' : ''}${weight} ${s}px ${family}`;
  g.font = font(); while (g.measureText(text).width > w * 0.9 && s > 8) { s--; g.font = font(); }
  g.fillText(text, align === 'center' ? w / 2 : w * 0.06, h * 0.54);
};
const signFace = name => (g, w, h) => {
  labelFace(name, { size: 0.6, weight: 600, family: SERIF })(g, w, h);
  g.font = `600 ${Math.round(h * 0.15)}px ${MONO}`; g.textAlign = 'left'; const tw = g.measureText('EXAMPLE').width;
  g.fillStyle = C.sun; rr(g, w * 0.015, h * 0.07, tw + h * 0.16, h * 0.24, h * 0.12); g.fill();
  g.fillStyle = C.ink; g.fillText('EXAMPLE', w * 0.015 + h * 0.08, h * 0.2);
};
function glyph(g, id, cx, cy, r) {
  g.save(); g.translate(cx, cy); g.lineWidth = r * 0.22; g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  if (id === 'hide') { g.moveTo(-r * .6, -r * .6); g.lineTo(r * .6, r * .6); g.moveTo(r * .6, -r * .6); g.lineTo(-r * .6, r * .6); g.stroke(); }
  else if (id === 'lock') { g.arc(0, -r * .15, r * .42, Math.PI, 0); g.stroke(); g.beginPath(); g.roundRect(-r * .65, -r * .15, r * 1.3, r * .95, r * .15); g.fill(); }
  else if (id === 'pin') { g.arc(0, -r * .3, r * .45, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * .8); g.stroke(); }
  else if (id === 'invite') { g.arc(-r * .2, -r * .35, r * .32, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(-r * .2, r * .65, r * .55, Math.PI, 0); g.fill(); g.beginPath(); g.moveTo(r * .65, -r * .5); g.lineTo(r * .65, r * .1); g.moveTo(r * .35, -r * .2); g.lineTo(r * .95, -r * .2); g.stroke(); }
  else if (id === 'rename') { g.font = `700 ${Math.round(r * 1.3)}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Aa', 0, r * .05); }
  else { g.moveTo(0, r * .7); g.bezierCurveTo(-r * 1.1, -r * .1, -r * .5, -r * .9, 0, -r * .35); g.bezierCurveTo(r * .5, -r * .9, r * 1.1, -r * .1, 0, r * .7); g.fill(); }
  g.restore();
}
const tileFace = o => (g, w, h) => {
  g.fillStyle = o.soft ? '#fde6df' : C.card; g.fillRect(0, 0, w, h);
  const ink = o.soft ? C.coral : C.ink;
  g.strokeStyle = ink; g.lineWidth = w * 0.03; rr(g, w * 0.06, h * 0.04, w * 0.88, h * 0.92, w * 0.08); g.stroke();
  g.fillStyle = ink; g.strokeStyle = ink; glyph(g, o.id, w / 2, h * 0.4, w * 0.24);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 ${Math.round(w * 0.13)}px ${MONO}`;
  o.label.split(' ').forEach((t, n, a) => g.fillText(t, w / 2, h * (0.76 + (n - (a.length - 1) / 2) * 0.12)));
};
const plane = (w, h, tex, extra = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, ...extra }));

/* ---------- 3D cast ---------- */
const W = {};
function wallCard(p, w = CW, h = CH) {
  const pivot = new THREE.Group(), body = new THREE.Group();
  const c = card(w, h, { face: postFace(p), px: 1400, thick: 0.01 });
  c.rotation.x = Math.PI / 2; body.position.y = -h / 2; body.add(c); pivot.add(body);
  pivot.userData = { body, card: c };
  return pivot;
}

function setup(api) {
  const s = api.scene;
  api.key.position.set(-1.4, 4.2, 3.2);
  // the board
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.94, 1.32, 0.04), paper('#e6d8bf'));
  board.position.set(0, 0.72, -0.02); shadowed(board); s.add(board);
  for (const x of [-0.8, 0.8]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), paper('#cdbb98')); f.position.set(x, 0.03, 0); s.add(shadowed(f)); }
  // the sign (front: old name, back: new name)
  W.sign = new THREE.Group(); W.sign.position.set(0, 1.52, 0.01);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.17, 0.03), paper(C.card)); W.sign.add(shadowed(plank));
  const front = plane(0.93, 0.16, canvasTexture(1400, 240, signFace('a/vibe-coders')));
  front.position.z = 0.0155;
  const back = plane(0.93, 0.16, canvasTexture(1400, 240, signFace('a/ai-builders')));
  back.position.z = -0.0155; back.rotation.x = Math.PI;
  W.sign.add(front, back); s.add(W.sign);
  for (const x of [-0.36, 0.36]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), shiny(C.ink)); p.position.set(x, 1.4, 0.005); s.add(p); }
  W.tag = plane(0.3, 0.07, canvasTexture(800, 140, labelFace('a/vibe-coders →', { size: 0.42, bg: '#fffdf8', color: C.ink })));
  W.tag.position.set(0.66, 1.5, 0.03); s.add(W.tag);
  W.delist = plane(0.4, 0.07, canvasTexture(800, 140, labelFace('not in Explore', { size: 0.42, bg: C.ink, color: C.paper })));
  W.delist.position.set(0.72, 1.6, 0.03); s.add(W.delist);
  W.gear = gear(C.ink, 0.075, 9); W.gear.position.set(-0.74, 1.52, 0.03); s.add(W.gear);
  // posts
  W.posts = {};
  for (const k of START) { const p = wallCard(POSTS[k[0]]); s.add(p); W.posts[k] = p; }
  W.posts.N = wallCard(POSTS.N); s.add(W.posts.N);
  // a tiny lighthouse standing on the artifact card
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.09, 20), paper(C.card)); tower.position.y = 0.045;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0205, 0.02, 20), paper(C.coral)); band.position.y = 0.045;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), new THREE.MeshStandardMaterial({ color: C.sun, emissive: C.sun, emissiveIntensity: 0.7 })); lamp.position.y = 0.1;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.025, 20), shiny(C.ink)); cap.position.y = 0.122;
  lh.add(tower, band, lamp, cap); shadowed(lh); lh.position.set(0.11, -0.07, 0.03);
  W.posts.R.userData.body.add(lh); W.lighthouse = lh;
  // heated replies arriving under the thread
  W.heat = ['!!', 'wrong!', 'ugh'].map(t => { const m = plane(0.13, 0.045, canvasTexture(300, 104, (g, w, h) => { g.fillStyle = C.coral; rr(g, 0, 0, w, h, h / 2); g.fill(); labelFace(t, { size: 0.55, weight: 700, color: '#fff', bg: null })(g, w, h); }), { depthWrite: false }); W.posts.T.userData.body.add(m); return m; });
  // the padlock
  W.lock = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.025), shiny(C.sun, { metalness: 0.4, roughness: 0.35 }));
  const sh = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.006, 10, 20, Math.PI), shiny('#8a8f9e', { metalness: 0.8 })); sh.position.y = 0.025;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), shiny(C.ink)); hole.position.z = 0.0130;
  W.lock.add(lb, sh, hole); shadowed(W.lock); W.posts.T.userData.body.add(W.lock);
  // pinned rail: About + three slots
  const head = plane(0.34, 0.06, canvasTexture(700, 124, labelFace('PINNED', { size: 0.5, weight: 600, bg: null, color: 'rgba(31,36,54,.7)' })));
  head.position.set(RAIL_X, 1.24, 0.005); s.add(head);
  const about = wallCard({ who: 'a/vibe-coders', color: C.ink, title: 'About', tag: 'ABOUT' }, SW, SH);
  about.position.set(RAIL_X, RAIL_Y[0] + SH / 2, 0.012); s.add(about);
  const dashed = canvasTexture(340, 220, (g, w, h) => { g.strokeStyle = 'rgba(31,36,54,.38)'; g.lineWidth = 5; g.setLineDash([16, 12]); rr(g, 6, 6, w - 12, h - 12, 14); g.stroke(); });
  for (let i = 1; i < 4; i++) { const d = plane(SW, SH, dashed, { depthWrite: false }); d.position.set(RAIL_X, RAIL_Y[i], 0.002); s.add(d); }
  W.pinned = wallCard(POSTS.R, SW, SH); s.add(W.pinned);
  W.pin = pin(C.coral); W.pin.rotation.x = Math.PI / 2; W.pin.scale.setScalar(0.7); s.add(W.pin);
  // the reply under the newcomer's post
  W.reply = wallCard({ who: 'u/ana', color: C.coral, title: 'Happy to help!', body: 'It linked to a shop. Repost without it?', foot: '♥' }, 0.32, 0.2);
  s.add(W.reply);
  // owner and the new moderator
  W.owner = person(C.coral); W.owner.position.set(-1.17, 0, 0.2); W.owner.rotation.y = 0.35; s.add(W.owner);
  W.mod = person(C.sun); W.mod.position.set(-1.43, 0, 0.3); W.mod.rotation.y = 0.45; s.add(W.mod);
  const badge = (fig, color) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 20), shiny(color)); b.rotation.x = Math.PI / 2; b.position.set(0.03, 0.17, 0.075); fig.add(b); };
  badge(W.owner, C.sun); badge(W.mod, C.teal);
  const tag = (text, x, z) => { const c = card(0.22, 0.06, { face: labelFace(text, { size: 0.55, weight: 600 }), px: 1400 }); c.rotation.x = Math.PI / 2 - 0.25; c.position.set(x, 0.04, z); s.add(c); return c; };
  W.ownerTag = tag('owner', -1.13, 0.36);
  W.modTag = tag('moderator', -1.47, 0.48);
  // owner switches (end card)
  // the cards the owner plays onto the Wall
  W.thrown = TOOLS.map(o => { const c = card(0.12, 0.17, { face: tileFace(o), px: 1600, thick: 0.004 }); c.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(c); g.visible = false; s.add(g); return g; });
  W.paused = wallCard({ who: 'Moderation', color: C.ink, title: 'Writes paused' }, 0.5, 0.2);
  s.add(W.paused);
}

/* ---------- pose everything from (step, t, state) ---------- */
function update(i, t, api) {
  const st = api.state, rd = api.reduced, clock = api.clock;
  const solved = j => st[`a${j}`] === SIT[j].best;
  const since = j => (solved(j) ? api.since(`a${j}`) : i > j + 1 ? 99 : -1);
  const prog = (j, delay, dur) => { const s = since(j); return s < 0 ? 0 : rd ? 1 : clamp((s - THROW - delay) / dur); };

  // 1. spam folds away, the rest close the gap
  const fold = prog(0, 0, 0.7), flow = ease.inOut(prog(0, 0.55, 0.9));
  const focus = (j, k) => (i === j + 1 ? ease.out(seg(t, 0, 0.6)) * k : 0);
  START.forEach((k, n) => {
    const p = W.posts[k];
    if (k[0] === 'S') {
      const [x, y] = slot(n);
      p.position.set(x, y + CH / 2, 0.012 + focus(0, 0.03));
      p.rotation.x = -ease.inOut(fold) * Math.PI / 2;
      p.scale.setScalar(Math.max(0.001, 1 - ease.inOut(seg(fold, 0.3, 1))));
      p.visible = fold < 1;
      return;
    }
    const [x0, y0] = slot(n), [x1, y1] = slot(AFTER[k]);
    const lift = focus(1, k === 'T' ? 0.03 : 0) + focus(2, k === 'R' ? 0.03 : 0) + focus(3, k === 'J' ? 0.03 : 0);
    p.position.set(lerp(x0, x1, flow), lerp(y0, y1, flow) + CH / 2, 0.012 + Math.sin(Math.PI * flow) * 0.05 + lift);
  });
  // 6. the newcomer's post arrives when its situation comes up
  const nIn = i > 6 ? 1 : i === 6 ? (rd ? 1 : ease.out(seg(t, 0.2, 1.0))) : 0;
  const [nx, ny] = slot(6);
  W.posts.N.visible = nIn > 0;
  W.posts.N.position.set(nx, ny + CH / 2 + (1 - nIn) * 0.25, 0.012 + focus(5, 0.03));
  W.posts.N.scale.setScalar(Math.max(0.001, nIn));
  const kind = ease.back(prog(5, 0, 0.7));
  W.reply.visible = kind > 0;
  W.reply.position.set(nx + 0.34 - (1 - kind) * 0.2, ny + 0.06, 0.05);
  W.reply.rotation.z = -0.06;
  W.reply.scale.setScalar(Math.max(0.001, kind));

  // 2. heated replies keep arriving until the padlock drops
  const lock = prog(1, 0, 0.8);
  W.heat.forEach((m, n) => {
    const ph = rd ? 0.5 : (clock * 0.55 + n / 3) % 1;
    m.position.set(-0.11 + n * 0.11, -CH / 2 - 0.02 - ph * 0.1, 0.02);
    m.material.opacity = Math.sin(Math.PI * ph) * (1 - lock);
    m.visible = m.material.opacity > 0.01;
  });
  W.lock.visible = lock > 0;
  W.lock.position.set(CW / 2 - 0.05, CH / 2 - 0.04 + (1 - ease.bounce(lock)) * 0.4, 0.03);

  // 3. a copy of the artifact flies to the first free pin slot; a pin lands on it
  const fly = ease.inOut(prog(2, 0, 1.1)), drop = prog(2, 1.0, 0.45);
  const [ax, ay] = slot(AFTER.R);
  W.pinned.visible = fly > 0;
  W.pinned.position.set(lerp(ax, RAIL_X, fly), lerp(ay, RAIL_Y[1], fly) + SH / 2, 0.02 + Math.sin(Math.PI * fly) * 0.25);
  W.pinned.scale.setScalar(Math.max(0.001, lerp(CW / SW, 1, fly)));
  W.pin.visible = drop > 0;
  W.pin.position.set(RAIL_X, RAIL_Y[1] + SH * 0.32, 0.03 + (1 - ease.out(drop)) * 0.35);
  W.lighthouse.rotation.y = rd ? 0.6 : clock * 0.8;

  // 4. the new moderator steps up next to the owner
  const mod = prog(3, 0, 0.9);
  W.mod.visible = W.modTag.visible = mod > 0;
  W.mod.position.x = lerp(-1.75, -1.43, ease.out(mod));
  W.mod.scale.setScalar(Math.max(0.001, ease.back(mod)));
  W.modTag.scale.setScalar(Math.max(0.001, ease.out(seg(mod, 0.4, 1))));
  idle(W.owner, rd ? 0 : clock, 0); idle(W.mod, rd ? 0 : clock, 1);
  W.owner.rotation.y = 0.35 + (i === 4 ? Math.sin(Math.PI * seg(since(3) - THROW, 0, 1.2)) * -0.5 : 0);
  let hop = 0;
  SIT.forEach((sit, j) => {
    const g = W.thrown[TOOLS.findIndex(o => o.id === sit.best)], sj = since(j);
    if (!rd && sj >= 0) hop += Math.sin(Math.PI * clamp(sj / 0.35)) * 0.05;
    if (i !== j + 1) return;
    const k = rd || sj < 0 ? 1 : clamp(sj / THROW);
    g.visible = k > 0 && k < 1;
    if (!g.visible) return;
    const [x1, y1, z1] = TARGET[j](), e = ease.inOut(k);
    g.position.set(lerp(-1.12, x1, e), lerp(0.42, y1, e) + Math.sin(Math.PI * k) * 0.35, lerp(0.3, z1, e));
    g.rotation.set(0, 0, (1 - k) * 2.5);
    g.scale.setScalar(Math.max(0.001, 1 - ease.out(seg(k, 0.75, 1)) * 0.9));
  });
  W.owner.position.y = hop;

  // 5. the sign flips to the new name; the old one keeps redirecting
  const flip = prog(4, 0, 1.0);
  W.sign.rotation.x = ease.inOut(flip) * Math.PI;
  W.tag.material.opacity = prog(4, 0.9, 0.5); W.tag.visible = W.tag.material.opacity > 0;

  // gear: turns slowly, kicks on every decision
  let kick = 0; for (let j = 0; j < 6; j++) kick += ease.out(prog(j, 0, 1.2)) * Math.PI / 3;
  W.gear.rotation.z = -((rd ? 0 : clock * 0.35) + kick);

  // owner switches from the end card
  const sw = k => (st[`sw_${k}`] ? (rd ? 1 : clamp(api.since(`sw_${k}`) / 0.5)) : 0);
  W.delist.material.opacity = sw('delist'); W.delist.visible = sw('delist') > 0;
  const pz = ease.back(sw('pause'));
  W.paused.visible = pz > 0; W.paused.position.set(-0.27, 0.8 + 0.1, 0.09); W.paused.rotation.z = 0.06; W.paused.scale.setScalar(Math.max(0.001, pz));

  // camera
  const a = SHOTS[Math.max(0, i - 1)], b = SHOTS[i], k = rd ? 1 : ease.inOut(seg(t, 0, 1.4));
  const v = a.map((x, n) => lerp(x, b[n], k));
  api.view({ target: [v[0], v[1], v[2]], radius: v[3], tall: v[6], elev: v[4], azim: v[5] + (rd ? 0 : Math.sin(clock * 0.25) * 2) });

  ghost(i, t, api);
  api.refresh(); // apply this frame's state to the panel before measuring it
  phonePose(i, api);
  fitPanel(api);
  captions(i, t, api);
}

/* ---------- the real-screen phone slides in once the Wall has reacted ---------- */
function phonePose(i, api) {
  const j = i - 1, el = api.root.querySelector('.reveal');
  if (j < 0 || j >= SIT.length || !el) return;
  const k = api.reduced ? 1 : clamp((api.since(`a${j}`) - PHONE) / 0.45);
  const e = ease.out(k);
  el.style.opacity = e; el.style.visibility = k > 0 ? 'visible' : 'hidden';
  el.style.transform = `translateX(${(1 - e) * 40}px) rotate(${(1 - e) * 4}deg)`;
}

/* ---------- keep the panel above the control bar on short stages ---------- */
function fitPanel(api) {
  const root = api.root, c = root.querySelector('.panel .controls');
  if (!c) return;
  if (root.classList.contains('narrow')) { if (c.style.zoom) c.style.zoom = ''; return; }
  const z0 = parseFloat(c.style.zoom) || 1, r = c.getBoundingClientRect(), R = root.getBoundingClientRect();
  const natural = r.height / z0, avail = R.bottom - (api.capture ? 16 : 72) - (r.top + 0);
  const z = Math.max(0.55, Math.min(1, avail / natural));
  if (Math.abs(z - z0) > 0.01) c.style.zoom = z.toFixed(3);
}

/* ---------- tour captions: one short line per beat, next to what it describes ---------- */
let cap;
function captions(i, t, api) {
  const root = api.root;
  if (!cap) { cap = document.createElement('p'); cap.className = 'cap'; cap.setAttribute('aria-live', 'polite'); root.append(cap); }
  const on = api.playing || api.capture;
  let text = '', anchor = null;
  if (on) {
    const j = i - 1;
    // A narrator following the owner through a first week; the phone snapshot speaks for itself.
    anchor = 'wall';
    if (i === 0) text = 'Day one as owner of a/vibe-coders.';
    else if (j >= SIT.length) text = 'Not bad for a first week.';
    else {
      const s = SIT[j], since = api.state[`a${j}`] === s.best ? api.since(`a${j}`) : -1;
      text = since < 0 ? s.caps[0] : since < PHONE ? s.caps[1] : '';
    }
  }
  if (cap.textContent !== text) cap.textContent = text;
  cap.hidden = !text;
  if (!text) return;
  const R = root.getBoundingClientRect(), panel = root.querySelector('.panel').getBoundingClientRect();
  const narrow = root.classList.contains('narrow');
  const box = sel => { const n = root.querySelector(sel); return n && n.offsetParent ? n.getBoundingClientRect() : null; };
  let x, y, below = false;
  if (anchor === 'wall') {
    const v = root.querySelector('.view').getBoundingClientRect();
    if (narrow) { x = v.left + v.width / 2; y = v.bottom - 22; below = 'up'; } // under the board, clear of the sign
    else { x = (panel.right + R.right) / 2; y = R.top + 14; }
  } else {
    const r = box({ card: '.sitcard', hand: '.hand', phone: '.phone', gallery: '.gallery' }[anchor]) || box('.game') || panel;
    x = r.left + r.width / 2; y = anchor === 'hand' ? r.bottom + 6 : anchor === 'card' ? r.bottom : r.top + 2; below = anchor === 'hand';
  }
  cap.style.left = `${Math.min(Math.max(x - R.left, 120), R.width - 120)}px`; cap.style.top = `${y - R.top}px`;
  cap.style.transform = below === 'up' ? 'translate(-50%, -100%)' : below || anchor === 'wall' ? 'translate(-50%, 0)' : 'translate(-50%, -50%)';
}

/* ---------- the guided tour's cursor (Watch it and the video) ---------- */
let cursor, aim = null;
function ghost(i, t, api) {
  const j = i - 1;
  const on = (api.playing || api.capture) && j >= 0 && j < SIT.length;
  const root = api.root;
  if (!cursor) { cursor = document.createElement('div'); cursor.className = 'ghost'; cursor.setAttribute('aria-hidden', 'true'); cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z" fill="#1f2436" stroke="#fffdf8" stroke-width="1.6" stroke-linejoin="round"/></svg>'; root.append(cursor); }
  root.querySelectorAll('.tile.is-press').forEach(b => b.classList.remove('is-press'));
  if (!on) { cursor.style.opacity = 0; return; }
  const rr0 = root.getBoundingClientRect();
  const btn = root.querySelector(`.tile[data-tool="${SIT[j].best}"]`);
  if (btn && btn.offsetParent) { const r = btn.getBoundingClientRect(); aim = [r.left - rr0.left + r.width * 0.7, r.top - rr0.top + r.height * 0.6]; }
  const panel = root.querySelector('.panel').getBoundingClientRect();
  const from = [panel.right - rr0.left - 30, panel.bottom - rr0.top + 10];
  const to = aim || from;
  const p = api.reduced ? 1 : ease.inOut(seg(t, HOLD + 0.1, AT - 0.35));
  cursor.style.transform = `translate(${lerp(from[0], to[0], p)}px, ${lerp(from[1], to[1], p)}px) scale(${t > AT - 0.3 && t < AT + 0.1 ? 0.85 : 1})`;
  cursor.style.opacity = t < AT ? seg(t, HOLD, HOLD + 0.3) : 1 - seg(t, AT + 0.2, AT + 0.7);
  if (btn && t > AT - 0.3 && t < AT) btn.classList.add('is-press');
}

/* ---------- panels: a card game on the table, then a glimpse of the real screen ---------- */
const svgI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  hide: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pin: '<circle cx="12" cy="8" r="4.5" fill="currentColor"/><path d="M12 12.5V21"/>',
  invite: '<circle cx="9" cy="8" r="3.5" fill="currentColor"/><path d="M3 21a6 6 0 0 1 12 0z" fill="currentColor"/><path d="M19 7v6M16 10h6"/>',
  rename: '<path d="M3 19L8 5l5 14M5 14h6M15 19v-6.5a2.5 2.5 0 0 1 5 0V19M15 16h5"/>',
  kind: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="none"/>',
};
const ART = {
  spam: `<rect x="18" y="14" width="56" height="34" rx="4" fill="#f6dc9c" stroke="#d6332a" stroke-dasharray="4 3" transform="rotate(-8 46 31)"/><rect x="34" y="18" width="56" height="34" rx="4" fill="#f6dc9c" stroke="#d6332a" stroke-dasharray="4 3" transform="rotate(4 62 35)"/><rect x="50" y="22" width="56" height="34" rx="4" fill="#f6dc9c" stroke="#d6332a" stroke-dasharray="4 3"/><text x="78" y="44" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700" font-size="14" fill="#d6332a">$$$!!</text>`,
  fight: `<path d="M10 14h52a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H30l-10 8v-8h-10a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#ef6b4e"/><text x="36" y="34" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700" font-size="13" fill="#fff">#@!%</text><path d="M58 30h50a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6h-8v8l-10-8H58a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" fill="#6fb0e6"/><text x="84" y="48" text-anchor="middle" font-family="IBM Plex Mono" font-weight="700" font-size="13" fill="#fff">!!?!</text>`,
  love: `<rect x="50" y="22" width="18" height="40" rx="3" fill="#fffdf8" stroke="#1f2436" stroke-width="2"/><rect x="50" y="36" width="18" height="8" fill="#ef6b4e"/><path d="M46 22l13-12 13 12z" fill="#1f2436"/><circle cx="59" cy="16" r="3" fill="#f4b63f"/><g fill="#ef6b4e"><path d="M24 30c-6-4-6-10-1-10 2 0 3 2 3 2s1-2 3-2c5 0 5 6-1 10l-2 2z"/><path d="M92 20c-5-3.4-5-8.4-.8-8.4 1.7 0 2.5 1.7 2.5 1.7s.8-1.7 2.5-1.7c4.2 0 4.2 5-.8 8.4l-1.7 1.7z"/><path d="M96 48c-6-4-6-10-1-10 2 0 3 2 3 2s1-2 3-2c5 0 5 6-1 10l-2 2z"/></g>`,
  help: `<circle cx="52" cy="26" r="10" fill="#dc9c26"/><path d="M36 64c0-12 7-20 16-20s16 8 16 20z" fill="#dc9c26"/><path d="M66 46l12-22" stroke="#dc9c26" stroke-width="6" stroke-linecap="round"/><g fill="#f4b63f"><path d="M88 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M98 38l1.4 3.6 3.6 1.4-3.6 1.4L98 48l-1.4-3.6L93 43l3.6-1.4z"/></g>`,
  name: `<rect x="14" y="16" width="92" height="26" rx="4" fill="#fffdf8" stroke="#1f2436" stroke-width="2"/><text x="60" y="34" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="13" fill="#1f2436">a/vibe-coders</text><path d="M20 30h80" stroke="#ef6b4e" stroke-width="3"/><path d="M58 42v10M58 52h-4M58 52h4" stroke="#1f2436" stroke-width="2"/><text x="60" y="66" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="14" fill="#2a9d8f">?</text>`,
  ask: `<circle cx="34" cy="34" r="9" fill="#f2a1b4"/><path d="M20 64c0-11 6-18 14-18s14 7 14 18z" fill="#f2a1b4"/><path d="M58 10h46a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H72l-10 8v-8h-4a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="#fffdf8" stroke="#1f2436" stroke-width="2"/><text x="81" y="32" text-anchor="middle" font-family="Fraunces" font-weight="700" font-size="18" fill="#1f2436">?</text>`,
};

/* The real Abstracts screens, drawn in the site's own look (system font, sand and amber) inside a phone. */
const SI = { x: '<path d="M6 6l12 12M18 6L6 18"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>', reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>' };
const si = k => `<svg class="ri" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[k]}</svg>`;
const hl = on => (on ? ' is-hl' : '');
const postMenu = (who, text, on) => `<div class="rs-post"><div class="rs-head"><span class="rs-av" style="background:${who === 'kit' ? '#6fb0e6' : '#d6332a'}"></span><b>${who}</b><span class="rs-muted">· 2h</span><span class="rs-more is-open">${si('more')}</span></div><p>${text}</p></div>
<div class="rs-menu"><div class="rs-item${hl(on === 'hide')}">${si('x')}Hide post</div><div class="rs-item${hl(on === 'lock')}"><span class="ri"></span>Lock post</div><div class="rs-item"><span class="ri"></span>Pin post</div><div class="rs-item">${si('user')}Restrict @${who}</div><div class="rs-item rs-danger">${si('x')}Report</div></div>`;
const modTop = on => `<h4>Moderation</h4><div class="rs-row"><span class="rs-btn${hl(on)}">Delist community</span><span class="rs-btn${hl(on)}">Pause writes</span><span class="rs-btn${hl(on)}">Turn off anonymous posts</span></div>`;
const SCREENS = {
  hide: { url: 'a/vibe-coders/wall', body: postMenu('deals4u', 'CHEAP WATCHES 90% OFF!!!', 'hide') },
  lock: { url: 'a/vibe-coders/p/12', body: postMenu('kit', 'Dark mode: yes or no?', 'lock') },
  pin: { url: 'a/vibe-coders/artifacts/lighthouse', body: `<div class="rs-art"></div><h4>My 3D lighthouse</h4><div class="rs-row"><span class="rs-act">${si('heart')}61</span><span class="grow"></span><span class="rs-btn${hl(true)}">Pin</span></div>` },
  invite: { url: 'a/vibe-coders/moderation', body: `${modTop(false)}<h5>Moderators</h5><div class="rs-row"><span class="rs-field">leo</span><span class="rs-field rs-sel">Moderator ▾</span><span class="rs-btn${hl(true)}">Invite</span></div>` },
  rename: { url: 'a/vibe-coders/moderation', body: `<h4>Moderation</h4><h5>Community name</h5><div class="rs-row"><span class="rs-field">ai-builders</span><span class="rs-btn${hl(true)}">Rename</span></div>` },
  kind: { url: 'a/vibe-coders/p/31', body: `<div class="rs-post"><div class="rs-head"><span class="rs-av" style="background:#f2a1b4"></span><b>newbie</b><span class="rs-muted">· 5m</span><span class="rs-more">${si('more')}</span></div><p>Why was my post hidden?</p><div class="rs-row rs-acts"><span class="rs-act">${si('heart')}</span><span class="rs-act${hl(true)}">${si('reply')}Reply</span></div></div><div class="rs-compose">Happy to help! It linked to a shop…</div>` },
  switches: { url: 'a/vibe-coders/moderation', body: `${modTop(true)}<h5>Hidden and restricted</h5><div class="rs-list">Post 7 <span class="rs-btn">Restore</span></div>` },
};
const phone = (k, label) => `<figure class="phone" aria-label="${label}"><div class="phone__url">abstracts.co/${SCREENS[k].url}</div><div class="phone__screen">${SCREENS[k].body}</div></figure>`;

let wantFocus = false;
const focusCard = el => { if (!wantFocus) return; wantFocus = false; const h = el.querySelector('[data-focus]') || el.closest('.panel')?.querySelector('.title'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } };
const next = api => { wantFocus = true; api.pause(); api.next(); };
const cur = { choose: null, j: -1 };
const pips = (api, j) => `<ol class="pips" aria-label="Round ${j + 1} of ${SIT.length}">${SIT.map((x, n) => `<li class="${api.state[`a${n}`] === x.best || n < j ? 'is-won' : n === j ? 'is-now' : ''}">${svgI(ICON.star)}</li>`).join('')}</ol>`;

function situation(j) {
  const s = SIT[j];
  return {
    dur: AT + PHONE + 2.5,
    kicker: '',
    title: s.title,
    ready: api => api.state[`a${j}`] === s.best,
    tour: (t, api) => api.pick(`a${j}`, s.best, t, AT),
    controls(el, api) {
      el.innerHTML = `<div class="game">${pips(api, j)}
<div class="sitcard deal" data-focus aria-label="${s.title}"><svg class="sitcard__art" viewBox="0 0 120 70" aria-hidden="true">${ART[s.art]}</svg><p>${s.title}</p><span class="stamp" aria-hidden="true">${svgI(ICON.star)}+1</span></div>
<div class="hand" role="group" aria-label="Play a card (keys 1 to 6)">${TOOLS.map((o, n) => `<button type="button" class="tile${o.soft ? ' tile--soft' : ''}" data-tool="${o.id}" aria-keyshortcuts="${n + 1}" style="--r:${(n - 2.5) * 4}deg;--y:${Math.abs(n - 2.5) * 4}px">${svgI(ICON[o.id])}<span>${o.label}</span></button>`).join('')}</div>
<div class="reveal" hidden>${phone(s.best, `On Abstracts: ${TOOLS.find(o => o.id === s.best).label}`)}<button type="button" class="btn btn--primary btn--next" data-next aria-label="${j === SIT.length - 1 ? 'See all the tools' : 'Next situation'}">${svgI(ICON.next)}</button></div>
</div>`;
      const panel = el.closest('.panel'), game = el.querySelector('.game');
      el.querySelectorAll('.tile').forEach(b => (b.onclick = () => choose(b.dataset.tool)));
      el.querySelector('[data-next]').onclick = () => next(api);
      function choose(tool) {
        if (api.state[`a${j}`] === s.best) return;
        if (tool === s.best) { api.input(`a${j}`, tool); setTimeout(() => el.querySelector('[data-next]')?.focus({ preventScroll: true }), api.reduced ? 0 : (PHONE + 0.4) * 1000); return; }
        api.input(`m${j}`, [...(api.state[`m${j}`] || []), tool]);
        const b = el.querySelector(`.tile[data-tool="${tool}"]`);
        if (!api.reduced) { b.classList.remove('wobble'); void b.offsetWidth; b.classList.add('wobble'); }
      }
      cur.choose = choose; cur.j = j;
      focusCard(el);
      return () => {
        const done = api.state[`a${j}`] === s.best, missed = api.state[`m${j}`] || [];
        game.classList.toggle('is-done', done);
        el.querySelectorAll('.tile').forEach(b => {
          const id = b.dataset.tool;
          b.classList.toggle('is-played', done && id === s.best);
          b.classList.toggle('is-wrong', !done && missed.includes(id));
          b.classList.toggle('is-hint', !done && missed.length >= 2 && id === s.best);
          b.disabled = done;
        });
        el.querySelector('.reveal').hidden = !done;
        el.querySelector('.pips').outerHTML = pips(api, j);
      };
    },
  };
}

const steps = [
  {
    dur: 1.4, kicker: '', title: 'Moderating 101',
    controls(el, api) {
      el.innerHTML = `<div class="game">${pips(api, -1)}<div class="hand hand--deck" aria-hidden="true">${TOOLS.map((o, n) => `<span class="tile${o.soft ? ' tile--soft' : ''}" style="--r:${(n - 2.5) * 4}deg;--y:${Math.abs(n - 2.5) * 4}px">${svgI(ICON[o.id])}<span>${o.label}</span></span>`).join('')}</div>
<button type="button" class="btn btn--primary btn--big" data-start data-focus>${svgI(ICON.next)}Play</button></div>`;
      el.querySelector('[data-start]').onclick = () => next(api);
      cur.j = -1; focusCard(el);
    },
  },
  ...SIT.map((_, j) => situation(j)),
  {
    dur: 6, kicker: '', title: 'Where they live on Abstracts',
    controls(el, api) {
      el.innerHTML = `<div class="gallery">${[['hide', 'Hide post'], ['lock', 'Lock post'], ['pin', 'Pin'], ['invite', 'Invite'], ['rename', 'Rename'], ['switches', 'Delist community, Pause writes, Turn off anonymous posts']].map(([k, l]) => phone(k, `On Abstracts: ${l}`)).join('')}</div>
<div class="cta"><a class="btn btn--primary btn--big" href="https://abstracts.co/communities/new" target="_blank" rel="noopener">Create a community</a><button type="button" class="btn btn--big" data-again>Play again</button></div>`;
      el.querySelector('[data-again]').onclick = () => { wantFocus = true; api.restart(); };
      cur.j = -1; focusCard(el);
    },
  },
];

const api = createMotion({
  root: document.getElementById('stage'),
  title: 'Moderating 101',
  mode: 'interactive',
  fonts: ['600 40px Fraunces', 'italic 600 30px Fraunces', '500 20px "IBM Plex Mono"', '700 20px "IBM Plex Mono"'],
  initial: () => ({}),
  steps, setup, update,
});

// Show the tour's first caption the moment Watch it is pressed, without waiting for the next rendered frame.
const capNow = () => queueMicrotask(() => { if (api.playing) captions(api.index, api.t, api); });
api.root.addEventListener('click', capNow);
addEventListener('keydown', e => { if (e.key === ' ') capNow(); });
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const n = '123456'.indexOf(e.key);
  if (n < 0 || cur.j < 0 || api.index !== cur.j + 1 || !cur.choose) return;
  e.preventDefault();
  cur.choose(TOOLS[n].id);
});
