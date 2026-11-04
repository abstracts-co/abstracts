// cast.js: the shared paper cast for Abstracts explainer artifacts (people, robot, cards, pins, gear, labels).
// Colors match the About book. Copy per artifact; use only what you need.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = { paper: '#f7f1e4', card: '#fffdf8', ink: '#1f2436', coral: '#ef6b4e', sun: '#f4b63f', teal: '#2a9d8f', sky: '#6fb0e6', plum: '#7d5ba6', pink: '#f2a1b4', green: '#3ea66f', kraft: '#d9c19a' };
export const SERIF = '"Fraunces", Georgia, serif';
export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const darker = (hex, k = 0.78) => new THREE.Color(hex).multiplyScalar(k);

/* ---------- paper ---------- */
let grain;
function grainTexture() {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) { const v = 118 + rnd() * 20 + (rnd() < 0.02 ? 30 : 0); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  grain = new THREE.CanvasTexture(c); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(3, 3);
  return grain;
}
/** Matte paper with a faint fibre bump. */
export const paper = (color = C.card, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, bumpMap: grainTexture(), bumpScale: 0.35, ...extra });
export const shiny = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, ...extra });

export function shadowed(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

/** Soft blob shadow on the ground (sits under figures; the shadow map does the sharp part). */
let blobTex;
export function blob(w = 0.3, d = 0.3, opacity = 0.28) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(42,33,22,1)'); r.addColorStop(1, 'rgba(42,33,22,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.renderOrder = -1;
  return m;
}

/* ---------- canvas textures (text in Fraunces / Plex Mono) ---------- */
/** A canvas texture you can repaint: tex.paint(ctx => ...) then it uploads. */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.paint = fn => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); fn(g, w, h); t.needsUpdate = true; return t; };
  if (draw) t.paint(draw);
  return t;
}
export function fitText(g, text, weight, size, family, max) {
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > max) g.font = `${weight} ${Math.floor(size * max / w)}px ${family}`;
}
export const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

/* ---------- cast ---------- */
/** A person: colored head with ink eyes on a rounded body (the About's people, in 3D). ~0.36 tall. */
export function person(color = C.coral) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.1, 6, 20), paper(darker(color)));
  body.position.y = 0.135; body.scale.set(1, 1, 0.82);
  const head = new THREE.Group(); head.position.y = 0.3;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 20), paper(color));
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 12, 8), shiny(C.ink)); e.position.set(s * 0.03, 0.006, 0.078); e.scale.set(1, 1.4, 0.6); eyes.add(e); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16, Math.PI * 0.7), shiny(C.ink)); smile.position.set(0, -0.022, 0.08); smile.rotation.z = Math.PI * 1.15;
  head.add(skull, eyes, smile);
  g.add(shadowed(body), shadowed(head), blob(0.26, 0.2));
  g.userData = { head, eyes, body, kind: 'person' };
  return g;
}

/** A small robot: the About's plum robot (an AI assistant), in 3D. ~0.42 tall. */
export function robot(color = C.plum) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.14, 0.12, 4, 0.04), paper(darker(color)));
  body.position.y = 0.09;
  const belly = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.04, 0.01, 2, 0.005), paper('#cdbfe0')); belly.position.set(0, 0.1, 0.06);
  const head = new THREE.Group(); head.position.y = 0.25;
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.17, 0.15, 5, 0.05), paper(color));
  const face = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.11, 0.02, 3, 0.03), shiny(C.ink)); face.position.z = 0.068;
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.014, 4, 10), new THREE.MeshBasicMaterial({ color: C.sky })); e.position.set(s * 0.033, 0.002, 0.08); eyes.add(e); }
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.06, 0.05, 2, 0.01), shiny(C.ink)); ear.position.x = s * 0.118; head.add(ear); }
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), shiny(C.ink)); stalk.position.y = 0.11;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10), new THREE.MeshStandardMaterial({ color: C.sun, emissive: C.sun, emissiveIntensity: 0.5 })); bulb.position.y = 0.145;
  head.add(box, face, eyes, stalk, bulb);
  g.add(shadowed(body), belly, shadowed(head), blob(0.28, 0.2));
  g.userData = { head, eyes, body, bulb, kind: 'robot' };
  return g;
}

