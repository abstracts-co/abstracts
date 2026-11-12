// scene.js: the island as a 3D world in three.js: rolling ground, grass that moves in the wind, sun and shadows.
// It can lie flat and be seen from straight above, which is how it takes over from the 2D forms and hands back to them.
import * as THREE from '../lib/three.module.min.js';
import { NOISE } from '../lib/glsl.js';
import { hash2, clamp, lerp, el } from '../lib/util.js';
import { W, H, tile, PLACES, P } from '../lib/town.js';
import { GROUND, LAMPS, RES, coast, heightAt, cover } from '../lib/land.js';

const FOV = 34, TAN = Math.tan((FOV / 2) * Math.PI / 180);
export const TOP = Math.PI / 2;     // the camera looking straight down, as the 2D forms do
export const TILT = 0.74;           // the camera's angle below the horizon once the world has depth
const SEA = { x0: -6, size: 32 };   // the square of sea the shore map covers, in tiles
const SUN = new THREE.Vector3(-0.5, 0.78, 0.38).normalize();
const SHADOW = 2048;                // the shadow map's width in texels

/* ---------- shaders ---------- */
const VERT = `attribute vec3 tint; attribute float glow; attribute float wind; attribute vec2 soil;
uniform float uT; uniform mat4 uSunView;
varying vec3 vW; varying vec3 vC; varying vec3 vN; varying float vGlow; varying float vWind; varying vec2 vSoil; varying vec4 vS;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.xz += wind * vec2(sin(uT * 1.7 + wp.x * 1.3 + wp.z * 0.7), cos(uT * 1.3 + wp.x * 0.8 - wp.z * 1.1)) * 0.06;
  vW = wp.xyz; vC = tint; vGlow = glow; vWind = wind; vSoil = soil; vN = mat3(modelMatrix) * normal; vS = uSunView * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHARED = `uniform float uT; uniform vec3 uOrb;`;
/* What the ground is made of, worked out for every pixel: grass, the worn path, tall grass and the beach. */
const SOIL = `
vec3 soilColor() {
  float broad = noise3(vec3(vW.xz * 0.55, 3.0)), fine = noise3(vec3(vW.xz * 4.2, 7.0)), grain = hash31(vec3(floor(vW.xz * 40.0), 1.0));
  float path = smoothstep(0.40, 0.60, vSoil.x + (fine - 0.5) * 0.3);
  float tall = smoothstep(0.35, 0.65, vSoil.y + (fine - 0.5) * 0.2);
  vec3 grass = mix(vec3(0.39, 0.70, 0.33), vec3(0.55, 0.81, 0.41), broad) * (0.93 + 0.14 * fine);
  grass = mix(grass, vec3(0.24, 0.57, 0.27), tall);
  vec3 dirt = mix(vec3(0.93, 0.85, 0.66), vec3(0.85, 0.75, 0.54), fine) * (0.95 + 0.1 * grain);
  vec3 col = mix(grass, dirt, path);
  float beach = smoothstep(0.25, 0.12, vW.y + (fine - 0.5) * 0.06);
  vec3 sand = mix(vec3(0.95, 0.88, 0.69), vec3(0.74, 0.66, 0.48), smoothstep(0.07, -0.03, vW.y)) * (0.96 + 0.08 * grain);
  return mix(col, sand, beach);
}`;
const frag = ground => `precision highp float;
uniform vec3 uSun; uniform vec3 uCam; uniform sampler2D uShadow; uniform float uShade;
varying vec3 vW; varying vec3 vC; varying vec3 vN; varying float vGlow; varying float vWind; varying vec2 vSoil; varying vec4 vS;
${SHARED} ${NOISE} ${ground ? SOIL : ''}
/* 1 in the sun, 0 in shadow: the shadow map, softened over nine taps. */
float sunlit(float facing) {
  if (uShade < 0.01) return 1.0;
  vec3 c = vS.xyz / vS.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float bias = 0.0016 + 0.0045 * (1.0 - facing), sum = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) sum += step(c.z - bias, texture2D(uShadow, c.xy + vec2(float(i), float(j)) / ${SHADOW.toFixed(1)}).r);
  return mix(1.0, sum / 9.0, uShade);
}
void main() {
  vec3 v = normalize(uCam - vW);
  bool rounded = dot(vN, vN) > 0.25;          // shapes without their own normals are flat-faced: work the face out here
  vec3 n = rounded ? normalize(vN) : normalize(cross(dFdx(vW), dFdy(vW)));
  if (!rounded && dot(n, v) < 0.0) n = -n;
  vec3 base = ${ground ? 'soilColor()' : 'vC'};

  float facing = clamp(dot(n, uSun), 0.0, 1.0);
  float open = sunlit(facing);
  float cloud = smoothstep(0.52, 0.78, fbm3(vec3(vW.xz * 0.11 + vec2(uT * 0.035, uT * 0.012), 1.0))) * uShade;
  vec3 sun = vec3(1.0, 0.95, 0.84) * facing * open * (1.0 - 0.3 * cloud);
  vec3 sky = vec3(0.56, 0.66, 0.82) * (0.36 + 0.18 * n.y);
  vec3 day = base * (sun * 0.82 + sky + 0.06) + base * (vGlow * 0.1 + vWind * 0.1 * open);

  vec3 od = vW - uOrb;
  vec3 col = day + base * vec3(1.0, 0.56, 0.16) * 0.45 / (1.0 + dot(od, od) * 1.1);
  gl_FragColor = vec4(col, 1.0);
}`;
const SEA_VERT = `varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const SEA_FRAG = `precision highp float; uniform sampler2D uShore; varying vec3 vW;
${SHARED} ${NOISE}
void main() {
  vec2 uv = (vW.xz - ${SEA.x0.toFixed(1)}) / ${SEA.size.toFixed(1)};
  float s = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uShore, uv).r;   // 1 at the shore, 0 out at sea
  float swell = fbm3(vec3(vW.xz * 0.22, uT * 0.08));
  float surf = smoothstep(0.8, 1.0, sin(s * 15.0 - uT * 1.3)) * smoothstep(0.12, 0.45, s);

  vec3 day = mix(vec3(0.20, 0.53, 0.78), vec3(0.33, 0.68, 0.89), smoothstep(0.35, 0.7, swell));
  day = mix(day, vec3(0.50, 0.85, 0.90), smoothstep(0.3, 1.0, s));
  day = mix(day, vec3(0.94, 0.98, 1.0), max(surf * 0.8, smoothstep(0.93, 1.0, s) * 0.7));
  day += smoothstep(0.80, 0.84, noise3(vec3(vW.xz * 1.6 + vec2(uT * 0.3, 0.0), uT * 0.4))) * 0.1;

  vec3 od = vW - uOrb;
  vec3 col = day + vec3(1.0, 0.5, 0.12) * 0.1 / (1.0 + dot(od, od) * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- building blocks ---------- */
const colors = new Map();
const rgb = hex => { if (!colors.has(hex)) colors.set(hex, [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255]); return colors.get(hex); };
const balls = new Map();
const unitBall = detail => { if (!balls.has(detail)) balls.set(detail, new THREE.IcosahedronGeometry(1, detail).attributes.position.array); return balls.get(detail); };
const FLAT = [0, 0, 0];             // no normal of its own: the shader works out the face, which gives crisp edges
function builder() {
  const pos = [], col = [], lit = [], nor = [], wnd = [];
  const put = (p, c, shade, glow, n, wind) => { pos.push(p[0], p[1], p[2]); col.push(c[0] * shade, c[1] * shade, c[2] * shade); lit.push(glow); nor.push(n[0], n[1], n[2]); wnd.push(wind); };
  const b = {
    put,
    tri(p, q, r, color, shade = 1, glow = 0) { const c = rgb(color); put(p, c, shade, glow, FLAT, 0); put(q, c, shade, glow, FLAT, 0); put(r, c, shade, glow, FLAT, 0); },
    quad(p, q, r, s, color, shade = 1, glow = 0) { b.tri(p, q, r, color, shade, glow); b.tri(p, r, s, color, shade, glow); },
    box(x0, y0, z0, x1, y1, z1, color, glow = 0) {
      b.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], color, 1, glow);
      b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, 1, glow);
      b.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], color, 1, glow);
      b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, 1, glow);
      b.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], color, 1, glow);
    },
    /** An upright panel facing south at depth z. */
    face(x0, y0, x1, y1, z, color, glow = 0) { b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, 1, glow); },
    /** A round post, wider or narrower at the top, with a cap. */
    tube(cx, y0, y1, cz, r0, r1, sides, color, glow = 0) {
      const c = rgb(color), ring = i => { const a = (i / sides) * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; };
      for (let i = 0; i < sides; i++) {
        const [ax, az] = ring(i), [cx2, cz2] = ring(i + 1);
        const p = [cx + ax * r0, y0, cz + az * r0], q = [cx + cx2 * r0, y0, cz + cz2 * r0], r = [cx + cx2 * r1, y1, cz + cz2 * r1], s = [cx + ax * r1, y1, cz + az * r1];
        const n1 = [ax, 0, az], n2 = [cx2, 0, cz2];
        put(p, c, 1, glow, n1, 0); put(q, c, 1, glow, n2, 0); put(r, c, 1, glow, n2, 0); put(p, c, 1, glow, n1, 0); put(r, c, 1, glow, n2, 0); put(s, c, 1, glow, n1, 0);
        put([cx, y1, cz], c, 1, glow, [0, 1, 0], 0); put(s, c, 1, glow, [0, 1, 0], 0); put(r, c, 1, glow, [0, 1, 0], 0);
      }
    },
    /**
     * A smooth ball. `paint(up, chance)` gives the colour at each point: up is -1..1 from bottom to top, chance is 0..1.
     * detail: how finely it is divided. rough: how lumpy. power: 2 is round, 4 is a cube with soft corners. wind: sway at the top.
     */
    ball(cx, cy, cz, rx, ry, rz, paint, { detail = 2, rough = 0, seed = 0, wind = 0, glow = 0, power = 2 } = {}) {
      const unit = unitBall(detail);
      for (let i = 0; i < unit.length; i += 3) {
        let x = unit[i], y = unit[i + 1], z = unit[i + 2];
        if (power !== 2) { const k = Math.pow(Math.abs(x) ** power + Math.abs(y) ** power + Math.abs(z) ** power, -1 / power); x *= k; y *= k; z *= k; }
        const chance = hash2(Math.round(unit[i] * 61) + seed * 13, Math.round(unit[i + 1] * 61) * 7 + Math.round(unit[i + 2] * 61) * 3);
        const j = 1 + (chance - 0.5) * rough, e = power - 1;
        const n = [Math.sign(x) * Math.abs(x) ** e / rx, Math.sign(y) * Math.abs(y) ** e / ry, Math.sign(z) * Math.abs(z) ** e / rz], len = Math.hypot(n[0], n[1], n[2]) || 1;
        put([cx + x * rx * j, cy + y * ry * j, cz + z * rz * j], rgb(paint(unit[i + 1], chance)), 1, glow, [n[0] / len, n[1] / len, n[2] / len], wind * Math.max(0, unit[i + 1] * 0.5 + 0.5));
      }
    },
    mesh(material) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('tint', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('glow', new THREE.Float32BufferAttribute(lit, 1));
      geo.setAttribute('wind', new THREE.Float32BufferAttribute(wnd, 1));
      const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false;
      return mesh;
    },
  };
  return b;
}

/** The land: one smooth sheet, 4 squares to a tile, coloured by the shader from how much path and tall grass is near. */
function buildGround(material) {
  const N = (W + 4) * RES, side = N + 1, pos = new Float32Array(side * side * 3), soil = new Float32Array(side * side * 2), index = [];
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const x = i / RES - 2, z = j / RES - 2, at = j * side + i;
    pos.set([x, heightAt(x, z), z], at * 3);
    soil.set([cover('=', x, z), cover(':', x, z)], at * 2);
    if (i < N && j < N) index.push(at, at + side, at + 1, at + 1, at + side, at + side + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('soil', new THREE.BufferAttribute(soil, 2));
  geo.setIndex(index); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false;
  return mesh;
}
/** Grass, blade by blade: short everywhere off the path, long and thick in the tall grass. Heights start at 0 on the ground. */
function buildGrass(b) {
  const UP = [0, 1, 0];
  const blade = (x, z, tall, k) => {
    const top = tall ? 0.3 + hash2(k, 5) * 0.24 : 0.07 + hash2(k, 5) * 0.09, wide = tall ? 0.03 : 0.022;
    const turn = hash2(k, 9) * Math.PI, ax = Math.cos(turn) * wide, az = Math.sin(turn) * wide, lean = (hash2(k, 13) - 0.5) * top * 0.7, lx = Math.sin(turn) * lean, lz = -Math.cos(turn) * lean;
    const y = heightAt(x, z) - GROUND, sway = tall ? 1.5 : 0.7;
    const root = rgb(tall ? '#2c7a3a' : '#57a544'), tip = rgb(tall ? (k % 3 ? '#8ada6c' : '#b4e58a') : (k % 4 ? '#9ddc74' : '#c3ec92'));
    const mid = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2];
    const a = [x - ax, y, z - az], c = [x + ax, y, z + az], d = [x - ax * 0.6 + lx * 0.4, y + top * 0.55, z - az * 0.6 + lz * 0.4], e = [x + ax * 0.6 + lx * 0.4, y + top * 0.55, z + az * 0.6 + lz * 0.4], f = [x + lx, y + top, z + lz];
    for (const [p, col, w] of [[a, root, 0], [c, root, 0], [e, mid, 0.5], [a, root, 0], [e, mid, 0.5], [d, mid, 0.5], [d, mid, 0.5], [e, mid, 0.5], [f, tip, 1]]) b.put(p, col, 1, 0, UP, w * sway);
  };
  let k = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tile(x, y);
    if (!'.f:TSN'.includes(t)) continue;
    for (let i = 0, n = t === ':' ? 70 : 26; i < n; i++) {
      const bx = x + hash2(x * 31 + i, y * 17 + 3), bz = y + hash2(x * 13 + 5, y * 29 + i);
      k++;
      if (cover('=', bx, bz) < 0.32 && coast(bx, bz) < -0.02) blade(bx, bz, t === ':', k);
    }
  }
}
const leaf = (up, chance) => (up > 0.35 ? (chance > 0.6 ? P.leaf3 : P.leaf2) : up > -0.2 ? (chance > 0.5 ? P.leaf2 : P.leaf1) : chance > 0.5 ? P.leaf1 : P.leafD);
function growTree(b, cx, cz, seed) {
  const tall = 0.9 + hash2(seed, 4) * 0.25;
  b.tube(cx, -0.08, 0.14, cz, 0.18, 0.11, 9, P.trunkD); b.tube(cx, 0.14, 0.82 * tall, cz, 0.11, 0.065, 9, P.trunk);
  for (const [dx, dy, dz, r] of [[0, 1.08, 0, 0.5], [-0.27, 0.84, 0.2, 0.31], [0.28, 0.88, -0.12, 0.31], [0.06, 1.42, 0.04, 0.3], [0.1, 0.8, 0.3, 0.24]])
    b.ball(cx + dx, dy * tall, cz + dz, r, r * 0.9, r, leaf, { detail: 2, rough: 0.16, seed: seed + Math.round(dx * 9), wind: 0.55 });
}
/** Everything that stands on the land. Heights here start at 0 on the ground, so the whole lot can lie flat and rise. */
function buildProps(b) {
  for (const t of PLACES.trees) { const seed = t.x * 7 + t.y * 3; growTree(b, t.x + 0.5 + (hash2(seed, 1) - 0.5) * 0.12, t.y + 0.5 + (hash2(seed, 2) - 0.5) * 0.12, seed); }
  const bush = (x, z, r, seed) => {
    b.ball(x, r * 0.62, z, r, r * 0.74, r, leaf, { rough: 0.2, seed, wind: 0.25 });
    for (let i = 0; i < 4; i++) b.ball(x + (hash2(seed, i) - 0.5) * r * 1.5, r * (0.9 + hash2(i, seed) * 0.5), z + (hash2(seed + 3, i) - 0.2) * r, 0.035, 0.035, 0.035, () => [P.white, P.pink, P.sunL][(seed + i) % 3], { detail: 1, glow: 0.7 });
  };
  for (const h of [PLACES.skills, PLACES.hall]) { bush(h.x + 0.2, h.y + 1.93, 0.2, h.x); bush(h.x + 2.8, h.y + 1.93, 0.2, h.x + 5); bush(h.x + 0.95, h.y + 1.95, 0.13, h.x + 9); }
  bush(PLACES.wall.x + 0.12, PLACES.wall.y + 0.72, 0.15, 41); bush(PLACES.wall.x + 2.88, PLACES.wall.y + 0.72, 0.15, 43);
  for (const f of PLACES.flowers) for (let i = 0; i < 5; i++) {
    const x = f.x + 0.14 + hash2(f.x * 3 + i, f.y) * 0.72, z = f.y + 0.14 + hash2(f.x, f.y * 5 + i) * 0.72, top = 0.16 + hash2(i, f.x + f.y) * 0.1;
    b.tube(x, 0, top, z, 0.008, 0.008, 4, P.g3);
    b.ball(x, top + 0.02, z, 0.045, 0.03, 0.045, () => [P.white, P.pink, P.sunL][(f.x + i) % 3], { detail: 1, glow: 0.8 });
    b.ball(x, top + 0.035, z, 0.018, 0.018, 0.018, () => P.sun, { detail: 0, glow: 0.8 });
  }
  // stones along the beach
  for (let i = 0, made = 0; i < 500 && made < 16; i++) {
    const x = hash2(i, 71) * (W + 2) - 1, z = hash2(i, 73) * (H + 2) - 1, s = coast(x, z);
    if (s < 0.12 || s > 0.42) continue;
    const r = 0.07 + hash2(i, 79) * 0.12; made++;
    b.ball(x, heightAt(x, z) - GROUND + r * 0.25, z, r, r * 0.62, r * (0.8 + hash2(i, 5) * 0.4), (up, chance) => (chance > 0.5 ? '#a39b8f' : '#8d867c'), { detail: 1, rough: 0.3, seed: i });
  }
  const house = (h, roof, roofD, roofL) => {
    const x0 = h.x + 0.22, x1 = h.x + 2.78, z0 = h.y + 0.5, z1 = h.y + 1.78, door = h.x + 1.5;
    b.box(x0 - 0.06, -0.08, z0 - 0.06, x1 + 0.06, 0.1, z1 + 0.06, '#b9ad9d');
    b.box(x0, 0.1, z0, x1, 1.0, z1, P.wallL);
    for (const cx of [x0 - 0.02, x1 - 0.05]) for (const cz of [z0 - 0.02, z1 - 0.05]) b.box(cx, 0.1, cz, cx + 0.07, 1.0, cz + 0.07, P.wallD);
    b.box(x0 - 0.02, 0.9, z1, x1 + 0.02, 0.99, z1 + 0.03, P.wallD);
    // roof: rows of shingles up the front, one dark slope behind, a ridge and white eaves
    const ex0 = h.x + 0.02, ex1 = h.x + 2.98, ez0 = h.y + 0.28, ez1 = h.y + 2.0, zm = (ez0 + ez1) / 2, y0 = 0.94, y1 = 1.74, rows = 5;
    for (let i = 0; i < rows; i++) {
      const a = i / rows, c = (i + 1) / rows, lift = 0.022;
      b.quad([ex0, lerp(y0, y1, a) + lift, lerp(ez1, zm, a)], [ex1, lerp(y0, y1, a) + lift, lerp(ez1, zm, a)], [ex1, lerp(y0, y1, c), lerp(ez1, zm, c)], [ex0, lerp(y0, y1, c), lerp(ez1, zm, c)], i % 2 ? roof : roofL);
      b.quad([ex0, lerp(y0, y1, a), lerp(ez1, zm, a)], [ex1, lerp(y0, y1, a), lerp(ez1, zm, a)], [ex1, lerp(y0, y1, a) + lift, lerp(ez1, zm, a)], [ex0, lerp(y0, y1, a) + lift, lerp(ez1, zm, a)], roofD);
    }
    b.quad([ex1, y0, ez0], [ex0, y0, ez0], [ex0, y1, zm], [ex1, y1, zm], roofD);
    b.box(ex0 - 0.02, y1 - 0.03, zm - 0.06, ex1 + 0.02, y1 + 0.05, zm + 0.06, roofD);
    b.box(ex0, y0 - 0.06, ez1 - 0.02, ex1, y0 + 0.01, ez1 + 0.03, P.white);
    for (const gx of [x0, x1]) b.tri([gx, 0.98, z0], [gx, 0.98, z1], [gx, y1 - 0.06, zm], P.wallL);
    // door, with a step, a frame and a sign over it
    b.box(door - 0.36, -0.06, z1, door + 0.36, 0.08, z1 + 0.24, '#cfc5b4');
    b.box(door - 0.3, 0.1, z1, door + 0.3, 0.84, z1 + 0.03, P.wallD);
    b.face(door - 0.24, 0.1, door + 0.24, 0.78, z1 + 0.035, P.door);
    b.face(door - 0.24, 0.1, door - 0.2, 0.78, z1 + 0.04, P.doorD); b.box(door + 0.13, 0.4, z1 + 0.035, door + 0.17, 0.45, z1 + 0.06, P.sun, 0.6);
    b.box(door - 0.2, 0.88, z1 + 0.02, door + 0.2, 1.06, z1 + 0.05, P.white, 0.4);
    b.face(door - 0.12, 0.92, door - 0.02, 1.02, z1 + 0.055, roof, 0.5); b.face(door + 0.02, 0.92, door + 0.12, 1.02, z1 + 0.055, P.sun, 0.5);
    // two windows with frames, panes, sills and flower boxes
    for (const wx of [h.x + 0.4, h.x + 2.14]) {
      b.box(wx - 0.05, 0.36, z1, wx + 0.51, 0.88, z1 + 0.03, P.white);
      b.face(wx, 0.4, wx + 0.46, 0.84, z1 + 0.035, P.glass, 1);
      b.box(wx + 0.215, 0.4, z1 + 0.03, wx + 0.245, 0.84, z1 + 0.045, P.white); b.box(wx, 0.605, z1 + 0.03, wx + 0.46, 0.635, z1 + 0.045, P.white);
      b.box(wx - 0.08, 0.32, z1, wx + 0.54, 0.36, z1 + 0.1, P.wallD);
      b.box(wx - 0.03, 0.2, z1 + 0.02, wx + 0.49, 0.31, z1 + 0.15, P.woodD);
      for (let i = 0; i < 4; i++) b.ball(wx + 0.05 + i * 0.12, 0.34, z1 + 0.09, 0.05, 0.05, 0.05, () => [P.pink, P.white, P.coral, P.sunL][i], { detail: 1, glow: 0.5 });
    }
    b.box(h.x + 2.12, 1.2, h.y + 0.72, h.x + 2.4, 1.92, h.y + 1.0, P.wallD); b.box(h.x + 2.08, 1.92, h.y + 0.68, h.x + 2.44, 1.98, h.y + 1.04, '#8f8577');
  };
  house(PLACES.skills, P.coral, P.coralD, P.coralL);
  house(PLACES.hall, P.plum, P.plumD, P.plumL);

  // the Wall: a cork board under a little roof, with everyone's posts pinned to it
  const wl = PLACES.wall, wz = wl.y + 0.5;
  b.tube(wl.x + 0.34, -0.06, 1.72, wz + 0.05, 0.05, 0.045, 8, P.woodD); b.tube(wl.x + 2.66, -0.06, 1.72, wz + 0.05, 0.05, 0.045, 8, P.woodD);
  b.box(wl.x + 0.08, 0.42, wz - 0.02, wl.x + 2.92, 1.62, wz + 0.1, P.wood);
  b.face(wl.x + 0.17, 0.51, wl.x + 2.83, 1.53, wz + 0.105, P.cork);
  b.quad([wl.x - 0.02, 1.62, wz + 0.3], [wl.x + 3.02, 1.62, wz + 0.3], [wl.x + 3.02, 1.86, wz + 0.04], [wl.x - 0.02, 1.86, wz + 0.04], P.coral);
  b.quad([wl.x + 3.02, 1.62, wz - 0.22], [wl.x - 0.02, 1.62, wz - 0.22], [wl.x - 0.02, 1.86, wz + 0.04], [wl.x + 3.02, 1.86, wz + 0.04], P.coralD);
  for (const [cx, cy, cw, ch, color] of [[0.3, 1.05, 0.5, 0.38, P.coral], [0.3, 0.6, 0.5, 0.34, P.teal], [0.95, 0.6, 0.42, 0.3, P.pink], [1.5, 0.6, 0.42, 0.3, P.sunL], [2.2, 1.05, 0.5, 0.36, P.plum], [2.2, 0.6, 0.5, 0.36, P.sky], [0.98, 1.0, 1.0, 0.44, P.amber]]) {
    b.box(wl.x + cx, cy, wz + 0.105, wl.x + cx + cw, cy + ch, wz + 0.12, P.white, 0.7);
    b.face(wl.x + cx, cy + ch - 0.09, wl.x + cx + cw, cy + ch, wz + 0.125, color, 0.9);
    b.face(wl.x + cx + 0.05, cy + 0.06, wl.x + cx + cw - 0.08, cy + 0.09, wz + 0.125, P.corkD, 0.3); b.face(wl.x + cx + 0.05, cy + 0.13, wl.x + cx + cw - 0.14, cy + 0.16, wz + 0.125, P.corkD, 0.3);
  }
  const sg = PLACES.sign;
  b.tube(sg.x + 0.5, -0.06, 0.6, sg.y + 0.5, 0.045, 0.04, 8, P.woodD);
  b.box(sg.x + 0.1, 0.44, sg.y + 0.42, sg.x + 0.9, 0.9, sg.y + 0.52, P.woodL); b.box(sg.x + 0.08, 0.88, sg.y + 0.4, sg.x + 0.92, 0.93, sg.y + 0.54, P.wood);
  b.face(sg.x + 0.2, 0.72, sg.x + 0.8, 0.78, sg.y + 0.525, P.woodD); b.face(sg.x + 0.2, 0.58, sg.x + 0.62, 0.64, sg.y + 0.525, P.woodD);
  // street lamps
  for (const [x, z] of LAMPS) {
    b.tube(x, -0.06, 0.08, z, 0.07, 0.05, 8, '#3a3f52'); b.tube(x, 0.08, 1.0, z, 0.028, 0.022, 8, '#3a3f52');
    b.box(x - 0.09, 1.0, z - 0.09, x + 0.09, 1.03, z + 0.09, '#3a3f52'); b.box(x - 0.065, 1.03, z - 0.065, x + 0.065, 1.2, z + 0.065, P.sunL, 1);
    b.quad([x - 0.11, 1.2, z - 0.11], [x + 0.11, 1.2, z - 0.11], [x + 0.11, 1.2, z + 0.11], [x - 0.11, 1.2, z + 0.11], '#3a3f52'); b.ball(x, 1.25, z, 0.07, 0.07, 0.07, () => '#3a3f52', { detail: 1 });
  }
  // the dock, plank by plank, and a boat tied up beside it
  const k = PLACES.dock;
  for (let i = 0; i < 6; i++) b.box(k.x + 0.1, -0.08, k.y - 0.12 + i * 0.185, k.x + 0.9, -0.02, k.y + 0.045 + i * 0.185, i % 2 ? P.wood : P.woodL);
  for (const [px, pz] of [[0.08, 0.15], [0.84, 0.15], [0.08, 0.88], [0.84, 0.88]]) b.tube(k.x + px + 0.04, -0.7, 0.08, k.y + pz, 0.05, 0.05, 8, P.woodD);
  b.ball(k.x + 1.62, -0.27, k.y + 0.55, 0.5, 0.12, 0.2, up => (up > 0.55 ? P.woodD : P.wood), { detail: 2, power: 3 });
  b.box(k.x + 1.5, -0.2, k.y + 0.4, k.x + 1.62, -0.17, k.y + 0.7, P.woodL); b.box(k.x + 1.82, -0.2, k.y + 0.42, k.x + 1.92, -0.17, k.y + 0.68, P.woodL);
}

/* ---------- what others build on it ---------- */
/** Things members and their agents add while you are here: [seconds in, who, is it their AI, what, x, z, words]. */
const BUILDS = [
  [1.6, 'maya', false, 'tree', 11.5, 2.6, 'planted a tree'],
  [3.2, 'sam', true, 'bench', 5.5, 4.5, 'built a bench'],
  [4.8, 'kenji', false, 'lighthouse', 18.4, 7.5, 'raised a lighthouse'],
  [6.4, 'lina', true, 'flowers', 6.5, 10.5, 'planted a flower bed'],
  [8.0, 'omar', false, 'boat', 0.4, 11.6, 'launched a boat'],
  [9.6, 'zoe', true, 'windmill', 4.5, 12.6, 'built a windmill'],
];
const FACES = { maya: '#f472b6', sam: '#fb923c', kenji: '#38bdf8', lina: '#a78bfa', omar: '#34d399', zoe: '#facc15', you: '#ef6b4e' };
const MAKE = {
  tree: (b, seed) => growTree(b, 0, 0, seed),
  bench(b) { b.box(-0.32, 0.16, -0.1, 0.32, 0.2, 0.1, P.woodL); b.box(-0.32, 0.2, 0.06, 0.32, 0.4, 0.1, P.wood); for (const x of [-0.27, 0.23]) b.box(x, 0, -0.08, x + 0.04, 0.16, 0.08, P.woodD); },
  lighthouse(b) {
    b.tube(0, -0.06, 0.5, 0, 0.21, 0.18, 12, P.white); b.tube(0, 0.5, 0.95, 0, 0.18, 0.15, 12, P.coral); b.tube(0, 0.95, 1.35, 0, 0.15, 0.13, 12, P.white);
    b.tube(0, 1.35, 1.41, 0, 0.2, 0.2, 12, '#3a3f52'); b.tube(0, 1.41, 1.62, 0, 0.1, 0.1, 10, P.sunL, 1); b.tube(0, 1.62, 1.84, 0, 0.17, 0.01, 10, P.coralD);
  },
  flowers(b, seed) {
    for (let i = 0; i < 11; i++) {
      const a = hash2(seed, i) * 6.283, r = Math.sqrt(hash2(i, seed)) * 0.38, x = Math.cos(a) * r, z = Math.sin(a) * r, top = 0.14 + hash2(i, 3) * 0.1;
      b.tube(x, 0, top, z, 0.008, 0.008, 4, P.g3); b.ball(x, top + 0.02, z, 0.05, 0.035, 0.05, () => [P.white, P.pink, P.sunL, P.coral][i % 4], { detail: 1, glow: 0.8 });
    }
  },
  boat(b) {
    b.ball(0, 0.02, 0, 0.42, 0.11, 0.17, up => (up > 0.55 ? P.woodD : P.wood), { detail: 2, power: 3 });
    b.tube(0, 0.06, 0.82, 0, 0.018, 0.014, 6, P.woodD); b.tri([0.02, 0.2, 0], [0.02, 0.8, 0], [0.4, 0.22, 0], P.white); b.tri([-0.02, 0.26, 0], [-0.02, 0.7, 0], [-0.28, 0.27, 0], P.coralL);
  },
  windmill(b) {
    b.tube(0, -0.06, 1.05, 0, 0.24, 0.14, 12, P.wallL); b.tube(0, 1.05, 1.34, 0, 0.19, 0.01, 12, P.coral);
    b.box(-0.06, 0, 0.2, 0.06, 0.26, 0.24, P.door);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.5, c = Math.cos(a), sn = Math.sin(a), w = 0.07; b.quad([-sn * w, 0.95 + c * w, 0.2], [sn * w, 0.95 - c * w, 0.2], [c * 0.6 + sn * w, 0.95 + sn * 0.6 - c * w, 0.2], [c * 0.6 - sn * w, 0.95 + sn * 0.6 + c * w, 0.2], P.white); }
    b.ball(0, 0.95, 0.2, 0.05, 0.05, 0.04, () => P.woodD, { detail: 1 });
  },
};

/* ---------- the walkers: each is a few parts, so arms and feet can swing ---------- */
const SIZE = 1.3;                   // how much bigger the walkers are than the map says, so they read from far away
function part(material, build, at = [0, 0, 0]) {
  const b = builder(); build(b);
  const mesh = b.mesh(material);
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}
function person(material, c, d, l, pack) {
  const group = new THREE.Group();
  group.add(part(material, b => {
    b.ball(0, 0.3, 0, 0.19, 0.21, 0.16, () => d, { detail: 2 });
    b.ball(0, 0.31, -0.15, 0.13, 0.14, 0.08, up => (up > 0.5 ? pack[1] : pack[0]), { detail: 2, power: 4 });   // a backpack, so you can tell front from back
    b.ball(0, 0.66, 0, 0.25, 0.24, 0.24, up => (up > 0.55 ? l : c), { detail: 3 });
    for (const s of [-1, 1]) { b.ball(s * 0.085, 0.68, 0.215, 0.028, 0.038, 0.02, () => P.ink, { detail: 1 }); b.ball(s * 0.15, 0.61, 0.18, 0.04, 0.026, 0.02, () => l, { detail: 1 }); }
  }));
  const limbs = { arms: [], feet: [] };
  for (const s of [-1, 1]) {
    limbs.arms.push(part(material, b => b.ball(0, -0.11, 0, 0.05, 0.13, 0.05, () => d, { detail: 1 }), [s * 0.215, 0.42, 0]));
    limbs.feet.push(part(material, b => b.ball(0, 0, 0.02, 0.07, 0.05, 0.1, () => P.ink, { detail: 1 }), [s * 0.085, 0.05, 0]));
  }
  group.add(...limbs.arms, ...limbs.feet); group.scale.setScalar(SIZE);
  return { group, ...limbs, hover: 0 };
}
function robot(material) {
  const group = new THREE.Group(), soft = { detail: 3, power: 4 };
  group.add(part(material, b => {
    b.ball(0, 0.25, 0, 0.17, 0.15, 0.14, () => P.plumD, soft); b.ball(0, 0.26, 0.135, 0.04, 0.04, 0.015, () => P.plumL, { detail: 1, glow: 0.8 });
    b.ball(0, 0.57, 0, 0.28, 0.19, 0.21, up => (up > 0.6 ? P.plumL : P.plum), soft);
    b.ball(0, 0.57, 0.165, 0.21, 0.105, 0.06, () => P.ink, { detail: 2, power: 4 });
    for (const s of [-1, 1]) { b.ball(s * 0.085, 0.575, 0.222, 0.035, 0.042, 0.012, () => P.sky, { detail: 1, glow: 1 }); b.ball(s * 0.29, 0.57, 0, 0.03, 0.07, 0.07, () => P.plumD, { detail: 1 }); }
    b.tube(0, 0.74, 0.9, 0, 0.012, 0.012, 6, P.ink); b.ball(0, 0.93, 0, 0.05, 0.05, 0.05, () => P.sun, { detail: 1, glow: 1 });
  }));
  const limbs = { arms: [], feet: [] };
  for (const s of [-1, 1]) {
    limbs.arms.push(part(material, b => b.ball(0, -0.07, 0, 0.04, 0.09, 0.04, () => P.plumD, { detail: 1 }), [s * 0.21, 0.33, 0]));
    limbs.feet.push(part(material, b => b.ball(0, 0, 0.01, 0.07, 0.045, 0.09, () => P.ink, { detail: 1 }), [s * 0.08, 0.045, 0]));
  }
  group.add(...limbs.arms, ...limbs.feet); group.scale.setScalar(SIZE);
  return { group, ...limbs, hover: 1 };
}

/** How close each patch of sea is to the shore: 1 at the water's edge, 0 from 2.4 tiles out. */
function shoreMap() {
  const N = 160, data = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = SEA.x0 + ((i + 0.5) / N) * SEA.size, z = SEA.x0 + ((j + 0.5) / N) * SEA.size;
    data[j * N + i] = Math.round(clamp(1 - (coast(x, z) - 0.36) / 2.4) * 255);
  }
  const map = new THREE.DataTexture(data, N, N, THREE.RedFormat);
  map.minFilter = map.magFilter = THREE.LinearFilter; map.needsUpdate = true;
  return map;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, color] of [[0, 'rgba(255,236,170,1)'], [0.18, 'rgba(255,170,60,.85)'], [0.45, 'rgba(228,72,15,.3)'], [1, 'rgba(160,30,18,0)']]) r.addColorStop(at, color);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

const CSS = `
.sc { background: #58b3e6; overflow: hidden; touch-action: pan-y; cursor: grab; font-family: var(--sans); }
.sc:active { cursor: grabbing; }
.sc canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.sc-feed { position: absolute; left: 4cqw; top: 4cqw; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.sc-feed li { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; padding: 5px 12px 5px 5px; border-radius: 999px; font-weight: 600; font-size: 13px; color: #fff; background: rgb(22 17 14 / .7); border: 1px solid rgb(255 255 255 / .14); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); animation: sc-in .35s ease both; transition: opacity .5s ease; }
.sc-feed li.old { opacity: .55; }
.sc-feed b { font-weight: 800; }
.sc-feed i { position: relative; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex: none; font: 800 10.5px/1 var(--sans); font-style: normal; color: #1b1410; }
.sc-feed i[data-ai]::after { content: "AI"; position: absolute; right: -5px; bottom: -4px; padding: 1px 3px; border-radius: 5px; font: 800 7.5px/1.1 var(--sans); color: #fff; background: #5b3f80; }
@keyframes sc-in { from { opacity: 0; transform: translateY(-6px); } }
.sc-add { appearance: none; cursor: pointer; position: absolute; right: 12px; bottom: 62px; height: 40px; padding: 0 16px; border-radius: 999px; border: 0; font: 800 13.5px/1 var(--sans); color: #2b1105; background: linear-gradient(180deg, #ffb84d, #ff7a14 58%, #e4480f); box-shadow: inset 0 1px 0 rgb(255 255 255 / .45), 0 10px 22px -10px #e4480f; }
.sc-add:active { transform: scale(.96); }
.sc-add:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.sc [hidden] { display: none; }
@media (prefers-reduced-motion: reduce) { .sc-feed li { animation: none; } }
`;

function createScene(api = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const feed = el('ol', { class: 'sc-feed', 'aria-live': 'polite' });
  const plant = el('button', { class: 'sc-add', type: 'button', 'data-ui': true, hidden: true, onclick: () => { api.take?.(); addYours(); } }, 'Plant a tree here');
  const root = el('div', { class: 'sc' }, el('style', {}, CSS), renderer.domElement, feed, plant);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);

  /* the sun's own view of the island, for shadows */
  const CASTS = 1;                  // the layer of everything that throws a shadow
  const sunCam = new THREE.OrthographicCamera(-16, 16, 16, -16, 1, 90);
  sunCam.position.set(W / 2, 0, H / 2).addScaledVector(SUN, 45); sunCam.lookAt(W / 2, 0, H / 2); sunCam.updateMatrixWorld(); sunCam.layers.set(CASTS);
  const shadows = new THREE.WebGLRenderTarget(SHADOW, SHADOW);
  shadows.depthTexture = new THREE.DepthTexture(SHADOW, SHADOW);
  const depthOnly = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

  const U = {
    uT: { value: 0 }, uOrb: { value: new THREE.Vector3() },
    uSun: { value: SUN }, uCam: { value: new THREE.Vector3() }, uShore: { value: shoreMap() },
    uShadow: { value: shadows.depthTexture }, uShade: { value: 1 }, uSunView: { value: new THREE.Matrix4().multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse) },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag(false), uniforms: U, side: THREE.DoubleSide });
  const groundMaterial = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag(true), uniforms: U });
  const seaMaterial = new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: U });

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), seaMaterial);
  sea.position.set(W / 2, 0, H / 2); scene.add(sea);
  scene.add(buildGround(groundMaterial));
  const standing = new THREE.Group(); standing.position.y = GROUND; scene.add(standing);
  const grass = builder(); buildGrass(grass); standing.add(grass.mesh(material));
  const fixed = builder(); buildProps(fixed);
  const props = fixed.mesh(material); props.layers.enable(CASTS); standing.add(props);

  const actor = made => { made.group.traverse(node => node.layers.enable(CASTS)); standing.add(made.group); return { ...made, turn: 0 }; };
  const you = actor(person(material, P.coral, P.coralD, P.coralL, [P.teal, P.tealL]));
  const agent = actor(robot(material));
  const neighbour = actor(person(material, P.teal, P.tealD, P.tealL, [P.sun, P.sunL]));
  neighbour.group.position.set(PLACES.neighbour.x + 0.5, heightAt(PLACES.neighbour.x + 0.5, PLACES.neighbour.y + 0.5) - GROUND, PLACES.neighbour.y + 0.5);

  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffc04d }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(1.7); orb.add(halo); scene.add(orb);

  /* what gets added while you are here: each thing pops up where it was built, with a line saying who built it */
  let added = [], nextBuild = 0, yours = false, here = { x: 8, y: 9 }, clockNow = 0;
  /** `late`: how many seconds ago it should have gone up, when the view is catching up. */
  function raise(kind, x, z, seed, late = 0) {
    const b = builder(); MAKE[kind](b, seed);
    const mesh = b.mesh(material);
    mesh.position.set(x, kind === 'boat' ? -GROUND + 0.02 : heightAt(x, z) - GROUND, z); mesh.scale.setScalar(0.01); mesh.layers.enable(CASTS);
    standing.add(mesh); added.push({ mesh, born: clockNow - late });
  }
  function tell(name, agent, words, quiet = false) {
    const person = name === 'you' ? 'You' : `${name[0].toUpperCase()}${name.slice(1)}${agent ? '’s AI' : ''}`;
    feed.append(el('li', {}, el('i', { style: `background:${FACES[name]}`, 'data-ai': agent || null }, name === 'you' ? '' : name[0].toUpperCase()), el('b', {}, person), words));
    while (feed.children.length > 3) feed.firstChild.remove();
    [...feed.children].forEach((item, i, all) => item.classList.toggle('old', i < all.length - 1));
    if (!quiet) api.sfx?.('talk-bubble');
  }
  function addYours() {
    if (yours) return;
    yours = true; plant.hidden = true;
    raise('tree', here.x + 1.5, here.y + 0.5, 91); tell('you', false, 'planted a tree');
  }
  function clearBuilds() {
    for (const { mesh } of added) { standing.remove(mesh); mesh.geometry.dispose(); }
    added = []; nextBuild = 0; yours = false; feed.textContent = ''; plant.hidden = true;
  }

  const FACING = [0, -Math.PI / 2, Math.PI / 2, Math.PI];   // down, left, right, up: which way a walker's front points
  const state = { tilt: TILT, rise: 1 };
  // Drag sideways to look around the island. Let go and the camera swings back, so up is always north when you walk.
  let drag = null, swing = 0, swingTo = 0;
  root.addEventListener('pointerdown', event => { drag = { x: event.clientX, id: event.pointerId }; });
  root.addEventListener('pointermove', event => { if (drag && drag.id === event.pointerId && (event.buttons || event.pointerType !== 'mouse')) swingTo = clamp((event.clientX - drag.x) / w * -2.6, -1.25, 1.25); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(type, () => { drag = null; swingTo = 0; });

  renderer.setClearColor(0x58b3e6);
  let w = 1, h = 1, lastT = 0;
  function walk(a, who, at, moving, t, dt) {
    let turn = FACING[who.dir] - a.turn;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    a.turn += turn * Math.min(1, dt * 14);
    const stride = t * 11 + (a.hover ? 1.3 : 0), swingArm = moving ? Math.sin(stride) : 0;
    a.group.rotation.y = a.turn;
    a.group.position.set(at.x + 0.5, heightAt(at.x + 0.5, at.y + 0.5) - GROUND + (moving ? Math.abs(Math.sin(stride)) * 0.035 : Math.sin(t * 2.2 + a.hover) * 0.008) + a.hover * (0.03 + Math.sin(t * 3) * 0.012), at.y + 0.5);
    a.arms[0].rotation.x = swingArm * 0.8; a.arms[1].rotation.x = -swingArm * 0.8;
    a.feet.forEach((foot, i) => { const s = (i ? -1 : 1) * swingArm; foot.position.z = s * 0.09; foot.position.y = 0.05 + (moving ? Math.max(0, (i ? -1 : 1) * Math.cos(stride)) * 0.05 : 0); });
  }

  return {
    el: root,
    /** What the director changes: `tilt` (TOP is straight down) and `rise` 0..1 (how far things stand up). */
    state,
    /** Stand up and settle. */
    look() { state.tilt = TILT; state.rise = 1; },
    /** A fresh start: nothing has been added yet. */
    enter() { clearBuilds(); },
    resize(nw, nh, dpr) {
      w = nw; h = nh;
      renderer.setPixelRatio(Math.min(dpr, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    render(game, view) {
      const t = game.t, dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      const depth = clamp((TOP - state.tilt) / (TOP - TILT));
      const dist = (h / 2) / (TAN * view.zoom * lerp(1, 1.14, depth));
      swing += (swingTo * depth - swing) * Math.min(1, dt * (drag ? 16 : 5));
      const flat = dist * Math.cos(state.tilt), sin = Math.sin(swing), cos = Math.cos(swing);
      camera.position.set(view.cx + flat * sin, GROUND + dist * Math.sin(state.tilt), view.cy + flat * cos);
      camera.up.set(-sin * Math.sin(state.tilt), Math.cos(state.tilt), -cos * Math.sin(state.tilt));
      camera.lookAt(view.cx, GROUND, view.cy);
      standing.scale.y = Math.max(0.02, state.rise);

      // Others build on it: a new thing every couple of seconds once the world has stood up, and one of your own.
      clockNow = t; here = game.player;
      if (state.rise > 0.98 && game.form === 1) {
        while (nextBuild < BUILDS.length && view.since >= BUILDS[nextBuild][0] + 2.2) { const [at, name, agent, kind, x, z, words] = BUILDS[nextBuild++], late = view.since - at - 2.2; raise(kind, x, z, nextBuild * 17, late); tell(name, agent, words, late > 0.5); }
        plant.hidden = yours || view.since < 4;
        if (view.story && !yours && view.since > 9.2 && !game.moving()) addYours();
      }
      for (const item of added) { const k = clamp((t - item.born) / 0.5); item.mesh.scale.setScalar(k < 1 ? 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2) : 1); }
      walk(you, game.player, game.pos(game.player), game.moving(), t, dt);
      walk(agent, game.buddy, game.pos(game.buddy), game.moving(), t, dt);
      neighbour.group.position.y = heightAt(PLACES.neighbour.x + 0.5, PLACES.neighbour.y + 0.5) - GROUND + Math.sin(t * 2) * 0.008;
      const o = game.orbPos();
      orb.position.set(o.x + 0.5, GROUND + 0.5 + Math.sin(t * 3) * 0.06 + o.lift, o.y + 0.5);
      orb.rotation.y = t;

      U.uT.value = t; U.uOrb.value.copy(orb.position); U.uCam.value.copy(camera.position);
      U.uShade.value = clamp(state.rise * 1.6 - 0.3);
      halo.scale.setScalar(1.7 + Math.sin(t * 5) * 0.08);

      if (U.uShade.value > 0.01) {    // first the island as the sun sees it, which is where the shadows fall
        scene.overrideMaterial = depthOnly;
        renderer.setRenderTarget(shadows); renderer.clear(); renderer.render(scene, sunCam);
        renderer.setRenderTarget(null); scene.overrideMaterial = null;
      }
      renderer.render(scene, camera);
    },
    pick(x, y) {
      const dir = new THREE.Vector3((x / w) * 2 - 1, 1 - (y / h) * 2, 0.5).unproject(camera).sub(camera.position).normalize();
      if (dir.y >= -1e-4) return null;
      const k = (GROUND - camera.position.y) / dir.y;
      return { x: Math.floor(camera.position.x + dir.x * k), y: Math.floor(camera.position.z + dir.z * k) };
    },
    screenOf(tx, ty, up = 0.35) {
      const v = new THREE.Vector3(tx + 0.5, GROUND + up * state.rise, ty + 0.5).project(camera);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
    },
  };
}

export const poly = {
  id: 'poly', name: 'a/builders', kind: 'now in 3D', headline: 'Then others\n*build on it.*',
  dot: 'radial-gradient(circle at 34% 30%, #9fe0a4 0 22%, #63c06b 23% 48%, #3f7fd6 49% 80%, #2f62b8 81%)',
  create: createScene,
};
