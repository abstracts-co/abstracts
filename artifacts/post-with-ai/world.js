// world.js: the 3D Wall for "Post With AI". Everything here is a pure function of
// (state, time), so the guided tour can be rendered at any second for the video export.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, SERIF, MONO, paper, shiny, shadowed, canvasTexture, card, person, robot, idle, rr, fitText } from './cast.js';
import { drawAvatar, PICTURES } from './art.js';

export const TRAVEL = 2.4;            // seconds from "Yes" to the card settling on the Wall
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  out: t => 1 - (1 - t) ** 3,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const AVATAR = [C.coral, C.sun, C.teal, C.sky, C.plum, C.pink, C.green];

/* ---------- layout (world units; the Wall is 2.2 tall) ---------- */
const WALL = { x0: -1.45, x1: 2.05, h: 2.2 };
const CW = 0.84, CH = 0.6;                       // card size
const COL = [-0.8, 0.3, 1.4], ROW = [1.42, 0.72];
const SLOT = v3(COL[2], ROW[0], 0.05);          // "You"
const SOCKET = v3(COL[1], 0.24, 0.0);
const RULES_AT = v3(COL[1], ROW[1] + 0.02, 0.05), RULES_READ = v3(-0.62, 1.05, 0.95);
const DRAFT = v3(-0.3, 1.12, 1.2);
const PREVIEW = v3(2.15, 1.22, 1.72), PREVIEW_ROT = 0.45;
const DOOR = { pos: v3(2.42, 0, 0.82), rot: 0.62, w: 0.62, h: 0.74 };
const ROBOT = { pos: v3(-2.15, 0, 0.95), rot: 0.95, s: 2.5 };
const PERSON = { pos: v3(3.08, 0, 1.45), rot: -0.8, s: 2.6 };
const DOOR_FRONT = v3(2.72, 0.46, 1.24), DOOR_BACK = v3(2.02, 0.46, 0.38);

const SHOTS = {
  overview: { c: v3(0.45, 1.0, 0.6), w: 6.0, h: 2.55 },
  connect: { c: v3(-0.9, 0.75, 0.7), w: 3.9, h: 2.0 },
  draft: { c: v3(-0.6, 1.05, 1.05), w: 2.8, h: 1.5 },
  rules: { c: v3(-0.95, 0.95, 0.85), w: 3.3, h: 1.75 },
  preview: { c: v3(2.3, 1.05, 1.35), w: 2.6, h: 1.6 },
  travel: { c: v3(1.95, 0.95, 0.85), w: 3.4, h: 2.1 },
  wall: { c: v3(1.25, 1.18, 0.35), w: 3.1, h: 2.05 },
};
const DIR = v3(0.1, 0.27, 1).normalize();

const EXAMPLES = [
  { name: 'mira', when: '3h', text: "Pickle's birthday look.", pic: 'pickle', col: 0, row: 0 },
  { name: 'jun', when: '5h', text: 'Beanie season for Pepper.', pic: 'pepper', col: 1, row: 0 },
  { name: 'sam', when: '1d', text: 'Luna is ready for her party.', pic: 'luna', col: 0, row: 1 },
];