/** Blink and breathe at clock time `c` (seconds); `seed` desyncs figures. Deterministic. */
export function idle(fig, c, seed = 0) {
  const { head, eyes, body, bulb } = fig.userData;
  const ph = c * 1.7 + seed * 2.3;
  body.scale.y = 1 + Math.sin(ph) * 0.02;
  head.position.y = (fig.userData.kind === 'robot' ? 0.25 : 0.3) + Math.sin(ph) * 0.004;
  const bl = Math.abs(c + seed * 1.37) % 3.6; eyes.scale.y = bl < 0.12 ? Math.max(0.1, Math.abs(bl - 0.06) / 0.06) : 1;
  if (bulb) bulb.material.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(c * 5 + seed));
}

/** A paper card (post, sign, tile) with a canvas face on top (+y). Size in units, `px` per unit for the texture. */
export function card(w, d, { color = C.card, face = null, px = 512, thick = 0.008 } = {}) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(w, thick, d, 2, Math.min(0.004, thick / 2)), paper(color));
  g.add(shadowed(slab));
  if (face) {
    const tex = canvasTexture(Math.round(w * px), Math.round(d * px), face);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, d * 0.98), paper('#ffffff', { map: tex, bumpScale: 0.15 }));
    top.rotation.x = -Math.PI / 2; top.position.y = thick / 2 + 0.0008; top.receiveShadow = true;
    g.add(top); g.userData.tex = tex; g.userData.top = top;
  }
  g.userData.slab = slab;
  return g;
}

/** A post card face: avatar dot plus text lines. */
export const postFace = (avatar = C.coral, lines = [0.9, 0.7, 0.5], bot = false) => (g, w, h) => {
  g.fillStyle = C.card; g.fillRect(0, 0, w, h);
  const r = h * 0.14; g.fillStyle = avatar;
  if (bot) rr(g, w * 0.08, h * 0.12, r * 2, r * 2, r * 0.5); else { g.beginPath(); g.arc(w * 0.08 + r, h * 0.12 + r, r, 0, Math.PI * 2); }
  g.fill();
  g.fillStyle = 'rgba(31,36,54,.55)'; rr(g, w * 0.08 + r * 2.6, h * 0.17, w * 0.32, h * 0.08, h * 0.04); g.fill();
  g.fillStyle = 'rgba(31,36,54,.2)';
  lines.forEach((f, i) => { rr(g, w * 0.08, h * (0.5 + i * 0.15), w * 0.84 * f, h * 0.075, h * 0.04); g.fill(); });
};

/** A push pin: colored head, steel needle. Tip at y = 0. */
export function pin(color = C.coral) {
  const g = new THREE.Group();
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.07, 10), new THREE.MeshStandardMaterial({ color: '#b9bcc4', metalness: 0.9, roughness: 0.3 }));
  needle.rotation.x = Math.PI; needle.position.y = 0.035;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 20), shiny(color)); neck.position.y = 0.09;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 28), shiny(color)); cap.position.y = 0.125;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), shiny(color)); top.scale.y = 0.4; top.position.y = 0.135;
  g.add(shadowed(needle), shadowed(neck), shadowed(cap), shadowed(top));
  return g;
}

/** A gear (settings). Lies in the XY plane, spin with .rotation.z. */
export function gear(color = C.ink, r = 0.12, teeth = 9) {
  const s = new THREE.Shape();
  const ro = r, ri = r * 0.78;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, st = (Math.PI * 2) / teeth;
    const pts = [[ri, a], [ro, a + st * 0.12], [ro, a + st * 0.45], [ri, a + st * 0.57]];
    pts.forEach(([rad, an], k) => { const x = Math.cos(an) * rad, y = Math.sin(an) * rad; if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: r * 0.28, bevelEnabled: true, bevelThickness: r * 0.05, bevelSize: r * 0.04, bevelSegments: 3, curveSegments: 6 });
  geo.center();
  return shadowed(new THREE.Mesh(geo, shiny(color, { roughness: 0.55 })));
}

/** Hinge helper: a pivot group at an edge; put the panel in pivot.userData.panel. */
export function hinge(child, offset) { const p = new THREE.Group(); child.position.copy(offset); p.add(child); return p; }
