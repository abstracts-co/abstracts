// town.js: the island every form shows: its map, the way to walk across it, and its pixel art.
// The pixel art is drawn with whole-pixel rectangles on a small canvas, so it stays crisp when scaled up.
import { hash2 } from './util.js';

export const TILE = 16;
/* ~ water  . grass  = path  : tall grass  T tree  f flowers  H house  B the Wall  S sign  N neighbour  b dock */
const ROWS = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~........~~~~~~',
  '~~~~.TT.....TT...~~~',
  '~~~..T.BBB..T.....~~',
  '~~....=====..::::.~~',
  '~~.T..=====..:::::.~',
  '~.......=====:::::.~',
  '~..HHH..=..f.::::..~',
  '~..HHH..=........T.~',
  '~...=====........~~~',
  '~.T.....=....HHH..~~',
  '~~......=..f.HHH...~',
  '~~.f...S=.....=....~',
  '~~~.....=======...~~',
  '~~~..T..=...N..T.~~~',
  '~~~~....=.......~~~~',
  '~~~~~.T.=..f..~~~~~~',
  '~~~~~~..=...~~~~~~~~',
  '~~~~~~~~b~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
];
export const W = 20, H = 20;
for (const row of ROWS) if (row.length !== W) throw new Error(`town row "${row}" is ${row.length} wide`);

export const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '~' : ROWS[y][x]);
export const isWater = (x, y) => tile(x, y) === '~';
export const isPath = (x, y) => '=b'.includes(tile(x, y));
export const isTall = (x, y) => tile(x, y) === ':';
/** Can a character stand here? (Characters are checked separately.) */
export const walkable = (x, y) => '.=:fb'.includes(tile(x, y));

/** Where things are, in tiles. Houses and the Wall are listed by their top-left footprint tile. */
export const PLACES = {
  spawn: { x: 8, y: 16 },
  wall: { x: 7, y: 3, w: 3, h: 1, stand: { x: 8, y: 4 } },
  sign: { x: 7, y: 12, stand: { x: 8, y: 12 } },
  neighbour: { x: 12, y: 14, stand: { x: 12, y: 13 } },
  skills: { x: 3, y: 7, w: 3, h: 2, door: { x: 4, y: 8 }, stand: { x: 4, y: 9 }, roof: 'coral' },
  hall: { x: 13, y: 10, w: 3, h: 2, door: { x: 14, y: 11 }, stand: { x: 14, y: 12 }, roof: 'plum' },
  dock: { x: 8, y: 18 },
  trees: [], flowers: [],
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (tile(x, y) === 'T') PLACES.trees.push({ x, y });
  if (tile(x, y) === 'f') PLACES.flowers.push({ x, y });
}

export const P = {
  ink: '#1f2436',
  g1: '#8fd16a', g2: '#6dbd58', g3: '#4f9e45', gl: '#b4e58a',
  t1: '#3f9a46', t2: '#2f7d3c', t3: '#8ada6c',
  p1: '#ecd9a9', p2: '#dcc48d', p3: '#c4a56f',
  w1: '#58b3e6', w2: '#8fd3f5', w3: '#3d94cf', foam: '#e3f6ff', cliff: '#7a5a3c', cliffD: '#5c4029',
  leaf1: '#2f8f4a', leaf2: '#43ae5c', leaf3: '#74d07c', leafD: '#1d5f38', trunk: '#8a5a3a', trunkD: '#5f3d27',
  wallL: '#fbf4e4', wallD: '#dfd0b5', door: '#7a4f2e', doorD: '#573620', glass: '#7fc4ee', glassL: '#c9ecff',
  coral: '#ef6b4e', coralD: '#c14f37', coralL: '#ff9a7c',
  plum: '#7d5ba6', plumD: '#5b3f80', plumL: '#a98bd0',
  teal: '#2a9d8f', tealD: '#1d7168', tealL: '#5cc7b8',
  wood: '#b07a45', woodD: '#7d5229', woodL: '#d19a5e', cork: '#e6c58f', corkD: '#cfa76c',
  white: '#fffdf8', sun: '#f4b63f', sunL: '#ffe08a', amber: '#d97a1e', sky: '#6fb0e6', pink: '#f2a1b4',
  shade: 'rgba(31,36,54,.22)',
};

