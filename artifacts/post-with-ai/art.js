// art.js: pictures drawn in the page (no image files): the cat photo, the pictures on the
// example posts, and member avatars. Each draws into a 2D canvas box (x, y, w, h).

const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function clipBox(g, x, y, w, h, r, fn) {
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip(); g.translate(x, y); fn(w, h); g.restore();
}
function vignette(g, w, h, k = 0.35) {
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,12,4,${k})`);
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}
function artNoise(g, w, h, seed, a = 0.06) {
  const r = seeded(seed);
  for (let i = 0; i < (w * h) / 90; i++) { g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(r() * w, r() * h, 1.6, 1.6); }
}

const COATS = {
  ginger: { hi: '#f4b06a', mid: '#d97b30', lo: '#9c4f1a', ear: '#cf7430', tail: '#c56a26', stripe: 'rgba(140,62,18,.55)', muzzle: '#fde9cf', eye: '#7fae3e' },
  gray: { hi: '#c9c9cc', mid: '#8f9096', lo: '#5d5e66', ear: '#8a8b92', tail: '#7d7e86', stripe: 'rgba(60,60,70,.5)', muzzle: '#eeeef0', eye: '#e3b33c' },
  black: { hi: '#5a5a63', mid: '#2c2c33', lo: '#151519', ear: '#2a2a31', tail: '#26262c', stripe: null, muzzle: '#3b3b44', eye: '#f2c94c' },
  cream: { hi: '#fffaf0', mid: '#eadfcb', lo: '#bfae92', ear: '#e3d6bf', tail: '#dccdb3', stripe: null, muzzle: '#fffdf8', eye: '#5aa0d8' },
};
const ROOMS = {
  sofa: { wall: ['#e9d3b4', '#b98f66'], seat: ['#3f8f86', '#245a55'] },
  blue: { wall: ['#cfe0ea', '#8fb0c4'], seat: ['#d9a35a', '#a8712f'] },
  rose: { wall: ['#f1d6d6', '#c99a9a'], seat: ['#5b6aa8', '#36427a'] },
  green: { wall: ['#dfe8cf', '#a9bd8a'], seat: ['#b65a4a', '#7e3a2f'] },
};
const HATCOL = { party: ['#ef6b4e', '#f4b63f'], top: ['#22232b', '#7d5ba6'], beanie: ['#2a9d8f', '#f7f1e4'] };
/** A silly hat on a head at (hx, hy) of radius hr; k is 0..1 as it pops on (drops in, springs to size). */
function drawHat(g, kind, hx, hy, hr, k) {
  if (!kind || k <= 0) return;
  const c1 = 1.70158, back = 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  const [a, b] = HATCOL[kind];
  g.save();
  g.translate(hx + hr * 0.1, hy - hr * 0.62 - (1 - Math.min(1, k * 1.4)) * hr * 1.6);
  g.rotate(0.22); g.scale(back * 1.2, back * 1.2);
  g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = hr * 0.15; g.shadowOffsetY = hr * 0.06;
  if (kind === 'party') {
    g.beginPath(); g.moveTo(-hr * 0.55, 0); g.lineTo(0, -hr * 1.45); g.lineTo(hr * 0.55, 0); g.closePath();
    g.fillStyle = a; g.fill(); g.shadowColor = 'transparent';
    g.save(); g.clip(); g.strokeStyle = b; g.lineWidth = hr * 0.16;
    for (let i = -3; i < 4; i++) { g.beginPath(); g.moveTo(-hr, -hr * 0.2 + i * hr * 0.42); g.lineTo(hr, -hr * 0.75 + i * hr * 0.42); g.stroke(); }
    g.restore();
    g.fillStyle = '#fffdf8'; g.beginPath(); g.arc(0, -hr * 1.45, hr * 0.18, 0, Math.PI * 2); g.fill();
  } else if (kind === 'top') {
    g.fillStyle = a; g.beginPath(); g.ellipse(0, 0, hr * 0.8, hr * 0.16, 0, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
    g.fillRect(-hr * 0.48, -hr * 1.05, hr * 0.96, hr * 1.05);
    g.fillStyle = '#3a3b45'; g.beginPath(); g.ellipse(0, -hr * 1.05, hr * 0.48, hr * 0.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = b; g.fillRect(-hr * 0.48, -hr * 0.3, hr * 0.96, hr * 0.18);
  } else {
    g.fillStyle = a; g.beginPath(); g.ellipse(0, -hr * 0.05, hr * 0.68, hr * 0.62, 0, Math.PI, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = hr * 0.05;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * hr * 0.17, -hr * 0.1); g.lineTo(i * hr * 0.12, -hr * 0.6); g.stroke(); }
    g.fillStyle = b; g.beginPath(); g.roundRect(-hr * 0.72, -hr * 0.2, hr * 1.44, hr * 0.28, hr * 0.1); g.fill();
    g.fillStyle = '#ef6b4e'; g.beginPath(); g.arc(0, -hr * 0.72, hr * 0.17, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/** A cat on a sofa by a window, "photo" style. o: { coat, room, hat, hatK, flip } */
export function drawCat(g, x, y, w, h, r = 18, o = {}) {
  const P = COATS[o.coat || 'ginger'], R = ROOMS[o.room || 'sofa'];
  clipBox(g, x, y, w, h, r, (W, H) => {
    const s = Math.min(W / 4, H / 3);
    if (o.flip) { g.translate(W, 0); g.scale(-1, 1); }
    // room: wall, window light, sofa
    let gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, R.wall[0]); gr.addColorStop(1, R.wall[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.filter = `blur(${s * 0.18}px)`;
    g.fillStyle = 'rgba(255,248,226,.85)'; g.fillRect(W * 0.64, -H * 0.1, W * 0.3, H * 0.62);
    g.fillStyle = 'rgba(150,190,200,.55)'; g.fillRect(W * 0.67, H * 0.02, W * 0.24, H * 0.42);
    g.restore();
    gr = g.createLinearGradient(0, H * 0.62, 0, H);
    gr.addColorStop(0, R.seat[0]); gr.addColorStop(1, R.seat[1]);
    g.fillStyle = gr; g.beginPath(); g.roundRect(-20, H * 0.64, W + 40, H * 0.5, s * 0.25); g.fill();
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) g.fillRect(i * W / 8, H * 0.64, 2, H);
    // cat, centered on (cx, cy)
    const cx = W * 0.42, cy = H * 0.6;
    g.save(); g.filter = `blur(${s * 0.12}px)`; g.fillStyle = 'rgba(20,30,28,.45)';
    g.beginPath(); g.ellipse(cx + s * 0.1, cy + s * 0.55, s * 1.35, s * 0.28, 0, 0, Math.PI * 2); g.fill(); g.restore();
    const fur = (x0, y0, r0) => { const f = g.createRadialGradient(x0 - r0 * 0.3, y0 - r0 * 0.4, r0 * 0.1, x0, y0, r0 * 1.1); f.addColorStop(0, P.hi); f.addColorStop(0.6, P.mid); f.addColorStop(1, P.lo); return f; };
    // tail
    g.strokeStyle = P.tail; g.lineWidth = s * 0.22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + s * 1.0, cy + s * 0.4); g.quadraticCurveTo(cx + s * 1.7, cy + s * 0.5, cx + s * 1.45, cy - s * 0.15); g.stroke();
    // body
    g.fillStyle = fur(cx + s * 0.25, cy, s * 1.1);
    g.beginPath(); g.ellipse(cx + s * 0.25, cy + s * 0.05, s * 1.05, s * 0.62, 0, 0, Math.PI * 2); g.fill();
    // stripes on body
    g.strokeStyle = P.stripe || 'rgba(0,0,0,0)'; g.lineWidth = s * 0.07;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + s * (0.35 + i * 0.22), cy - s * 0.2, s * 0.5, Math.PI * 0.62, Math.PI * 0.95); g.stroke(); }
    // chest
    g.fillStyle = P.stripe ? 'rgba(255,236,210,.9)' : P.muzzle; g.beginPath(); g.ellipse(cx - s * 0.45, cy + s * 0.2, s * 0.3, s * 0.4, 0.2, 0, Math.PI * 2); g.fill();
    // paws
    g.fillStyle = P.stripe ? '#fbe3c4' : P.muzzle;
    for (const dx of [-0.6, -0.25]) { g.beginPath(); g.ellipse(cx + s * dx, cy + s * 0.6, s * 0.17, s * 0.1, 0, 0, Math.PI * 2); g.fill(); }
    // head
    const hx = cx - s * 0.5, hy = cy - s * 0.55, hr = s * 0.55;
    for (const side of [-1, 1]) {
      g.fillStyle = P.ear; g.beginPath(); g.moveTo(hx + side * hr * 0.85, hy - hr * 0.2); g.lineTo(hx + side * hr * 0.7, hy - hr * 1.25); g.lineTo(hx + side * hr * 0.12, hy - hr * 0.72); g.closePath(); g.fill();
      g.fillStyle = '#f2a6a0'; g.beginPath(); g.moveTo(hx + side * hr * 0.72, hy - hr * 0.35); g.lineTo(hx + side * hr * 0.66, hy - hr * 1.0); g.lineTo(hx + side * hr * 0.3, hy - hr * 0.68); g.closePath(); g.fill();
    }
    g.fillStyle = fur(hx, hy, hr); g.beginPath(); g.ellipse(hx, hy, hr, hr * 0.88, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = P.stripe || 'rgba(0,0,0,0)'; g.lineWidth = s * 0.055;
    for (const dx of [-0.18, 0, 0.18]) { g.beginPath(); g.moveTo(hx + hr * dx, hy - hr * 0.82); g.lineTo(hx + hr * dx * 0.6, hy - hr * 0.45); g.stroke(); }
    g.fillStyle = P.muzzle; g.beginPath(); g.ellipse(hx, hy + hr * 0.32, hr * 0.45, hr * 0.32, 0, 0, Math.PI * 2); g.fill();
    for (const side of [-1, 1]) {
      const ex = hx + side * hr * 0.38, ey = hy - hr * 0.05;
      g.fillStyle = P.eye; g.beginPath(); g.ellipse(ex, ey, hr * 0.17, hr * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#16120c'; g.beginPath(); g.ellipse(ex, ey, hr * 0.05, hr * 0.12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ex - hr * 0.05, ey - hr * 0.05, hr * 0.035, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#e57f86'; g.beginPath(); g.moveTo(hx - hr * 0.09, hy + hr * 0.16); g.lineTo(hx + hr * 0.09, hy + hr * 0.16); g.lineTo(hx, hy + hr * 0.27); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, s * 0.015);
    for (const side of [-1, 1]) for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(hx + side * hr * 0.2, hy + hr * 0.32); g.lineTo(hx + side * hr * 1.05, hy + hr * (0.25 + k * 0.12)); g.stroke(); }
    drawHat(g, o.hat, hx, hy - hr * 0.2, hr, o.hatK ?? 1);
    vignette(g, W, H, 0.3); artNoise(g, W, H, 11, 0.05);
  });
}

/** Glowing paper lanterns at night (mira's 3D scene). */
export function drawLanterns(g, x, y, w, h, r = 14) {
  clipBox(g, x, y, w, h, r, (W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2340'); gr.addColorStop(1, '#4a2e55');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rr_ = seeded(5);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,240,200,${0.2 + rr_() * 0.5})`; g.fillRect(rr_() * W, rr_() * H * 0.6, 1.5, 1.5); }
    g.strokeStyle = 'rgba(255,230,180,.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, H * 0.18); g.quadraticCurveTo(W / 2, H * 0.42, W, H * 0.14); g.stroke();
    const L = [[0.14, 0.34, 0.11], [0.36, 0.48, 0.15], [0.6, 0.4, 0.12], [0.82, 0.28, 0.1], [0.5, 0.78, 0.08], [0.24, 0.72, 0.07]];
    for (const [lx, ly, ls] of L) {
      const X = lx * W, Y = ly * H, S = ls * H;
      const glow = g.createRadialGradient(X, Y, 0, X, Y, S * 2.6); glow.addColorStop(0, 'rgba(255,190,90,.55)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = glow; g.fillRect(X - S * 3, Y - S * 3, S * 6, S * 6);
      const body = g.createRadialGradient(X - S * 0.2, Y - S * 0.2, S * 0.1, X, Y, S);
      body.addColorStop(0, '#fff3c4'); body.addColorStop(0.6, '#f7b04a'); body.addColorStop(1, '#d9662a');
      g.fillStyle = body; g.beginPath(); g.ellipse(X, Y, S * 0.75, S, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(160,70,20,.45)'; g.lineWidth = 1.5;
      for (const k of [-0.4, 0, 0.4]) { g.beginPath(); g.ellipse(X, Y, S * 0.75 * Math.abs(k || 0.02), S, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#3a2a2a'; g.fillRect(X - S * 0.3, Y - S * 1.08, S * 0.6, S * 0.14); g.fillRect(X - S * 0.3, Y + S * 0.94, S * 0.6, S * 0.14);
    }
    vignette(g, W, H, 0.25);
  });
}

/** An open notebook and a coffee on a wooden table (jun's reading notes). */
export function drawNotes(g, x, y, w, h, r = 14) {
  clipBox(g, x, y, w, h, r, (W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#a87650'); gr.addColorStop(1, '#6e4a30');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(60,35,20,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, i * H / 10); g.bezierCurveTo(W * 0.3, i * H / 10 + 8, W * 0.6, i * H / 10 - 8, W, i * H / 10 + 4); g.stroke(); }
    g.save(); g.translate(W * 0.42, H * 0.52); g.rotate(-0.12);
    const pw = W * 0.3, ph = H * 0.72;
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
    g.fillStyle = '#fbf6ea'; g.fillRect(-pw, -ph / 2, pw * 2, ph); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-4, -ph / 2, 8, ph);
    g.strokeStyle = 'rgba(70,90,140,.55)'; g.lineWidth = 2.2;
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) { const ly = -ph / 2 + ph * 0.16 + i * ph * 0.11; g.beginPath(); g.moveTo(side < 0 ? -pw * 0.88 : pw * 0.12, ly); g.lineTo(side < 0 ? -pw * (0.2 + (i % 3) * 0.1) : pw * (0.8 - (i % 2) * 0.2), ly); g.stroke(); }
    g.restore();
    const cx = W * 0.84, cy = H * 0.3, cr = H * 0.17;
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
    g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
    const cof = g.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, 2, cx, cy, cr * 0.75); cof.addColorStop(0, '#8a5530'); cof.addColorStop(1, '#3d2112');
    g.fillStyle = cof; g.beginPath(); g.arc(cx, cy, cr * 0.75, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,240,220,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, cr * 0.4, 0.5, 2.6); g.stroke();
    g.fillStyle = '#f4b63f'; g.save(); g.translate(W * 0.16, H * 0.82); g.rotate(-0.5); g.fillRect(0, 0, W * 0.24, H * 0.035); g.fillStyle = '#333'; g.fillRect(W * 0.24, 0, W * 0.02, H * 0.035); g.restore();
    vignette(g, W, H, 0.25); artNoise(g, W, H, 3, 0.04);
  });
}