/* ---------- card faces ---------- */
function wrap(g, text, max) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (g.measureText(t).width > max && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function marker(g, x, y, w, h, k) {
  if (k <= 0) return;
  g.fillStyle = 'rgba(244,182,63,.55)'; rr(g, x - 6, y, (w + 12) * k, h, 8); g.fill();
}

function paintFace(g, w, h, f) {
  const M = 52;
  g.fillStyle = C.card; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(31,36,54,.10)'; g.lineWidth = 4; rr(g, 2, 2, w - 4, h - 4, 18); g.stroke();
  // header: avatar and name, or an empty name slot while it is a draft
  const hy = 74;
  {
    drawAvatar(g, M + 28, hy - 12, 30, f.name, AVATAR[hash(f.name) % AVATAR.length]);
    g.fillStyle = C.ink; fitText(g, f.name, 600, 36, MONO, w * 0.3); g.fillText(f.name, M + 72, hy);
    const nw = g.measureText(f.name).width;
    g.fillStyle = 'rgba(31,36,54,.55)'; g.font = `500 30px ${MONO}`; g.fillText(`· ${f.when}`, M + 86 + nw, hy);
  }
  // the line the community's rules ask for, marked as it is added
  if (f.footer && f.footerK > 0) {
    g.font = `600 34px ${MONO}`;
    const tw = g.measureText(f.footer).width, fx = w - M - tw;
    marker(g, fx, hy - 34, tw, 48, f.footerHl);
    g.globalAlpha = f.footerK; g.fillStyle = C.ink; g.fillText(f.footer, fx, hy); g.globalAlpha = 1;
  }
  let y = hy + 40;
  if (f.kind === 'reply') {
    g.fillStyle = '#f1ebdd'; rr(g, M, y, w - M * 2, 58, 12); g.fill();
    g.fillStyle = 'rgba(31,36,54,.62)'; g.font = `500 22px ${MONO}`;
    g.fillText('Reply to mira: "Pickle\'s birthday look"', M + 18, y + 37);
    y += 76;
  }
  // body text arrives character by character; lines not yet written show as faint bars
  const pic = f.pic;
  const big = pic ? 46 : f.kind === 'poll' ? 70 : f.text.length > 90 ? 56 : 66, lh = big * 1.2;
  g.font = `500 ${big}px ${SERIF}`;
  const lines = wrap(g, f.text, w - M * 2);
  const maxLines = pic ? 1 : f.kind === 'poll' ? 1 : f.kind === 'reply' ? 3 : 5;
  let left = f.shown;
  lines.slice(0, maxLines).forEach((line, i) => {
    const by = y + (pic ? 26 : 40) + i * lh;
    const n = clamp(left, 0, line.length); left -= line.length + 1;
    g.fillStyle = '#ece4d3'; if (n < line.length) { rr(g, M, by - big * 0.72, g.measureText(line).width, big * 0.62, 10); g.fill(); }
    if (n > 0) { g.fillStyle = C.ink; g.fillText(line.slice(0, n), M, by); }
  });
  y += (pic ? 26 : 40) + Math.min(lines.length, maxLines) * lh;
  if (pic) PICTURES[pic](g, M, y - 18, w - M * 2, h - y - 24, 16, f.hat ? { hat: f.hat, hatK: f.hatK } : undefined);
  if (f.kind === 'poll') {
    const votes = f.votes;
    const pct = [Math.round(58 * votes), Math.round(42 * votes)];
    f.options.forEach((o, i) => {
      const by = y - 10 + i * 112;
      g.fillStyle = '#f1ebdd'; rr(g, M, by, w - M * 2, 92, 16); g.fill();
      if (votes > 0) { g.fillStyle = i === 0 ? '#bfe3dc' : '#f8dca4'; rr(g, M, by, Math.max(32, (w - M * 2) * pct[i] / 100), 92, 16); g.fill(); }
      g.fillStyle = C.ink; g.font = `600 42px ${MONO}`; g.fillText(o, M + 26, by + 61);
      g.textAlign = 'right'; g.fillText(`${pct[i]}%`, w - M - 26, by + 61); g.textAlign = 'left';
    });
    g.fillStyle = 'rgba(31,36,54,.6)'; g.font = `500 30px ${MONO}`;
    g.fillText(votes > 0 ? `${Math.round(12 * votes)} votes · closes in 24 hours` : 'Poll · closes in 24 hours', M, h - 34);
  }
}

/* the community's own card: "How a/hatcats works" */
export const RULES = ['Every cat wears a silly hat', 'Say if an AI helped', 'Be kind'];
function paintRules(g, w, h, hl) {
  g.fillStyle = '#fbf0d2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(31,36,54,.12)'; g.lineWidth = 4; rr(g, 2, 2, w - 4, h - 4, 18); g.stroke();
  g.fillStyle = C.ink; fitText(g, 'How a/hatcats works', 600, 54, SERIF, w - 100); g.fillText('How a/hatcats works', 50, 100);
  g.fillStyle = 'rgba(31,36,54,.15)'; g.fillRect(50, 132, w - 100, 3);
  RULES.forEach((r, i) => {
    const by = 222 + i * 100;
    g.font = `500 52px ${SERIF}`;
    marker(g, 100, by - 44, g.measureText(r).width, 60, hl[i] || 0);
    g.fillStyle = C.teal; g.beginPath(); g.arc(68, by - 12, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.ink; g.fillText(r, 100, by);
  });
}

/* ---------- world ---------- */
export function createWorld(canvas, { reduced = false, capture = false } = {}) {
  const D = d => (reduced ? 1e-4 : d);
  const prog = (now, at, d) => (at == null ? 0 : clamp((now - at) / D(d)));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const key = new THREE.DirectionalLight(0xfff3e2, 2.0);
  key.position.set(-2.2, 6, 4.6);
  key.target.position.set(0.4, 0.6, 0.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4.2, right: 4.2, top: 3.6, bottom: -3.6, near: 1, far: 16 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 6;
  scene.add(key, key.target, new THREE.HemisphereLight(0xfff8ee, 0xb9ad98, 0.7));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  /* the Wall: a standing paper board with its header and the empty "You" slot printed on it */
  const ww = WALL.x1 - WALL.x0, PXU = 400;
  const wall = new THREE.Mesh(new RoundedBoxGeometry(ww + 0.08, WALL.h + 0.06, 0.08, 3, 0.03), paper('#e9dfcc'));
  wall.position.set((WALL.x0 + WALL.x1) / 2, WALL.h / 2, -0.04);
  shadowed(wall); scene.add(wall);
  const toPx = (x, y) => [(x - WALL.x0) * PXU, (WALL.h - y) * PXU];
  const wallTex = canvasTexture(ww * PXU, WALL.h * PXU, (g, w, h) => {
    g.fillStyle = '#f2ead9'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.ink; g.font = `600 64px ${SERIF}`; g.fillText('a/hatcats', 56, 112);
    // made-up community: marked as an example
    const nw = g.measureText('a/hatcats').width;
    g.strokeStyle = 'rgba(31,36,54,.45)'; g.lineWidth = 3; rr(g, 80 + nw, 70, 170, 52, 26); g.stroke();
    g.fillStyle = 'rgba(31,36,54,.7)'; g.font = `600 28px ${MONO}`; g.fillText('Example', 100 + nw, 106);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(31,36,54,.12)'; g.fillRect(56, 150, w - 112, 3);
    // "You" column
    let [x, y] = toPx(SLOT.x, ROW[0] + CH / 2 + 0.14);
    g.fillStyle = C.ink; g.font = `600 40px ${MONO}`; g.textAlign = 'center'; g.fillText('You', x, y);
    for (const r of ROW) {
      [x, y] = toPx(SLOT.x - CW / 2, r + CH / 2);
      g.setLineDash([18, 14]); g.strokeStyle = 'rgba(31,36,54,.32)'; g.lineWidth = 5; rr(g, x, y, CW * PXU, CH * PXU, 20); g.stroke(); g.setLineDash([]);
    }
    g.textAlign = 'left';
  });
  wallTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const wallFace = new THREE.Mesh(new THREE.PlaneGeometry(ww, WALL.h), paper('#ffffff', { map: wallTex, bumpScale: 0.2 }));
  wallFace.position.set((WALL.x0 + WALL.x1) / 2, WALL.h / 2, 0.001);
  wallFace.receiveShadow = true;
  scene.add(wallFace);

  /* socket, with a light that comes on when the AI is connected */
  const socket = new THREE.Group();
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.26, 0.035, 3, 0.012), paper(C.card));
  socket.add(plate);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16), shiny(C.ink)); h.rotation.x = Math.PI / 2; h.position.set(s * 0.05, 0, 0.018); socket.add(h); }
  const ledMat = new THREE.MeshStandardMaterial({ color: '#b9c9c3', emissive: C.teal, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 10), ledMat); led.position.set(0.13, 0.085, 0.02);
  socket.add(led);
  socket.position.set(SOCKET.x, SOCKET.y, 0.018);
  scene.add(shadowed(socket));

  /* the community's rules card, pinned on the Wall; the AI takes it down to read before drafting */
  const RW = 0.8, RH = 0.58;
  const rulesCard = card(RW, RH, { px: 1100, thick: 0.014, face: () => {} });
  rulesCard.rotation.x = Math.PI / 2;
  const rules = new THREE.Group(); rules.add(rulesCard); scene.add(rules);
  const rulesPin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), shiny(C.coral)); rulesPin.position.set(RW / 2 - 0.07, RH / 2 - 0.06, 0.02); rules.add(rulesPin);
  let rulesKey = '';
  function rulesAt(S, now) {
    const r = (S.reads || []).filter(x => x.at <= now).pop();
    const out = prog(now, r?.at, 0.8), back = prog(now, r ? r.at + 3.4 : null, 0.8);
    const k = ease.inOut(out) * (1 - ease.inOut(back));
    const hl = RULES.map((_, i) => (r && r.lines.includes(i) ? ease.out(prog(now, r.at + 1.0 + r.lines.indexOf(i) * 0.7, 0.6)) * (1 - back) : 0));
    return { k, hl };
  }

  /* cable from the robot to the socket */
  const cablePath = new THREE.CatmullRomCurve3([v3(-1.88, 0.42, 1.02), v3(-1.7, 0.04, 1.2), v3(-1.0, 0.025, 1.25), v3(-0.25, 0.025, 0.8), v3(0.15, 0.04, 0.35), v3(0.28, 0.08, 0.14), v3(SOCKET.x, SOCKET.y - 0.02, 0.07)]);
  const SEGS = 160, RAD = 8;
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cablePath, SEGS, 0.016, RAD, false), shiny(C.ink, { roughness: 0.6 }));
  cable.castShadow = true; scene.add(cable);
  const plug = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.1, 2, 0.015), shiny(C.ink, { roughness: 0.5 }));
  plug.castShadow = true; scene.add(plug);

  /* door: "your GitHub account" */
  const door = new THREE.Group();
  const doorMat = paper(C.teal);
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new RoundedBoxGeometry(0.07, DOOR.h, 0.08, 2, 0.02), doorMat); post.position.set(s * (DOOR.w / 2 + 0.035), DOOR.h / 2, 0); door.add(post); }
  const lintel = new THREE.Mesh(new RoundedBoxGeometry(DOOR.w + 0.2, 0.08, 0.1, 2, 0.02), doorMat); lintel.position.y = DOOR.h + 0.04; door.add(lintel);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), paper('#ffffff', {
    map: canvasTexture(720, 160, (g, w, h) => { g.fillStyle = C.card; rr(g, 0, 0, w, h, 26); g.fill(); g.fillStyle = C.ink; fitText(g, 'your GitHub account', 600, 50, MONO, w - 60); g.textAlign = 'center'; g.fillText('your GitHub account', w / 2, h / 2 + 17); }),
    transparent: true, bumpScale: 0.1,
  }));
  sign.position.set(0, DOOR.h + 0.2, 0.03); door.add(sign);
  door.position.copy(DOOR.pos); door.rotation.y = DOOR.rot;
  scene.add(shadowed(door));

  /* cast */
  const bot = robot(); bot.scale.setScalar(ROBOT.s); bot.position.copy(ROBOT.pos); bot.rotation.y = ROBOT.rot;
  const me = person(C.coral); me.scale.setScalar(PERSON.s); me.position.copy(PERSON.pos); me.rotation.y = PERSON.rot;
  scene.add(bot, me);

  /* posted-path dots */
  const travelPath = new THREE.CatmullRomCurve3([PREVIEW.clone(), v3(2.8, 0.85, 1.6), DOOR_FRONT, DOOR_BACK, v3(1.72, 1.0, 0.3), SLOT.clone()]);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#8d8573' });
  const dots = [];
  for (let i = 0; i < 34; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dotMat); d.userData.u = (i + 1) / 35; d.position.copy(travelPath.getPointAt(d.userData.u)); scene.add(d); dots.push(d); }

  /* preview frame */
  const frame = new THREE.Group();
  const fm = paper(C.teal);
  const FW = CW + 0.14, FH = CH + 0.14;
  for (const [w, h, x, y] of [[FW, 0.035, 0, FH / 2], [FW, 0.035, 0, -FH / 2], [0.035, FH, FW / 2, 0], [0.035, FH, -FW / 2, 0]]) { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.03, 2, 0.01), fm); b.position.set(x, y, -0.01); frame.add(b); }
  const ftag = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.13), new THREE.MeshBasicMaterial({
    map: canvasTexture(780, 130, (g, w, h) => { g.fillStyle = C.teal; rr(g, 0, 0, w, h, 24); g.fill(); g.fillStyle = '#fff'; fitText(g, 'Posting to a/hatcats', 600, 48, MONO, w - 50); g.textAlign = 'center'; g.fillText('Posting to a/hatcats', w / 2, h / 2 + 16); }),
    transparent: true,
  }));
  ftag.position.set(0, FH / 2 + 0.1, 0); frame.add(ftag);
  scene.add(shadowed(frame));

  /* confetti and poll tokens */
  const CONF = 46;
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.04, 0.055), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), CONF);
  const pal = [C.coral, C.sun, C.teal, C.sky, C.plum, C.pink, C.green];
  const seedR = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < CONF; i++) confetti.setColorAt(i, new THREE.Color(pal[i % pal.length]));
  confetti.frustumCulled = false; scene.add(confetti);
  const TOK = 8;
  const tokens = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20), shiny(C.sun), TOK);
  tokens.castShadow = true; tokens.frustumCulled = false; scene.add(tokens);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S0 = new THREE.Vector3(), P0 = new THREE.Vector3();

  /* cards */
  const pool = new Map();
  function cardObj(id) {
    let o = pool.get(id);
    if (o) return o;
    const c = card(CW, CH, { px: 1100, thick: 0.014, face: () => {} });
    c.rotation.x = Math.PI / 2;
    const g = new THREE.Group(); g.add(c); scene.add(g);
    o = { g, tex: c.userData.tex, key: '' };
    pool.set(id, o);
    return o;
  }
  function paint(o, f) {
    const k = `${f.name}|${f.when}|${f.kind}|${f.shown}|${f.text}|${f.votes.toFixed(3)}|${f.pic}|${f.footer}|${(f.footerK || 0).toFixed(2)}|${(f.footerHl || 0).toFixed(2)}|${f.hat}|${(f.hatK || 0).toFixed(3)}`;
    if (k === o.key) return;
    o.key = k;
    o.tex.paint((g, w, h) => paintFace(g, w, h, f));
  }
  EXAMPLES.forEach((e, i) => {
    const o = cardObj(`ex${i}`);
    o.g.position.set(COL[e.col], ROW[e.row], 0.05);
    paint(o, { kind: 'text', text: e.text, shown: 999, name: e.name, when: e.when, votes: 0, pic: e.pic });
  });

  function textAt(c, now) {
    let cur = c.texts[0];
    for (const t of c.texts) if (t.at <= now) cur = t;
    return cur;
  }

  function cardPose(c, cards, now) {
    const pos = DRAFT.clone(); let rotY = 0, rotX = 0, s = 1;
    const form = prog(now, c.createdAt, 0.7);
    s = ease.back(form);
    pos.y += (1 - ease.out(form)) * 0.25;
    const rev = textAt(c, now);
    if (rev !== c.texts[0]) { const k = prog(now, rev.at, 0.5); rotY += Math.sin(k * Math.PI) * 0.5; }
    const pv = ease.inOut(prog(now, c.previewAt, 1.0));
    pos.lerp(PREVIEW, pv); rotY += PREVIEW_ROT * pv; rotX = -0.08 * pv;
    if (c.postedAt != null && now >= c.postedAt) {
      const u = ease.inOut(prog(now, c.postedAt, TRAVEL));
      pos.copy(travelPath.getPointAt(u));
      rotX = -0.08 * (1 - clamp(u * 3));
      // face the door on the way through, then square up to the Wall
      rotY = u < 0.45 ? lerp(PREVIEW_ROT, DOOR.rot, clamp(u / 0.3)) : lerp(DOOR.rot, 0, clamp((u - 0.5) / 0.35));
      s = u < 0.5 ? lerp(1, 0.56, clamp(u / 0.3)) : lerp(0.56, 1, clamp((u - 0.6) / 0.35));
      // newer posts push this one down the "You" column
      let down = 0;
      for (const n of cards) if (n !== c && n.postedAt != null && n.postedAt > c.postedAt) down += ease.inOut(prog(now, n.postedAt + TRAVEL - 0.7, 0.8));
      if (down > 0) {
        pos.y -= down * (ROW[0] - ROW[1]);
        if (down > 1) s *= 1 - clamp(down - 1);
      }
    }
    return { pos, rotY, rotX, s };
  }

  /* camera */
  let W = 1, H = 1; const fr = { x: 0, y: 0, w: 1, h: 1 };
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function shotsAt(S, now) {
    const ev = [[-1e9, 'overview']];
    const mine = S.cards.filter(c => c.createdAt <= now);
    const c = mine[mine.length - 1];
    if (S.connectedAt != null) { ev.push([S.connectedAt - 0.3, 'connect'], [S.connectedAt + 2.6, 'overview']); }
    const rd = (S.reads || []).filter(r => r.at <= now).pop();
    if (rd && (!c || rd.at > c.createdAt)) ev.push([rd.at - 0.2, 'rules']);
    if (c) {
      ev.push([c.createdAt - 0.4, 'draft']);
      if (c.previewAt != null) ev.push([c.previewAt, 'preview']);
      if (c.postedAt != null) ev.push([c.postedAt + 0.2, 'travel'], [c.postedAt + TRAVEL - 0.6, 'wall'], [c.postedAt + TRAVEL + (c.kind === 'poll' ? 4.2 : 2.6), 'overview']);
    }
    const past = ev.filter(e => e[0] <= now).sort((a, b) => a[0] - b[0]);
    const b = past[past.length - 1], a = past[past.length - 2] || b;
    const k = ease.inOut(prog(now, b[0], 1.4));
    const A = SHOTS[a[1]], B = SHOTS[b[1]];
    return { c: A.c.clone().lerp(B.c, k), w: lerp(A.w, B.w, k), h: lerp(A.h, B.h, k) };
  }
  function place(shot, now) {
    if (fr.w < 520) shot = shot.w < 5 ? { c: shot.c, w: shot.w * 0.78, h: shot.h * 0.78 } : { c: shot.c, w: shot.w * 1.08, h: shot.h };
    const fh = fr.h / H, fw = fr.w / H;
    const d = Math.max((shot.h / 2) / (tanV * fh), (shot.w / 2) / (tanV * fw));
    const dir = DIR.clone();
    if (!reduced) dir.x += Math.sin(now * 0.23) * 0.035;
    camera.position.copy(shot.c).addScaledVector(dir.normalize(), d);
    camera.lookAt(shot.c);
    const cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
  }

  function layout(w, h, rect) {
    W = Math.max(1, w); H = Math.max(1, h); Object.assign(fr, rect);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
  }

  function lean(S, now) {
    let k = 0;
    for (const [a, b] of S.typing) k = Math.max(k, Math.min(prog(now, a, 0.3), 1 - prog(now, b, 0.4)));
    return ease.inOut(clamp(k));
  }

  function render(S, now) {
    // cast
    idle(bot, now, 1); idle(me, now, 0);
    const ln = lean(S, now);
    bot.rotation.x = 0; bot.userData.head.rotation.x = 0.35 * ln; bot.userData.body.rotation.x = 0.12 * ln;
    bot.position.z = ROBOT.pos.z + 0.08 * ln;
    if (!reduced) bot.userData.head.rotation.z = Math.sin(now * 1.1) * 0.06;
    // cable and socket
    const cp = ease.inOut(prog(now, S.connectedAt, 1.6));
    cable.geometry.setDrawRange(0, Math.floor(cp * SEGS) * RAD * 6);
    cable.visible = cp > 0.001; plug.visible = cable.visible;
    const tip = cablePath.getPointAt(Math.max(0.002, cp));
    const tan = cablePath.getTangentAt(Math.max(0.002, cp));
    plug.position.copy(tip); plug.quaternion.setFromUnitVectors(v3(0, 0, 1), tan.clone().negate());
    const lit = prog(now, S.connectedAt != null ? S.connectedAt + 1.6 : null, 0.4);
    ledMat.emissiveIntensity = lit * (1.6 + (reduced ? 0 : 0.4 * Math.sin(now * 4)));
    ledMat.color.set(lit > 0.5 ? '#9fe0d4' : '#b9c9c3');

    // rules card: out to the robot and back
    const rs = rulesAt(S, now);
    rules.position.copy(RULES_AT).lerp(RULES_READ, rs.k);
    rules.position.y += Math.sin(rs.k * Math.PI) * 0.12;
    rules.rotation.set(-0.06 * rs.k, -0.32 * rs.k, 0);
    rules.scale.setScalar(1 + 0.25 * rs.k);
    const key = rs.hl.map(x => x.toFixed(2)).join();
    if (key !== rulesKey) { rulesKey = key; rulesCard.userData.tex.paint((g, w, h) => paintRules(g, w, h, rs.hl)); }
    bot.userData.head.rotation.y = 0.5 * rs.k;

    // cards
    const seen = new Set(EXAMPLES.map((_, i) => `ex${i}`));
    let preview = null, traveling = null, arrived = null;
    for (const c of S.cards) {
      const o = cardObj(c.id); seen.add(c.id);
      if (now < c.createdAt) { o.g.visible = false; continue; }
      const p = cardPose(c, S.cards, now);
      o.g.visible = p.s > 0.002;
      o.g.position.copy(p.pos); o.g.rotation.set(p.rotX, p.rotY, 0); o.g.scale.setScalar(Math.max(0.001, p.s));
      const rev = textAt(c, now);
      const shown = reduced || !c.cps ? rev.text.length : Math.floor(Math.max(0, now - rev.at) * c.cps);
      const arrive = c.postedAt != null ? c.postedAt + TRAVEL : null;
      const votes = c.kind === 'poll' && arrive != null ? ease.out(prog(now, arrive + 0.3, 3.2)) : 0;
      const fk = c.footerAt != null ? prog(now, c.footerAt, 0.3) : 0;
      paint(o, { kind: c.kind, text: rev.text, shown, options: c.options, pic: c.pic, name: 'you', when: c.postedAt != null && now >= c.postedAt ? 'just now' : 'draft', hat: c.hat, hatK: c.hatAt != null ? clamp((now - c.hatAt) / D(0.7)) : 0, votes, footer: c.footer, footerK: fk, footerHl: c.footerAt != null ? ease.out(prog(now, c.footerAt + 0.2, 0.6)) : 0 });
      if (c.previewAt != null && now >= c.previewAt && (c.postedAt == null || now < c.postedAt + 0.35)) preview = { c, p };
      if (c.postedAt != null && now >= c.postedAt && now < arrive + 0.8) traveling = c;
      if (arrive != null && now >= arrive) arrived = c;
    }
    for (const [id, o] of pool) if (!seen.has(id)) { o.g.visible = false; }

    // preview frame
    if (preview) {
      const { c, p } = preview;
      const k = ease.out(prog(now, c.previewAt + 0.5, 0.5)) * (1 - prog(now, c.postedAt, 0.3));
      frame.visible = k > 0.002;
      frame.position.copy(p.pos); frame.rotation.set(p.rotX, p.rotY, 0); frame.scale.setScalar(Math.max(0.001, k));
    } else frame.visible = false;

    // dotted path ahead of the traveling card
    for (const d of dots) {
      if (!traveling) { d.visible = false; continue; }
      const u = ease.inOut(prog(now, traveling.postedAt, TRAVEL));
      const show = prog(now, traveling.postedAt - 0.1, 0.4) * (1 - prog(now, traveling.postedAt + TRAVEL, 0.6));
      d.visible = d.userData.u > u && show > 0.05;
      d.scale.setScalar(Math.max(0.001, show));
    }

    // confetti on arrival (not with reduced motion), tokens for polls
    let cf = null;
    if (!reduced && arrived) { const t = now - (arrived.postedAt + TRAVEL); if (t >= 0 && t < 2.8) cf = t; }
    confetti.visible = cf != null;
    if (cf != null) {
      for (let i = 0; i < CONF; i++) {
        const a = seedR(i, 1) * Math.PI * 2, sp = 0.6 + seedR(i, 2) * 1.0;
        P0.set(SLOT.x + Math.cos(a) * 0.12, SLOT.y + 0.3, 0.25);
        P0.x += Math.cos(a) * sp * 0.55 * cf; P0.z += 0.25 * cf * seedR(i, 5);
        P0.y += (1.6 * seedR(i, 3) + 0.4) * cf - 1.3 * cf * cf;
        E.set(cf * (3 + 6 * seedR(i, 4)), cf * 4 * seedR(i, 6), cf * 5 * seedR(i, 7)); Q.setFromEuler(E);
        S0.setScalar(Math.max(0.001, 1 - clamp((cf - 2.1) / 0.7)));
        confetti.setMatrixAt(i, M4.compose(P0, Q, S0));
      }
      confetti.instanceMatrix.needsUpdate = true;
    }
    const pollCard = [...S.cards].reverse().find(c => c.kind === 'poll' && c.postedAt != null && now >= c.postedAt + TRAVEL);
    tokens.visible = false;
    if (pollCard) {
      const t0 = pollCard.postedAt + TRAVEL + 0.2, o = cardObj(pollCard.id);
      let any = false;
      for (let i = 0; i < TOK; i++) {
        const t = now - (t0 + i * 0.36);
        const k = clamp(t / D(0.55));
        const vis = t >= 0 && t < 1.1;
        any ||= vis;
        P0.set(o.g.position.x - 0.25 + (i % 4) * 0.17, o.g.position.y - 0.02 + (i % 2) * 0.12 + (1 - ease.out(k) ** 2) * 0.9, o.g.position.z + 0.06);
        E.set(Math.PI / 2, 0, 0); Q.setFromEuler(E);
        S0.setScalar(vis ? Math.max(0.001, 1 - clamp((t - 0.6) / 0.5)) : 0.001);
        tokens.setMatrixAt(i, M4.compose(P0, Q, S0));
      }
      tokens.visible = any; tokens.instanceMatrix.needsUpdate = true;
    }

    place(shotsAt(S, now), now);
    renderer.render(scene, camera);
  }

  return { layout, render, renderer };
}
