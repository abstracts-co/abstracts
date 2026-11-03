// The guestbook pages talk to abstracts.co through the artifact bridge (artifact.json "bridge": ["entries"]):
// https://abstracts.co/kit/abstracts/references/web-artifacts.md#guest-book
// abstracts.co keeps the entries and asks the visitor to confirm each one; this page only lists them and asks to add.
import { GUEST } from './pages.js';

const INKS = ['#1f1a17', '#d1453b', '#e8863a', '#3f9a5a', '#2f6fd6', '#7a4fc9'];
const WIDTHS = [2, 4, 8];
const $ = id => document.getElementById(id);
const ed = { form: $('guest'), name: $('guest-name'), pad: $('guest-pad'), draw: $('guest-draw'), msg: $('guest-msg'), add: $('guest-add'), tip: $('guest-tip') };
const send = message => parent.postMessage({ ...message, v: 1 }, '*');

let changed = () => {};
let ready = false;
let listing = null;
let spot = null, mode = 'text', ink = INKS[0], width = 4, strokes = [], line = null;

/* ---------- entries ---------- */

function relist() {
  listing = new Map();
  send({ type: 'abstracts:entries:list' });
}
function update() {
  GUEST.version++;
  changed();
}

addEventListener('message', e => {
  const m = e.data;
  if (e.source !== parent || !m || m.v !== 1 || typeof m.type !== 'string') return;
  if (m.type === 'abstracts:entries:ready' && !ready) {
    ready = true;
    GUEST.status = 'ready';
    update();
    relist();
  } else if (m.type === 'abstracts:entries:list' && listing && Array.isArray(m.entries)) {
    for (const entry of m.entries) listing.set(entry.id, entry);
    if (m.next_cursor) { send({ type: 'abstracts:entries:list', cursor: m.next_cursor }); return; }
    GUEST.entries = [...listing.values()];
    listing = null;
    update();
  } else if (m.type === 'abstracts:entries:added') {
    close();
    relist();
  } else if (m.type === 'abstracts:entries:changed') {
    relist();
  } else if (m.type === 'abstracts:entries:cancelled') {
    busy(false);
  } else if (m.type === 'abstracts:entries:error') {
    busy(false);
    if (m.error !== 'busy') say(m.message || 'That didn’t work. Try again.');
  }
});

export function startGuest(onChange) {
  changed = onChange;
  const outside = () => { if (!ready) { GUEST.status = 'outside'; update(); } };
  if (parent === window) outside(); else setTimeout(outside, 2500);
}

/* ---------- the editor ---------- */

export const editing = () => !ed.form.hidden;

function say(text) { ed.msg.textContent = text; }
function busy(on) { ed.add.disabled = on; ed.form.classList.toggle('is-busy', on); }

function setMode(next) {
  mode = next;
  for (const b of ed.form.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  ed.name.hidden = mode !== 'text';
  ed.draw.hidden = mode !== 'draw';
  say('');
  if (mode === 'text') ed.name.focus({ preventScroll: true }); else paint();
}

export function openEditor(at) {
  spot = { x: at.x, y: at.y };
  strokes = []; line = null;
  ed.name.value = '';
  busy(false);
  ed.form.hidden = false;
  setMode(mode);
}

function close() {
  ed.form.hidden = true;
  spot = null;
  busy(false);
  say('');
}

function paint() {
  const r = ed.pad.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const size = Math.round(r.width) || 200;
  if (ed.pad.width !== size * dpr) ed.pad.width = ed.pad.height = size * dpr;
  const g = ed.pad.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  g.lineCap = g.lineJoin = 'round';
  for (const s of strokes) {
    g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.width * size / 200;
    g.beginPath();
    if (s.points.length === 2) { g.arc(s.points[0] * size, s.points[1] * size, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); continue; }
    for (let i = 0; i < s.points.length; i += 2) g.lineTo(s.points[i] * size, s.points[i + 1] * size);
    g.stroke();
  }
}

const at = e => {
  const r = ed.pad.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height].map(n => +Math.min(1, Math.max(0, n)).toFixed(3));
};
const points = () => strokes.reduce((n, s) => n + s.points.length / 2, 0);
ed.pad.addEventListener('pointerdown', e => {
  if (points() >= 1900) { say('That’s a full drawing.'); return; }
  ed.pad.setPointerCapture(e.pointerId);
  line = { color: ink, width, points: at(e) };
  strokes.push(line);
  paint();
});
ed.pad.addEventListener('pointermove', e => {
  if (!line || points() >= 1900) return;
  const [x, y] = at(e), p = line.points;
  if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) > 0.012) { p.push(x, y); paint(); }
});
for (const type of ['pointerup', 'pointercancel']) ed.pad.addEventListener(type, () => { line = null; });

for (const color of INKS) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'guest-ink' });
  b.style.setProperty('--ink', color);
  b.setAttribute('aria-label', `Ink ${color}`);
  b.setAttribute('aria-pressed', String(color === ink));
  b.addEventListener('click', () => { ink = color; for (const o of $('guest-inks').children) o.setAttribute('aria-pressed', String(o === b)); });
  $('guest-inks').append(b);
}
for (const w of WIDTHS) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'guest-width' });
  b.style.setProperty('--w', `${w + 2}px`);
  b.setAttribute('aria-label', ['Thin', 'Medium', 'Thick'][WIDTHS.indexOf(w)]);
  b.setAttribute('aria-pressed', String(w === width));
  b.addEventListener('click', () => { width = w; for (const o of $('guest-widths').children) o.setAttribute('aria-pressed', String(o === b)); });
  $('guest-widths').append(b);
}
for (const b of ed.form.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
$('guest-clear').addEventListener('click', () => { strokes = []; paint(); });
$('guest-cancel').addEventListener('click', close);
ed.form.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
ed.form.addEventListener('submit', e => {
  e.preventDefault();
  if (!spot || ed.add.disabled) return;
  const text = ed.name.value.trim();
  if (mode === 'text' ? !text : !strokes.length) { say(mode === 'text' ? 'Write your name first.' : 'Draw something first.'); return; }
  say('');
  busy(true);
  send({ type: 'abstracts:entries:add', entry: mode === 'text' ? { ...spot, text } : { ...spot, strokes } });
});

/* ---------- who signed ---------- */

export function showTip(text, clientX, clientY) {
  const r = ed.tip.parentElement.getBoundingClientRect();
  ed.tip.textContent = text;
  ed.tip.hidden = false;
  ed.tip.style.left = `${Math.min(r.width - 12, Math.max(12, clientX - r.left))}px`;
  ed.tip.style.top = `${Math.max(12, clientY - r.top - 14)}px`;
}
export function hideTip() { ed.tip.hidden = true; }
