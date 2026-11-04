// Cover pictures for "Set the vibes" (3:1, drawn on canvas; no image files) and the accent each gives the card.
const TAU = Math.PI * 2;
const lin = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
const dot = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

export const VIBES = [
  ['kitchen', 'Cozy kitchen', '#d9894f', (g, w, h) => {
    g.fillStyle = lin(g, 0, h, [[0, '#f6e3c6'], [1, '#efd2a8']]); g.fillRect(0, 0, w, h);
    g.fillStyle = '#f9f0dc'; g.fillRect(w * 0.06, h * 0.12, w * 0.24, h * 0.5);            // window
    g.fillStyle = '#bfe0ee'; g.fillRect(w * 0.075, h * 0.16, w * 0.21, h * 0.42);
    g.fillStyle = '#f9f0dc'; g.fillRect(w * 0.177, h * 0.16, w * 0.006, h * 0.42); g.fillRect(w * 0.075, h * 0.36, w * 0.21, h * 0.012);
    g.fillStyle = '#a9693e'; g.fillRect(w * 0.36, h * 0.38, w * 0.6, h * 0.05);               // shelf
    [['#e07b54', 0.4, 0.09], ['#4f8f6f', 0.52, 0.07], ['#e8b04a', 0.62, 0.1], ['#7a5aa6', 0.76, 0.06], ['#cf5c43', 0.86, 0.08]].forEach(([c, x, r]) => {
      g.fillStyle = c; g.beginPath(); g.roundRect(w * x - h * r, h * 0.38 - h * r * 1.6, h * r * 2, h * r * 1.6, h * 0.02); g.fill();
    });
    g.fillStyle = '#8a5434'; g.fillRect(0, h * 0.78, w, h * 0.22);                              // counter
    g.fillStyle = '#c96b45'; g.beginPath(); g.ellipse(w * 0.55, h * 0.78, w * 0.08, h * 0.13, 0, Math.PI, 0); g.fill(); // pot
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = h * 0.02; g.lineCap = 'round';
    for (const dx of [-0.03, 0, 0.03]) { g.beginPath(); g.moveTo(w * (0.55 + dx), h * 0.6); g.bezierCurveTo(w * (0.54 + dx), h * 0.52, w * (0.57 + dx), h * 0.5, w * (0.555 + dx), h * 0.44); g.stroke(); }
    dot(g, w * 0.88, h * 0.7, h * 0.08, '#3e8a5c'); g.fillStyle = '#b5764b'; g.fillRect(w * 0.86, h * 0.7, w * 0.04, h * 0.1);
  }],
  ['arcade', 'Neon arcade', '#7d5ba6', (g, w, h) => {
    g.fillStyle = lin(g, 0, h, [[0, '#1b1433'], [0.6, '#2e1b4f'], [1, '#12101f']]); g.fillRect(0, 0, w, h);
    dot(g, w * 0.5, h * 0.62, h * 0.32, '#ff6fb1'); g.fillStyle = '#2e1b4f';
    for (let i = 0; i < 5; i++) g.fillRect(w * 0.3, h * (0.5 + i * 0.06), w * 0.4, h * 0.018 * (i + 1) * 0.5);
    g.strokeStyle = '#3ee6e0'; g.lineWidth = 2; g.globalAlpha = 0.85;
    for (let i = 0; i <= 12; i++) { const x = (i / 12) * w; g.beginPath(); g.moveTo(w / 2 + (x - w / 2) * 0.15, h * 0.68); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 6; i++) { const y = h * 0.68 + (h * 0.32) * (i / 5) ** 1.8; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.globalAlpha = 1;
    const px = h * 0.035, inv = ['0010000100', '0001001000', '0011111100', '0110110110', '1111111111', '1011111101', '1010000101', '0001101100'];
    const ox = w * 0.12, oy = h * 0.18;
    g.fillStyle = '#3ee6e0'; inv.forEach((row, r) => [...row].forEach((b, c) => b === '1' && g.fillRect(ox + c * px, oy + r * px, px, px)));
    g.fillStyle = '#ffd34d'; inv.forEach((row, r) => [...row].forEach((b, c) => b === '1' && g.fillRect(w * 0.78 + c * px * 0.8, h * 0.22 + r * px * 0.8, px * 0.8, px * 0.8)));
    for (let i = 0; i < 18; i++) dot(g, (i * 137) % w, (i * 53) % (h * 0.45), 1.6, 'rgba(255,255,255,.8)');
  }],
  ['forest', 'Misty forest', '#3e8a5c', (g, w, h) => {
    g.fillStyle = lin(g, 0, h, [[0, '#dfeee2'], [1, '#b9d6bf']]); g.fillRect(0, 0, w, h);
    dot(g, w * 0.78, h * 0.3, h * 0.13, '#f8e7b5');
    const row = (y, s, c, n, off) => { g.fillStyle = c; for (let i = -1; i <= n; i++) { const x = (i + off) * (w / n); g.beginPath(); g.moveTo(x, y - h * s); g.lineTo(x - h * s * 0.42, y); g.lineTo(x + h * s * 0.42, y); g.fill(); } g.fillRect(0, y - 1, w, h - y + 1); };
    row(h * 0.72, 0.42, '#9cc4a6', 14, 0.3); row(h * 0.86, 0.55, '#5f9e74', 10, 0.6); row(h * 1.02, 0.6, '#2f6e4b', 8, 0.1);
  }],
  ['desk', 'Studio desk', '#e0a33b', (g, w, h) => {
    g.fillStyle = lin(g, 0, h, [[0, '#f1e6d6'], [1, '#e6d6bd']]); g.fillRect(0, 0, w, h);
    g.fillStyle = '#c99a62'; g.fillRect(0, h * 0.74, w, h * 0.26);
    g.fillStyle = '#1f2436'; g.beginPath(); g.roundRect(w * 0.36, h * 0.16, w * 0.28, h * 0.48, h * 0.03); g.fill();
    g.fillStyle = lin(g, h * 0.2, h * 0.6, [[0, '#6fb0e6'], [1, '#2a9d8f']]); g.fillRect(w * 0.375, h * 0.21, w * 0.25, h * 0.38);
    g.fillStyle = 'rgba(255,255,255,.75)'; [0.27, 0.35, 0.43].forEach((y, i) => { g.fillRect(w * 0.4, h * y, w * (0.12 + i * 0.03), h * 0.03); });
    g.fillStyle = '#1f2436'; g.fillRect(w * 0.49, h * 0.64, w * 0.02, h * 0.1);
    g.strokeStyle = '#1f2436'; g.lineWidth = h * 0.025; g.beginPath(); g.moveTo(w * 0.2, h * 0.74); g.lineTo(w * 0.17, h * 0.42); g.lineTo(w * 0.24, h * 0.3); g.stroke();
    g.fillStyle = '#e0a33b'; g.beginPath(); g.moveTo(w * 0.22, h * 0.26); g.lineTo(w * 0.29, h * 0.3); g.lineTo(w * 0.25, h * 0.38); g.fill();
    g.fillStyle = 'rgba(244,182,63,.25)'; g.beginPath(); g.moveTo(w * 0.26, h * 0.36); g.lineTo(w * 0.36, h * 0.74); g.lineTo(w * 0.2, h * 0.74); g.fill();
    g.fillStyle = '#b5764b'; g.fillRect(w * 0.78, h * 0.58, w * 0.05, h * 0.16); dot(g, w * 0.805, h * 0.5, h * 0.1, '#3e8a5c'); dot(g, w * 0.78, h * 0.44, h * 0.07, '#4f9e6c');
  }],
  ['ocean', 'Open ocean', '#2f7fb5', (g, w, h) => {
    g.fillStyle = lin(g, 0, h * 0.6, [[0, '#ffd9b0'], [1, '#f6a77d']]); g.fillRect(0, 0, w, h);
    dot(g, w * 0.3, h * 0.56, h * 0.17, '#fff1d6');
    const wave = (y, a, c, f) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 6) g.lineTo(x, y + Math.sin(x / w * TAU * f) * h * a); g.lineTo(w, h); g.fill(); };
    wave(h * 0.6, 0.02, '#4f9ac7', 3); wave(h * 0.72, 0.03, '#2f7fb5', 4); wave(h * 0.86, 0.035, '#1f5f8f', 5);
    g.fillStyle = '#1f2436'; g.beginPath(); g.moveTo(w * 0.7, h * 0.6); g.lineTo(w * 0.76, h * 0.6); g.lineTo(w * 0.745, h * 0.64); g.lineTo(w * 0.715, h * 0.64); g.fill();
    g.beginPath(); g.moveTo(w * 0.73, h * 0.6); g.lineTo(w * 0.73, h * 0.38); g.lineTo(w * 0.765, h * 0.58); g.fill();
  }],
];
export const vibe = k => VIBES.find(v => v[0] === k);
/** A data URL of a vibe's picture, for the picker tiles. */
export function vibeURL(k, w = 360, h = 120) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  vibe(k)[3](c.getContext('2d'), w, h);
  return c.toDataURL('image/png');
}