/** Pencil sketches of little paper buildings on grid paper (sam's plan). */
export function drawSketch(g, x, y, w, h, r = 14) {
  clipBox(g, x, y, w, h, r, (W, H) => {
    g.fillStyle = '#f6f1e3'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,140,200,.18)'; g.lineWidth = 1;
    for (let i = 0; i < W; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
    for (let i = 0; i < H; i += 18) { g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
    g.strokeStyle = 'rgba(40,40,50,.75)'; g.lineWidth = 2.2; g.lineJoin = 'round';
    const cube = (cx, cy, s, tall) => {
      const a = s * 0.87, b = s * 0.5;
      g.beginPath();
      g.moveTo(cx, cy - tall); g.lineTo(cx + a, cy - tall + b); g.lineTo(cx, cy - tall + 2 * b); g.lineTo(cx - a, cy - tall + b); g.closePath();
      g.moveTo(cx - a, cy - tall + b); g.lineTo(cx - a, cy + b); g.lineTo(cx, cy + 2 * b); g.lineTo(cx + a, cy + b); g.lineTo(cx + a, cy - tall + b);
      g.moveTo(cx, cy - tall + 2 * b); g.lineTo(cx, cy + 2 * b);
      g.stroke();
      g.fillStyle = 'rgba(239,107,78,.18)'; g.beginPath(); g.moveTo(cx, cy - tall + 2 * b); g.lineTo(cx + a, cy - tall + b); g.lineTo(cx + a, cy + b); g.lineTo(cx, cy + 2 * b); g.closePath(); g.fill();
    };
    cube(W * 0.25, H * 0.42, H * 0.16, H * 0.22);
    cube(W * 0.5, H * 0.32, H * 0.13, H * 0.34);
    cube(W * 0.74, H * 0.46, H * 0.15, H * 0.16);
    g.strokeStyle = 'rgba(40,40,50,.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(W * 0.08, H * 0.86); g.lineTo(W * 0.92, H * 0.86); g.stroke();
    g.fillStyle = 'rgba(244,182,63,.55)'; g.save(); g.translate(W * 0.82, H * 0.08); g.rotate(0.3); g.fillRect(-W * 0.09, -H * 0.04, W * 0.18, H * 0.08); g.restore();
    artNoise(g, W, H, 9, 0.03);
  });
}

const LOOKS = {
  mira: { bg: '#6fb0e6', skin: '#e9b48f', hair: '#2b1d17', style: 'long' },
  jun: { bg: '#f4b63f', skin: '#f1c9a0', hair: '#1f1b24', style: 'short' },
  sam: { bg: '#3ea66f', skin: '#a86f4c', hair: '#2a1a10', style: 'curly' },
};
/** A member's avatar: a small illustrated portrait for the example members, an initial for anyone else. */
export function drawAvatar(g, cx, cy, r, name, fallback = '#ef6b4e') {
  const L = LOOKS[name];
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (!L) {
    g.fillStyle = fallback; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.fillStyle = '#fff'; g.font = `600 ${Math.round(r * 1.05)}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05); g.restore(); return;
  }
  g.fillStyle = L.bg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.fillStyle = L.hair;
  if (L.style === 'long') { g.beginPath(); g.ellipse(cx, cy + r * 0.25, r * 0.62, r * 0.85, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fffdf8'; g.beginPath(); g.ellipse(cx, cy + r * 1.05, r * 0.75, r * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = L.skin; g.beginPath(); g.ellipse(cx, cy - r * 0.02, r * 0.42, r * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = L.hair;
  if (L.style === 'curly') for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(cx + (i - 3) * r * 0.15, cy - r * 0.45 + Math.abs(i - 3) * r * 0.05, r * 0.17, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.ellipse(cx, cy - r * 0.32, r * 0.46, r * 0.26, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - r * 0.46, cy - r * 0.34, r * 0.92, r * 0.1); }
  g.fillStyle = '#1f2436';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * r * 0.16, cy - r * 0.02, r * 0.05, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#1f2436'; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.arc(cx, cy + r * 0.12, r * 0.14, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
}

export const PICTURES = {
  cat: drawCat,
  pickle: (g, x, y, w, h, r) => drawCat(g, x, y, w, h, r, { coat: 'cream', room: 'blue', hat: 'party' }),
  pepper: (g, x, y, w, h, r) => drawCat(g, x, y, w, h, r, { coat: 'black', room: 'rose', hat: 'beanie', flip: true }),
  luna: (g, x, y, w, h, r) => drawCat(g, x, y, w, h, r, { coat: 'gray', room: 'green', hat: 'party' }),
  lanterns: drawLanterns, notes: drawNotes, sketch: drawSketch,
};
