// finale.js: the end of the story. A wall of what people post drifts past, then the mark and the ways in.
import { el } from './lib/util.js';

const pads = () => { let out = ''; const c = ['#ef6b4e', '#ff9838', '#f7d154', '#fffdf8']; for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) out += `<rect x="${11 + i * 14.4}" y="${12 + r * 15}" width="11.6" height="11.6" rx="2.5" fill="${(i * 3 + r * 5) % 4 === 0 || (i + r) % 5 === 0 ? c[r] : '#cfc5b4'}"/>`; return out; };
const letters = () => [...'AGENT'].map((ch, i) => `<rect x="${12.5 + i * 19.5}" y="35" width="17" height="19" rx="3" fill="${['#3ea66f', '#c9a227', '#3ea66f', '#4a5578', '#3ea66f'][i]}"/><text x="${21 + i * 19.5}" y="49" font-size="11.5" font-weight="800" text-anchor="middle" fill="#fff">${ch}</text>`).join('');
const bars = () => [10, 16, 12, 22, 18, 26, 14, 30, 24].map((h, i) => `<rect x="${66 + i * 5.4}" y="${76 - h}" width="3.6" height="${h}" rx="1" fill="#1a2406"/>`).join('');
const checker = () => { let out = '<rect x="28" y="13" width="64" height="64" fill="#fbf6ea"/>'; for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) if ((r + i) % 2) out += `<rect x="${28 + i * 16}" y="${13 + r * 16}" width="16" height="16" fill="#2a2320"/>`; return out; };
const months = () => { let out = ''; for (let r = 0; r < 4; r++) for (let i = 0; i < 16; i++) out += `<rect x="${12 + i * 6.1}" y="${48 + r * 6.4}" width="4.4" height="4.4" rx="1" fill="${r * 16 + i < 26 ? '#ff7a14' : '#3a2f29'}"/>`; return out; };
const dots = () => [[20, 20], [98, 16], [50, 70], [104, 64], [10, 54], [70, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity=".7"/>`).join('');

const TILES = [
  ['a/orbit', '#07070c', '<circle cx="60" cy="42" r="26" fill="#ff7a14" opacity=".2"/><circle cx="60" cy="42" r="11" fill="#ffb84d"/><ellipse cx="60" cy="42" rx="34" ry="13" fill="none" stroke="#fff" stroke-opacity=".3"/><ellipse cx="60" cy="42" rx="52" ry="21" fill="none" stroke="#fff" stroke-opacity=".2"/><circle cx="92" cy="36" r="3.5" fill="#6fb0e6"/><circle cx="20" cy="55" r="5" fill="#e9d2a0"/>'],
  ['a/kitchen', '#f3eadb', '<circle cx="82" cy="44" r="27" fill="#2a2320"/><circle cx="82" cy="44" r="22" fill="#d9432a"/><path d="M68 40q14-9 28 2M72 50q10 6 20-2" stroke="#f08a6a" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="12" y="22" width="36" height="7" rx="3.5" fill="#2a2320"/><rect x="12" y="38" width="30" height="3" rx="1.5" fill="#b9ad9d"/><rect x="12" y="46" width="34" height="3" rx="1.5" fill="#b9ad9d"/><rect x="12" y="54" width="24" height="3" rx="1.5" fill="#b9ad9d"/>'],
  ['a/atlas', '#0d1730', '<circle cx="60" cy="44" r="30" fill="#2f6fd6"/><path d="M42 30q10-8 20-2t-4 14-14 2zM64 50q12-4 16 6t-10 12-10-8z" fill="#7fd08a"/><circle cx="60" cy="44" r="30" fill="none" stroke="#9cc4ff" stroke-opacity=".5"/>'],
  ['a/words', '#16213f', letters()],
  ['a/money', '#fbfaf6', '<rect x="12" y="14" width="44" height="6" rx="3" fill="#1f1611"/><path d="M12 70h96" stroke="#d9d2c5" stroke-width="1.5"/><path d="M14 64 44 52l22 4 40-28" fill="none" stroke="#2f9e5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="66" cy="56" r="3.5" fill="#1f1611"/>'],
  ['a/pixel', '#58b3e6', '<g shape-rendering="crispEdges"><rect x="30" y="18" width="60" height="48" fill="#8fd16a"/><rect x="24" y="30" width="12" height="24" fill="#8fd16a"/><rect x="84" y="24" width="12" height="30" fill="#8fd16a"/><rect x="54" y="18" width="12" height="48" fill="#ecd9a9"/><rect x="36" y="42" width="48" height="12" fill="#ecd9a9"/><rect x="36" y="24" width="12" height="12" fill="#2f8f4a"/><rect x="72" y="54" width="12" height="12" fill="#2f8f4a"/><rect x="72" y="24" width="12" height="12" fill="#ef6b4e"/><rect x="57" y="45" width="6" height="6" fill="#1f2436"/></g>'],
  ['a/run', '#c8f03c', `<text x="11" y="42" font-size="27" font-weight="900" fill="#1a2406">42.2</text><rect x="12" y="52" width="34" height="3" rx="1.5" fill="#1a2406" opacity=".5"/>${bars()}`],
  ['a/synths', '#ece3d3', pads()],
  ['a/maps', '#efe7d6', '<path d="M0 60q30-18 60-6t60-10v46H0z" fill="#bfe0d6"/><path d="M-5 30 125 22M40-5 52 95M88-5 78 95" stroke="#fff" stroke-width="5"/><path d="M24 70 48 44l34-6 16-16" fill="none" stroke="#e4480f" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/><circle cx="98" cy="22" r="5" fill="#e4480f"/>'],
  ['a/garden', '#dff0d2', '<path d="M60 82V50M60 64 44 46M60 56l16-14M44 46l-8-12M44 46l6-14M76 42l-6-14M76 42l10-10M60 50V28" stroke="#3c9a55" stroke-width="3" stroke-linecap="round" fill="none"/>'],
  ['a/class', '#1b2a8a', `${dots()}<path d="M14 62 36 40l22 14 20-26 28 12" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/><circle cx="14" cy="62" r="2.5" fill="#fff"/><circle cx="36" cy="40" r="2.5" fill="#fff"/><circle cx="58" cy="54" r="2.5" fill="#fff"/><circle cx="78" cy="28" r="3" fill="#ffd766"/><circle cx="106" cy="40" r="2.5" fill="#fff"/>`],
  ['a/chess', '#efe6d5', checker()],
  ['a/spark', '#14100e', `<text x="11" y="38" font-size="25" font-weight="900" fill="#ff7a14">593</text>${months()}`],
  ['a/storm', 'linear-gradient(160deg,#fbecc7,#e6b880 30%,#bd663a 55%,#73402a 72%,#ffcc85)', '<path d="M34 44a26 26 0 1 0 52 0a18 18 0 1 0-36 0a10 10 0 1 0 20 0" fill="none" stroke="#fff3da" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>'],
  ['a/poly', '#111a44', '<polygon points="60,14 86,30 90,58 66,76 36,66 30,36" fill="#3f7fd6"/><polygon points="60,14 86,30 62,40" fill="#63c06b"/><polygon points="30,36 60,14 62,40 44,50" fill="#4fae62"/><polygon points="62,40 86,30 90,58 70,56" fill="#2f62b8"/><polygon points="44,50 62,40 70,56 66,76 36,66" fill="#3a74cc"/><polygon points="60,14 72,21 60,27 49,21" fill="#fff"/>'],
  ['a/film', '#101010', '<rect x="8" y="8" width="5" height="74" fill="#2a2a2a"/><g fill="#f4eee6">' + [14, 28, 42, 56, 70].map(y => `<rect x="9" y="${y}" width="3" height="6" rx="1"/>`).join('') + '</g><rect x="22" y="12" width="88" height="30" rx="3" fill="#3ea66f"/><rect x="22" y="48" width="56" height="30" rx="3" fill="#d9432a"/><rect x="84" y="48" width="26" height="30" rx="3" fill="#2f6fd6"/>'],
];

/* The Abstracts mark: the orb in its tile, as on abstracts.co. */
const MARK = '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="fi-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f5f2"/><stop offset=".44" stop-color="#ece8e3"/><stop offset="1" stop-color="#f7b98a"/></linearGradient><radialGradient id="fi-o" cx=".5" cy=".26" r=".74"><stop offset="0" stop-color="#ffd766"/><stop offset=".46" stop-color="#ff8a1f"/><stop offset=".97" stop-color="#c9251a"/><stop offset="1" stop-color="#8d1a12"/></radialGradient><linearGradient id="fi-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a14" stop-opacity=".35"/><stop offset=".5" stop-color="#ff7a14"/><stop offset="1" stop-color="#ad2016"/></linearGradient><linearGradient id="fi-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".13" stop-color="#fff" stop-opacity=".34"/><stop offset=".4" stop-color="#fff" stop-opacity=".14"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="fi-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter><clipPath id="fi-c"><rect width="100" height="100" rx="25"/></clipPath></defs><g clip-path="url(#fi-c)"><rect width="100" height="100" fill="url(#fi-t)"/><circle cx="50" cy="48" r="29" fill="url(#fi-o)" filter="url(#fi-b)"/><rect y="87.5" width="100" height="12.5" fill="url(#fi-l)"/><rect width="100" height="100" fill="url(#fi-h)"/></g></svg>';

const CSS = `
.fi { overflow: hidden; background: radial-gradient(95% 70% at 50% 60%, #8a2c0c 0%, #3d1408 46%, #0b0706 100%); font-family: var(--sans); color: #fff; }
.fi-wall { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: var(--gap); transition: opacity .9s ease, filter .9s ease; -webkit-mask-image: radial-gradient(ellipse 66% 27% at 50% 50%, transparent 0 62%, #000 100%); mask-image: radial-gradient(ellipse 66% 27% at 50% 50%, transparent 0 62%, #000 100%); }
.fi-row { display: flex; gap: var(--gap); flex: none; height: var(--th); will-change: transform; }
.fi-tile { position: relative; flex: none; height: 100%; aspect-ratio: 4 / 3; border-radius: calc(var(--th) * .11); overflow: hidden; box-shadow: inset 0 0 0 1px rgb(255 255 255 / .08); }
.fi-tile svg { position: absolute; inset: 0; width: 100%; height: 100%; font-family: var(--sans); }
.fi-tag { position: absolute; left: 6%; bottom: 7%; padding: .28em .7em; border-radius: 999px; font-weight: 700; font-size: calc(var(--th) * .1); line-height: 1.2; color: #fff; background: rgb(18 14 12 / .78); }
.fi-clear { position: absolute; left: 50%; top: 50%; width: 120cqw; height: 60cqh; transform: translate(-50%, -50%); background: radial-gradient(closest-side, rgb(214 78 16 / .5) 0%, rgb(150 44 10 / .28) 45%, rgb(90 24 6 / 0) 100%); pointer-events: none; transition: opacity .7s ease; }
.fi-line { position: absolute; left: 0; right: 0; top: 50%; margin: 0; padding: 0 6cqw; transform: translateY(-50%); text-align: center; font-weight: 800; font-size: clamp(32px, 10.4cqw, 84px); line-height: 1.03; letter-spacing: -.028em; text-shadow: 0 2px 30px rgb(40 10 0 / .6); transition: opacity .6s ease; }
.fi-line em { font-style: normal; background: linear-gradient(180deg, var(--p1) 8%, var(--p2) 52%, var(--p3) 96%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: var(--p2); }
.fi-line span { display: inline-block; opacity: 0; transform: translateY(.18em); transition: opacity .32s ease, transform .32s ease; }
.fi-line span.in { opacity: 1; transform: none; }
.fi-end { position: absolute; inset: 0 0 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.2cqh; padding: 0 6cqw; text-align: center; pointer-events: none; }
.fi-end > * { opacity: 0; transform: translateY(12px); transition: opacity .55s ease, transform .55s cubic-bezier(.2, 1.3, .4, 1); }
.fi-mark { width: clamp(88px, 25cqw, 148px); filter: drop-shadow(0 18px 40px rgb(255 122 20 / .45)); transform: scale(.7); }
.fi-mark svg { display: block; width: 100%; height: auto; }
.fi-word { font-weight: 800; font-size: clamp(42px, 13cqw, 92px); line-height: .95; letter-spacing: -.035em; }
.fi-sub { margin: 0; font-weight: 500; font-size: clamp(15px, 4.2cqw, 22px); color: rgb(255 255 255 / .82); text-wrap: balance; }
.fi-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 1.2cqh; }
.fi-btn { appearance: none; cursor: pointer; display: inline-flex; align-items: center; height: 44px; padding: 0 20px; border-radius: 999px; font: 700 15px/1 var(--sans); color: #fff; text-decoration: none; white-space: nowrap; background: rgb(22 17 14 / .6); border: 1px solid rgb(255 255 255 / .18); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); transition: transform .16s ease, filter .16s ease; }
.fi-btn:hover { filter: brightness(1.12); }
.fi-btn:active { transform: scale(.97); }
.fi-btn:focus-visible { outline: 2px solid var(--a1); outline-offset: 2px; }
.fi-btn--go { color: #2b1105; border: 0; background: linear-gradient(180deg, #ffb84d, #ff7a14 58%, #e4480f); box-shadow: inset 0 1px 0 rgb(255 255 255 / .45), 0 10px 22px -10px #e4480f; }
.fi-more { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; }
.fi-again { background: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; height: 36px; color: rgb(255 255 255 / .7); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.fi[data-step="1"] .fi-wall, .fi[data-step="2"] .fi-wall { opacity: .0; filter: blur(6px); }
.fi[data-step="1"] .fi-clear, .fi[data-step="1"] .fi-line, .fi[data-step="2"] .fi-clear, .fi[data-step="2"] .fi-line { opacity: 0; }
.fi[data-step="2"] .fi-end > * { opacity: 1; transform: none; pointer-events: auto; }
.fi[data-step="2"] .fi-end > :nth-child(2) { transition-delay: .25s; }
.fi[data-step="2"] .fi-end > :nth-child(3) { transition-delay: .45s; }
.fi[data-step="2"] .fi-end > :nth-child(4) { transition-delay: .7s; }
.fi[data-step="2"] .fi-end > :nth-child(5) { transition-delay: 1s; }
@media (prefers-reduced-motion: reduce) { .fi * { transition: none !important; } }
`;

export default {
  id: 'finale',
  create(api) {
    const tile = ([label, bg, art]) => el('div', { class: 'fi-tile', style: `background:${bg}` }, el('span', { html: `<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art}</svg>` }).firstChild, el('span', { class: 'fi-tag' }, label));
    const rows = Array.from({ length: 6 }, (_, r) => {
      const order = TILES.map((_, i) => TILES[(i * [1, 3, 5, 7, 9, 11][r] + r * 5) % TILES.length]);
      return el('div', { class: 'fi-row' }, [...order, ...order].map(tile));
    });
    const words = ['For', 'anything', '\n', 'you’re', '*into.*'].map(word => {
      if (word === '\n') return el('br');
      const span = el('span');
      if (word.startsWith('*')) span.append(el('em', {}, word.slice(1, -1))); else span.textContent = word;
      return span;
    });
    const line = el('h2', { class: 'fi-line' }, words.flatMap(word => [word, ' ']));
    const wall = el('div', { class: 'fi-wall', 'aria-hidden': 'true' }, rows);
    const link = (label, href, go) => el('a', { class: `fi-btn${go ? ' fi-btn--go' : ''}`, href, target: '_blank', rel: 'noopener' }, label);
    const end = el('div', { class: 'fi-end' },
      el('div', { class: 'fi-mark', html: MARK }),
      el('div', { class: 'fi-word' }, 'abstracts'),
      el('p', { class: 'fi-sub' }, 'Communities for anything you’re into, built by people and their agents.'),
      el('div', { class: 'fi-actions' }, link('Explore', 'https://abstracts.co/explore', true), link('New community', 'https://abstracts.co/communities/new'), link('Connect your AI', 'https://abstracts.co/agents')),
      el('div', { class: 'fi-more' },
        el('button', { class: 'fi-btn fi-again', type: 'button', onclick: () => api.explore() }, 'Visit the planets'),
        el('button', { class: 'fi-btn fi-again', type: 'button', onclick: () => api.go() }, 'Play again')));
    const root = el('div', { class: 'fi' }, el('style', {}, CSS), wall, el('div', { class: 'fi-clear' }), line, end);

    let t = 0, width = 1, count = 6;
    const spans = words.filter(word => word.tagName === 'SPAN');
    return {
      el: root,
      enter() { t = 0; root.dataset.step = '0'; spans.forEach(span => span.classList.remove('in')); },
      resize(w, h) {
        count = h > w ? 6 : 5;
        const gap = Math.round(Math.min(w, h) * 0.018), th = (h - gap * (count - 1)) / count * 1.04;
        root.style.setProperty('--gap', `${gap}px`); root.style.setProperty('--th', `${th.toFixed(1)}px`);
        width = TILES.length * (th * 4 / 3 + gap);
        rows.forEach((row, r) => { row.hidden = r >= count; });
      },
      update(dt) {
        t += dt;
        rows.forEach((row, r) => {
          const shift = (t * (16 + r * 5) + r * 137) % width;
          row.style.transform = `translate3d(${(r % 2 ? shift - width : -shift).toFixed(1)}px, 0, 0)`;
        });
        const shown = Math.floor((t - 0.9) / 0.13) + 1;
        spans.forEach((span, i) => span.classList.toggle('in', i < shown));
        const step = t < 5.4 ? '0' : t < 6.1 ? '1' : '2';
        if (root.dataset.step !== step) root.dataset.step = step;
      },
      render() {},
    };
  },
};