/* ---------- pixel helpers ---------- */
export const R = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
/** A filled pixel disc (or ellipse with ry). */
export function disc(g, color, cx, cy, rx, ry = rx) {
  g.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.35) * (ry + 0.35)))));
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}
/** A filled convex polygon, row by row, with no smoothing. */
export function poly(g, color, pts) {
  g.fillStyle = color;
  const ys = pts.map(p => p[1]);
  for (let y = Math.ceil(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if (y1 === y2) { if (y === y1) { lo = Math.min(lo, x1, x2); hi = Math.max(hi, x1, x2); } continue; }
      if (y < Math.min(y1, y2) || y > Math.max(y1, y2)) continue;
      const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    if (hi >= lo) g.fillRect(Math.round(lo), y, Math.round(hi) - Math.round(lo) + 1, 1);
  }
}

/* ---------- ground ---------- */
function grass(g, px, py, x, y) {
  R(g, P.g1, px, py, TILE, TILE);
  for (let i = 0; i < 3; i++) {
    const tx = px + 1 + Math.floor(hash2(x * 7 + i, y * 13 + i * 3) * 13);
    const ty = py + 2 + Math.floor(hash2(x * 11 + i * 5, y * 3 + i) * 11);
    R(g, P.g2, tx, ty, 1, 2); R(g, P.g2, tx + 1, ty + 1, 1, 1);
  }
  if (hash2(x + 31, y + 17) > 0.72) R(g, P.gl, px + 3 + Math.floor(hash2(x, y + 9) * 10), py + 3 + Math.floor(hash2(x + 5, y) * 10), 2, 1);
}
function tallGrass(g, px, py, x, y, frame) {
  R(g, P.t1, px, py, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const bx = px + i * 4 + ((y + i + (frame && (x + i) % 2 ? 1 : 0)) % 2);
    for (let row = 0; row < 2; row++) {
      const by = py + 2 + row * 8;
      R(g, P.t2, bx, by + 2, 3, 5);
      R(g, P.t3, bx + 1, by, 1, 4); R(g, P.t3, bx, by + 2, 1, 2);
    }
  }
}
function path(g, px, py, x, y) {
  R(g, P.p1, px, py, TILE, TILE);
  for (let i = 0; i < 4; i++) R(g, P.p2, px + 1 + Math.floor(hash2(x * 5 + i, y * 9 + i) * 13), py + 1 + Math.floor(hash2(x * 3 + i * 7, y * 5 + i) * 13), 2, 1);
  if (!isPath(x, y - 1)) { R(g, P.p3, px, py, TILE, 1); for (let i = 0; i < 16; i += 5) R(g, P.g2, px + i + (x % 3), py, 2, 1); }
  if (!isPath(x, y + 1)) R(g, P.p3, px, py + 15, TILE, 1);
  if (!isPath(x - 1, y)) R(g, P.p3, px, py, 1, TILE);
  if (!isPath(x + 1, y)) R(g, P.p3, px + 15, py, 1, TILE);
}
function water(g, px, py, x, y, frame) {
  R(g, P.w1, px, py, TILE, TILE);
  const shift = frame ? 3 : 0;
  for (let i = 0; i < 2; i++) {
    const wx = px + ((Math.floor(hash2(x * 3 + i, y * 7) * 12) + shift) % 12);
    const wy = py + 3 + Math.floor(hash2(x + i * 9, y * 5 + i) * 10);
    R(g, hash2(x + i, y) > 0.5 ? P.w2 : P.w3, wx, wy, 4, 1);
  }
  // Land to the north casts a cliff; land on the other sides gets foam.
  if (!isWater(x, y - 1)) { R(g, P.cliff, px, py, TILE, 4); R(g, P.cliffD, px, py + 3, TILE, 1); R(g, P.foam, px + (frame ? 1 : 0), py + 5, 14, 1); }
  if (!isWater(x, y + 1)) R(g, P.foam, px + (frame ? 0 : 2), py + 14, 13, 1);
  if (!isWater(x - 1, y)) R(g, P.foam, px + 1, py + (frame ? 2 : 4), 1, 11);
  if (!isWater(x + 1, y)) R(g, P.foam, px + 14, py + (frame ? 4 : 2), 1, 11);
}
function dock(g, px, py) {
  R(g, P.w1, px, py, TILE, TILE);
  R(g, P.woodD, px + 2, py, 12, 14); R(g, P.wood, px + 3, py, 10, 13);
  for (let i = 3; i < 13; i += 4) R(g, P.woodD, px + 3, py + i, 10, 1);
  R(g, P.woodD, px + 1, py + 11, 2, 5); R(g, P.woodD, px + 13, py + 11, 2, 5);
}
function flowers(g, px, py, x, y, frame) {
  const colors = [P.white, P.pink, P.sunL];
  for (let i = 0; i < 3; i++) {
    const fx = px + 2 + i * 5 + (frame && i % 2 ? 1 : 0), fy = py + 3 + ((x + y + i * 2) % 3) * 4;
    R(g, P.g3, fx + 1, fy + 2, 1, 3);
    R(g, colors[(x + i) % 3], fx, fy, 3, 3); R(g, P.sun, fx + 1, fy + 1, 1, 1);
  }
}
/**
 * Paint the bare ground (grass, paths, water) around the island.
 * `margin` is how many extra water tiles to draw on every side; the canvas must be (W + 2*margin) * TILE square.
 */
export function paintGround(g, frame = 0, margin = 0) {
  for (let y = -margin; y < H + margin; y++) for (let x = -margin; x < W + margin; x++) {
    const px = (x + margin) * TILE, py = (y + margin) * TILE, t = tile(x, y);
    if (t === '~') water(g, px, py, x, y, frame);
    else if (t === 'b') dock(g, px, py);
    else if (t === '=') path(g, px, py, x, y);
    else if (t === ':') tallGrass(g, px, py, x, y, frame);
    else { grass(g, px, py, x, y); if (t === 'f') flowers(g, px, py, x, y, frame); }
  }
}
/** The front half of a tall-grass tile, drawn over a character standing in it. */
export function tallGrassFront(g, px, py, x, y, frame) {
  for (let i = 0; i < 4; i++) {
    const bx = px + i * 4 + ((y + i + (frame && (x + i) % 2 ? 1 : 0)) % 2);
    R(g, P.t2, bx, py + 12, 3, 4); R(g, P.t3, bx + 1, py + 10, 1, 4); R(g, P.t3, bx, py + 12, 1, 2);
  }
}

/* ---------- props (px, py = top-left of the prop's tile) ---------- */
export function drawTree(g, px, py) {
  disc(g, P.shade, px + 8, py + 14, 6, 2);
  R(g, P.trunkD, px + 6, py + 6, 4, 9); R(g, P.trunk, px + 7, py + 6, 2, 9);
  disc(g, P.leafD, px + 8, py - 2, 9, 9);
  disc(g, P.leaf1, px + 8, py - 3, 8, 8);
  disc(g, P.leaf2, px + 7, py - 5, 6, 5);
  disc(g, P.leaf3, px + 5, py - 7, 2, 2);
  R(g, P.leaf3, px + 10, py - 4, 2, 1); R(g, P.leafD, px + 4, py + 2, 3, 1); R(g, P.leafD, px + 10, py + 3, 2, 1);
}
/** A house on a 3 by 2 footprint. `icon` is 'book' (skills) or 'cube' (artifacts). */
export function drawHouse(g, px, py, roof = 'coral', icon = 'book') {
  const [r1, r2, r3] = roof === 'plum' ? [P.plum, P.plumD, P.plumL] : [P.coral, P.coralD, P.coralL];
  disc(g, P.shade, px + 24, py + 31, 24, 2);
  R(g, P.ink, px + 3, py + 7, 42, 25);
  R(g, P.wallL, px + 4, py + 8, 40, 23);
  R(g, P.wallD, px + 4, py + 8, 40, 3); R(g, P.wallD, px + 40, py + 11, 4, 20);
  // roof
  for (let i = 0; i < 20; i++) {
    const inset = Math.max(0, 8 - Math.floor(i * 0.5));
    R(g, P.ink, px + inset - 1, py - 12 + i, 50 - inset * 2, 1);
    R(g, i % 5 === 4 ? r2 : r1, px + inset, py - 12 + i, 48 - inset * 2, 1);
  }
  R(g, r3, px + 10, py - 11, 22, 1); R(g, P.ink, px - 1, py + 8, 50, 1);
  R(g, P.ink, px + 34, py - 17, 7, 8); R(g, P.wallD, px + 35, py - 16, 5, 7);
  // door and windows
  R(g, P.ink, px + 19, py + 16, 10, 16); R(g, P.door, px + 20, py + 17, 8, 15); R(g, P.doorD, px + 20, py + 17, 2, 15); R(g, P.sun, px + 26, py + 24, 1, 2);
  for (const wx of [7, 33]) {
    R(g, P.ink, px + wx - 1, py + 15, 10, 10); R(g, P.glass, px + wx, py + 16, 8, 8);
    R(g, P.glassL, px + wx, py + 16, 3, 3); R(g, P.ink, px + wx + 4, py + 16, 1, 8); R(g, P.ink, px + wx, py + 20, 8, 1);
  }
  // sign above the door
  R(g, P.ink, px + 18, py + 9, 12, 7); R(g, P.white, px + 19, py + 10, 10, 5);
  if (icon === 'cube') { R(g, P.sun, px + 22, py + 10, 4, 2); R(g, P.amber, px + 22, py + 12, 2, 3); R(g, P.coral, px + 24, py + 12, 2, 3); }
  else { R(g, P.teal, px + 21, py + 11, 3, 3); R(g, P.tealL, px + 25, py + 11, 3, 3); R(g, P.ink, px + 24, py + 11, 1, 3); }
}
/** The Wall: a cork board three tiles wide. `posted` 0..1 fades in the new Artifact card; `glow` pulses it. */
export function drawWall(g, px, py, posted = 0, glow = 0) {
  disc(g, P.shade, px + 24, py + 15, 22, 1);
  R(g, P.ink, px + 4, py + 4, 3, 12); R(g, P.ink, px + 41, py + 4, 3, 12);
  R(g, P.woodD, px + 5, py + 4, 1, 11); R(g, P.woodD, px + 42, py + 4, 1, 11);
  R(g, P.ink, px, py - 14, 48, 24);
  R(g, P.wood, px + 1, py - 13, 46, 22); R(g, P.woodL, px + 1, py - 13, 46, 1);
  R(g, P.cork, px + 3, py - 11, 42, 18); R(g, P.corkD, px + 3, py + 6, 42, 1);
  const card = (x, y, w, h, top) => { R(g, P.shade, px + x + 1, py + y + 1, w, h); R(g, P.white, px + x, py + y, w, h); R(g, top, px + x, py + y, w, 2); R(g, P.corkD, px + x + 1, py + y + 4, w - 3, 1); if (h > 7) R(g, P.corkD, px + x + 1, py + y + 6, w - 4, 1); };
  card(5, -9, 9, 7, P.coral); card(5, 0, 9, 6, P.teal);
  card(34, -9, 9, 6, P.plum); card(34, -1, 9, 7, P.sky);
  card(16, 1, 7, 5, P.pink); card(25, 1, 7, 5, P.sunL);
  if (posted > 0) {
    if (glow > 0) { g.globalAlpha = 0.35 + 0.35 * glow; R(g, P.sunL, px + 15, py - 11, 18, 12); g.globalAlpha = 1; }
    g.globalAlpha = posted;
    R(g, P.ink, px + 16, py - 10, 16, 10); R(g, P.white, px + 17, py - 9, 14, 8);
    drawCube(g, px + 24, py - 5, 3);
    g.globalAlpha = 1;
  } else { R(g, P.corkD, px + 17, py - 9, 14, 1); R(g, P.corkD, px + 17, py - 2, 14, 1); R(g, P.corkD, px + 17, py - 9, 1, 8); R(g, P.corkD, px + 30, py - 9, 1, 8); }
}
export function drawSign(g, px, py) {
  disc(g, P.shade, px + 8, py + 14, 5, 1);
  R(g, P.ink, px + 6, py + 6, 4, 9); R(g, P.woodD, px + 7, py + 6, 2, 8);
  R(g, P.ink, px + 1, py - 3, 14, 10); R(g, P.woodL, px + 2, py - 2, 12, 8); R(g, P.wood, px + 2, py + 5, 12, 1);
  R(g, P.woodD, px + 4, py, 8, 1); R(g, P.woodD, px + 4, py + 2, 6, 1);
}
/** A little isometric cube, the Artifact. `s` is the half-width in pixels; cx, cy is its centre. */
export function drawCube(g, cx, cy, s, outline = true) {
  const h = Math.round(s / 2);
  const top = [[cx, cy - s], [cx + s, cy - h], [cx, cy], [cx - s, cy - h]];
  const left = [[cx - s, cy - h], [cx, cy], [cx, cy + s], [cx - s, cy + s - h]];
  const right = [[cx + s, cy - h], [cx + s, cy + s - h], [cx, cy + s], [cx, cy]];
  if (outline) poly(g, P.ink, [[cx, cy - s - 1], [cx + s + 1, cy - h - 1], [cx + s + 1, cy + s - h + 1], [cx, cy + s + 1], [cx - s - 1, cy + s - h + 1], [cx - s - 1, cy - h - 1]]);
  poly(g, P.sunL, top); poly(g, P.sun, left); poly(g, P.amber, right);
}

/* ---------- characters (px, py = top-left of their tile; they stand a little above it) ---------- */
const TINTS = { coral: [P.coral, P.coralD, P.coralL], teal: [P.teal, P.tealD, P.tealL], plum: [P.plum, P.plumD, P.plumL] };
/** dir: 0 down, 1 left, 2 right, 3 up. step: 0 or 1 (walk frame). */
export function drawPerson(g, px, py, dir = 0, step = 0, tint = 'coral') {
  const [c, d, l] = TINTS[tint];
  const y = py - 3 - (step ? 1 : 0);
  disc(g, P.shade, px + 8, py + 14, 5, 1);
  // feet
  R(g, P.ink, px + 5, y + 15 + (step ? 1 : 0), 3, 2); R(g, P.ink, px + 9, y + 15 + (step ? 0 : 0) + (step ? 0 : 0), 3, 2 + (step ? 0 : 0));
  // body
  R(g, P.ink, px + 4, y + 9, 8, 7); R(g, P.ink, px + 3, y + 10, 10, 5);
  R(g, d, px + 5, y + 10, 6, 5); R(g, d, px + 4, y + 11, 8, 3);
  // head
  disc(g, P.ink, px + 8, y + 5, 6, 6); disc(g, c, px + 8, y + 5, 5, 5);
  R(g, l, px + 5, y + 2, 2, 1); R(g, l, px + 4, y + 3, 1, 2);
  if (dir === 0) { R(g, P.ink, px + 6, y + 5, 1, 2); R(g, P.ink, px + 10, y + 5, 1, 2); R(g, P.ink, px + 7, y + 8, 3, 1); }
  else if (dir === 1) { R(g, P.ink, px + 4, y + 5, 1, 2); R(g, P.ink, px + 8, y + 5, 1, 2); }
  else if (dir === 2) { R(g, P.ink, px + 8, y + 5, 1, 2); R(g, P.ink, px + 12, y + 5, 1, 2); }
}
/** The agent: a small robot. `frame` 0 or 1 blinks its bulb. */
export function drawRobot(g, px, py, frame = 0, dir = 0) {
  const y = py - 3 - (frame ? 0 : 0);
  disc(g, P.shade, px + 8, py + 14, 6, 1);
  R(g, P.ink, px + 7, y - 3, 2, 4); R(g, frame ? P.sunL : P.sun, px + 7, y - 4, 2, 2);
  R(g, P.ink, px + 4, y + 15, 3, 2); R(g, P.ink, px + 9, y + 15, 3, 2);
  R(g, P.ink, px + 3, y + 9, 10, 7); R(g, P.plumD, px + 4, y + 10, 8, 5); R(g, P.plumL, px + 7, y + 12, 2, 2);
  R(g, P.ink, px + 1, y, 14, 10); R(g, P.ink, px, y + 3, 16, 4);
  R(g, P.plum, px + 2, y + 1, 12, 8); R(g, P.plumL, px + 2, y + 1, 12, 1);
  if (dir !== 3) {
    const o = dir === 1 ? -1 : dir === 2 ? 1 : 0;
    R(g, P.ink, px + 4 + o, y + 3, 8, 4);
    R(g, P.sky, px + 5 + o, y + 4, 2, 2); R(g, P.sky, px + 9 + o, y + 4, 2, 2);
  }
}

/** Every fixed prop with the row it should be sorted by, so characters can walk behind and in front. */
export function props() {
  const list = [];
  for (const t of PLACES.trees) list.push({ row: t.y, draw: (g, ox, oy) => drawTree(g, ox + t.x * TILE, oy + t.y * TILE) });
  list.push({ row: PLACES.skills.y + 1, draw: (g, ox, oy) => drawHouse(g, ox + PLACES.skills.x * TILE, oy + PLACES.skills.y * TILE, 'coral', 'book') });
  list.push({ row: PLACES.hall.y + 1, draw: (g, ox, oy) => drawHouse(g, ox + PLACES.hall.x * TILE, oy + PLACES.hall.y * TILE, 'plum', 'cube') });
  list.push({ row: PLACES.sign.y, draw: (g, ox, oy) => drawSign(g, ox + PLACES.sign.x * TILE, oy + PLACES.sign.y * TILE) });
  list.push({ row: PLACES.wall.y, wall: true, draw: (g, ox, oy, state = {}) => drawWall(g, ox + PLACES.wall.x * TILE, oy + PLACES.wall.y * TILE, state.posted || 0, state.glow || 0) });
  return list;
}
/** Shortest walk between two tiles (4 directions). `blocked(x, y)` adds characters. Returns [{x, y}, ...] without the start, or null. */
export function findPath(from, to, blocked = () => false) {
  const key = (x, y) => y * W + x;
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) {
      const out = [];
      for (let n = cur; n && !(n.x === from.x && n.y === from.y); n = prev.get(key(n.x, n.y))) out.unshift({ x: n.x, y: n.y });
      return out;
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = cur.x + dx, y = cur.y + dy;
      if (!walkable(x, y) || blocked(x, y) || prev.has(key(x, y))) continue;
      prev.set(key(x, y), cur);
      queue.push({ x, y });
    }
  }
  return null;
}
