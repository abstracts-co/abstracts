// ios.js: an iPhone showing a community's page on Abstracts, and the post on that page opening. This is how the
// story dives into each planet: the phone slides up with the community's real page (cover, name, About, Wall,
// Artifacts), the page scrolls to the post, and the post opens. An app opens to fill the phone, in a light iOS
// look of its own, so it never reads as part of the island game. A world opens past the phone to fill the stage.
// It also holds the parts iOS apps are made of: a large title, grouped lists, a segmented control, a tab bar.
import { el, clamp, lerp, ease } from './util.js';
import { drawPerson, drawRobot } from './town.js';

/** The people in the examples. They are made up; [colour, initial]. */
export const PEOPLE = { maya: ['#ff6b9d', 'M'], sam: ['#ff9f0a', 'S'], kenji: ['#32ade6', 'K'], lina: ['#bf5af2', 'L'], omar: ['#30d158', 'O'], zoe: ['#ffd60a', 'Z'], you: ['#ff453a', 'You'] };
/** A round face for a member. `agent` marks it as that member's AI, the way Abstracts badges agents. */
export function face(name, agent = false) {
  const [color, initial] = PEOPLE[name] || ['#8e8e93', '?'];
  return el('span', { class: `io-face${agent ? ' io-face--ai' : ''}${name === 'you' ? ' io-face--you' : ''}`, style: `background:${color}`, title: agent ? `${name}'s AI` : name }, initial);
}
export const who = (name, agent) => (name === 'you' ? 'You' : `${name[0].toUpperCase()}${name.slice(1)}${agent ? '’s AI' : ''}`);
export const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  thumb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 10h4v11H2zM8 21h9.2a2 2 0 0 0 2-1.6l1.7-7.4A2 2 0 0 0 18.9 9.6H14l.8-4.3A2.3 2.3 0 0 0 12.5 2.6L8 10z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8zM18 13l1 2.9 3 1.1-3 1-1 3-1-3-3-1 3-1.1z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.500A1.500 1.500 0 0 1 20 11.500V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.500A1.500 1.500 0 0 1 5.500 10zm2.200 0h5.600V7a2.800 2.800 0 0 0-5.600 0z"/></svg>',
  out: svg('<path d="M9 5h10v10M19 5L6 18"/>', 'stroke-width="2.400"'),
};
const DOCK = [svg('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>'), svg('<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>'), svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15zM10 20a2 2 0 0 0 4 0"/>'), svg('<circle cx="12" cy="8" r="4"/><path d="M4.500 20c1-4 4-5.500 7.500-5.500s6.500 1.500 7.500 5.500"/>')];

const CSS = `
.io { background: none !important; pointer-events: none; }
.io-phone { position: absolute; left: 0; top: 0; pointer-events: auto; background: #1a0705; color: #fff; overflow: hidden; font-family: var(--sans); -webkit-font-smoothing: antialiased; line-height: 1.3; will-change: transform; }
.io-phone[data-mode="device"] { border: .5em solid #0b0b0f; border-radius: 3.1em; box-shadow: 0 0 0 .1em #3c3c44, 0 2.4em 4.5em -1.2em rgb(0 0 0 / .8); }
.io-phone[data-mode="bare"] { border-radius: 1.4em 1.4em 0 0; }
.io-phone[data-mode="bare"][data-fill="no"] { border-radius: 1.4em; box-shadow: 0 0 0 1px rgb(255 255 255 / .14), 0 1.6em 3em -1em rgb(0 0 0 / .8); }
.io-island { position: absolute; left: 50%; top: .62em; width: 5.800em; height: 1.650em; margin-left: -2.900em; border-radius: 1em; background: #000; z-index: 6; }
.io-phone[data-mode="bare"] .io-island, .io-phone[data-mode="bare"] .io-home { display: none; }
.io-status { position: absolute; left: 0; right: 0; top: 0; height: 2.900em; display: flex; align-items: center; justify-content: space-between; padding: .25em 1.900em 0 2.100em; font: 600 .95em -apple-system, "SF Pro Text", system-ui, sans-serif; z-index: 5; pointer-events: none; transition: color .25s ease; }
.io-phone[data-mode="bare"] .io-status { display: none; }
.io-phone.open .io-status { color: #000; }
.io-status svg { height: .78em; width: auto; display: block; }
.io-status span { display: flex; gap: .32em; align-items: center; }
.io-home { position: absolute; left: 50%; bottom: .42em; width: 8.600em; height: .32em; margin-left: -4.300em; border-radius: 1em; background: rgb(255 255 255 / .55); z-index: 6; pointer-events: none; }
.io-phone.open .io-home { background: rgb(0 0 0 / .32); }

/* the community's page on Abstracts */
.io-site { position: absolute; inset: 0; background: radial-gradient(120% 34% at 22% 61%, rgb(232 120 30 / .85), transparent 70%), radial-gradient(130% 60% at 50% 0%, #7d1c10 0%, #45100a 46%, #1c0806 100%); }
.io-flow { position: absolute; left: 0; right: 0; top: 0; padding: 5.300em .65em 0; will-change: transform; }
.io-phone[data-mode="bare"] .io-flow { padding-top: 3.100em; }
.io-top { position: absolute; left: 0; right: 0; top: 0; z-index: 3; display: flex; align-items: center; justify-content: center; height: 5.500em; padding: 2.700em 0 .4em; box-sizing: border-box; font-weight: 700; font-size: 1em; background: linear-gradient(180deg, #761a0f 0%, #6a180e 90%, rgb(106 24 14 / 0)); }
.io-phone[data-mode="bare"] .io-top { height: 3.300em; padding-top: .5em; }
.io-top::before { content: ""; position: absolute; left: 1.500em; width: .55em; height: .55em; border-left: .14em solid #fff; border-bottom: .14em solid #fff; transform: rotate(45deg); opacity: .85; }
.io-comm { padding: .5em; border-radius: 1.750em; background: rgb(28 18 14 / .74); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .13); }
.io-cover { height: 6.900em; border-radius: 1.300em; overflow: hidden; }
.io-cover svg, .io-pic svg { display: block; width: 100%; height: 100%; }
.io-row { display: flex; align-items: flex-end; gap: .6em; margin: -2.300em .55em 0; }
.io-pic { flex: none; width: 4.700em; height: 4.700em; border-radius: 1.150em; overflow: hidden; box-shadow: 0 0 0 .22em rgb(28 18 14); }
.io-join { margin-left: auto; display: inline-flex; align-items: center; gap: .35em; height: 2.550em; padding: 0 1.200em; border-radius: 2em; font-weight: 700; font-size: .95em; color: #2b1105; background: linear-gradient(180deg, #ffb84d, #ff7a14 58%, #e4480f); box-shadow: inset 0 1px 0 rgb(255 255 255 / .45); }
.io-join--in { color: #fff; background: rgb(255 255 255 / .14); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .16); }
.io-join svg { width: .95em; height: .95em; }
.io-dots { align-self: center; margin-bottom: .2em; letter-spacing: .12em; font-weight: 800; opacity: .8; }
.io-name { margin: .55em .6em .25em; font-weight: 800; font-size: 1.220em; letter-spacing: -.01em; }
.io-desc { margin: 0 .6em; font-size: .95em; line-height: 1.42; color: rgb(255 255 255 / .82); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.io-meta { display: flex; align-items: center; gap: .4em; margin: .55em .6em 0; font-size: .82em; color: rgb(255 255 255 / .62); }
.io-meta svg { width: 1em; height: 1em; }
.io-sections { display: grid; grid-template-columns: repeat(3, 1fr); margin: .7em .25em .2em; padding: .22em; border-radius: 1.400em; background: rgb(255 255 255 / .07); font-weight: 600; font-size: .92em; text-align: center; }
.io-sections span { padding: .55em 0; border-radius: 1.200em; color: rgb(255 255 255 / .82); }
.io-sections span:first-child { color: #fff; background: rgb(255 255 255 / .16); box-shadow: inset 0 1px 0 rgb(255 255 255 / .18); }
.io-dock { position: absolute; left: 1.100em; right: 1.100em; bottom: 1.300em; height: 3.300em; display: grid; grid-template-columns: repeat(4, 1fr); place-items: center; border-radius: 2em; background: rgb(28 18 14 / .7); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .16); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.io-phone[data-mode="bare"] .io-dock { bottom: .5em; }
.io-phone[data-dock="off"] .io-dock { display: none; }
.io-dock--over { left: 0; right: auto; top: 0; bottom: auto; z-index: 8; will-change: transform; }
.io-dock svg { width: 1.350em; height: 1.350em; opacity: .9; }
/* the post on the page: its frame opens to fill the phone */
.io-frame { position: absolute; left: 0; top: 0; overflow: hidden; background: #000; will-change: transform, width, height; z-index: 2; }
.io-frame--world { background: none; box-shadow: inset 0 0 0 1px rgb(255 255 255 / .2); }
.io-tap { position: absolute; left: 0; top: 0; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgb(255 255 255 / .35); box-shadow: 0 0 0 2px rgb(255 255 255 / .8); z-index: 9; pointer-events: none; opacity: 0; }

/* the parts of an iOS app */
.io-app { position: absolute; inset: 0; display: flex; flex-direction: column; background: #f2f2f7; color: #000; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif; }
.io-nav { flex: none; padding: 3.100em 1em .55em; }
.io-phone[data-mode="bare"] .io-nav { padding-top: 1.100em; }
.io-nav-row { display: flex; align-items: flex-end; gap: .6em; }
.io-where { display: flex; align-items: center; gap: .32em; margin: 0 0 .1em; font-weight: 600; font-size: .8em; color: var(--tint); }
.io-where svg { width: .95em; height: .95em; }
.io-where i { font-style: normal; color: #8e8e93; font-weight: 500; }
.io-title { flex: 1; min-width: 0; margin: 0; font-weight: 800; font-size: 1.900em; line-height: 1.08; letter-spacing: -.022em; }
.io-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 1em 1.200em; scrollbar-width: none; }
.io-scroll::-webkit-scrollbar { display: none; }
.io-head { margin: 1.200em .9em .45em; font-size: .78em; letter-spacing: .02em; text-transform: uppercase; color: #6d6d72; }
.io-foot { margin: .5em .9em 0; font-size: .78em; color: #6d6d72; }
.io-group { margin: 0; padding: 0; list-style: none; background: #fff; border-radius: .78em; overflow: hidden; }
.io-cell { display: flex; align-items: center; gap: .7em; min-height: 2.750em; padding: .55em .9em; }
.io-cell + .io-cell { box-shadow: inset 0 .5px 0 #d1d1d6; }
.io-cell.pop { animation: io-pop .5s ease; }
@keyframes io-pop { 35% { background: #fff3c4; } }
.io-cell-text { flex: 1; min-width: 0; }
.io-cell-text small { display: block; margin-top: .1em; font-size: .8em; color: #8e8e93; }
.io-cell-side { flex: none; font-size: .9em; color: #8e8e93; font-variant-numeric: tabular-nums; }
.io-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: .75em 0; padding: .13em; border-radius: .58em; background: rgb(118 118 128 / .13); }
.io-seg button, .io-tabs button, .io-vote, .io-pill, .io-navbtn { appearance: none; border: 0; cursor: pointer; font: inherit; color: inherit; background: none; }
.io-seg button { height: 1.950em; border-radius: .46em; font-weight: 600; font-size: .84em; }
.io-seg button[aria-selected="true"] { background: #fff; box-shadow: 0 .1em .3em rgb(0 0 0 / .14), 0 0 0 .5px rgb(0 0 0 / .04); }
.io-tabs { flex: none; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: .35em 0 1.250em; background: rgb(249 249 249 / .94); box-shadow: inset 0 .5px 0 #c6c6c8; }
.io-phone[data-mode="bare"] .io-tabs { padding-bottom: .45em; }
.io-phone[data-orb="over"] .io-tabs { padding-right: 9.400em; }   /* room for the orb at the end of the bar */
.io-tabs button { display: grid; justify-items: center; gap: .12em; font-weight: 500; font-size: .64em; color: #999; }
.io-tabs button svg { width: 2.250em; height: 2.250em; }
.io-tabs button[aria-selected="true"] { color: var(--tint); }
.io-vote { flex: none; display: inline-flex; align-items: center; gap: .35em; height: 2em; padding: 0 .75em; border-radius: 1em; font-weight: 600; font-size: .9em; font-variant-numeric: tabular-nums; color: var(--tint); background: rgb(118 118 128 / .12); transition: transform .15s ease; }
.io-vote svg { width: 1em; height: 1em; }
.io-vote[aria-pressed="true"] { color: #fff; background: var(--tint); }
.io-vote:active, .io-pill:active, .io-navbtn:active { transform: scale(.94); }
.io-pill { flex: none; height: 2em; padding: 0 .9em; border-radius: 1em; font-weight: 600; font-size: .86em; background: #fff; color: #000; }
.io-pill[aria-pressed="true"] { background: var(--tint); color: #fff; }
.io-navbtn { flex: none; display: inline-flex; align-items: center; height: 2em; padding: 0 .85em; margin-bottom: .2em; border-radius: 1em; font-weight: 600; font-size: .88em; color: #fff; background: var(--tint); }
.io-ai { display: flex; gap: .65em; align-items: flex-start; padding: .7em .85em; border-radius: .95em; font-size: .9em; line-height: 1.32; background: linear-gradient(135deg, #f1e7ff, #e3f1ff); box-shadow: inset 0 0 0 1px rgb(175 82 222 / .2); }
.io-ai > svg { flex: none; width: 1.350em; height: 1.350em; margin-top: .05em; color: #af52de; }
.io-ai b { font-weight: 700; }
.io-link { color: var(--tint); text-decoration: none; font-weight: 500; }
.io-face { position: relative; display: inline-grid; place-items: center; flex: none; width: 1.750em; height: 1.750em; border-radius: 50%; font-weight: 700; font-size: .92em; color: #fff; text-shadow: 0 .5px 1px rgb(0 0 0 / .25); }
.io-face--you { font-size: .62em; width: 2.600em; height: 2.600em; }
.io-face--ai::after { content: "AI"; position: absolute; right: -.5em; bottom: -.3em; padding: .08em .3em; border-radius: .5em; font-weight: 800; font-size: .52em; color: #fff; background: #af52de; box-shadow: 0 0 0 1.500px #fff; text-shadow: none; }
.io-stack { display: flex; flex: none; margin-bottom: .25em; }
.io-stack .io-face { margin-left: -.42em; box-shadow: 0 0 0 2px #f2f2f7; }
.io-app :focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }
.io [hidden] { display: none !important; }
/* beside the phone: you and your agent, and the orb that takes you on */
.io-us { position: absolute; left: 0; top: 0; width: 76px; height: 46px; image-rendering: pixelated; filter: drop-shadow(0 4px 8px rgb(0 0 0 / .6)); will-change: transform; }
.io-orb { appearance: none; position: absolute; left: 0; top: 0; pointer-events: auto; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px 0 7px; border-radius: 999px; border: 0; font: 800 14px/1 var(--sans); white-space: nowrap; color: #2b1105; background: linear-gradient(180deg, #ffb84d, #ff7a14 58%, #e4480f); box-shadow: inset 0 1px 0 rgb(255 255 255 / .45), 0 10px 22px -8px #e4480f; animation: io-pulse 1.600s ease-in-out infinite; will-change: transform; z-index: 3; }
.io-orb i { width: 30px; height: 30px; border-radius: 50%; background: radial-gradient(circle at 50% 30%, #fff6cf, #ffd766 40%, #ff8a1f 80%); box-shadow: 0 0 0 2px rgb(255 255 255 / .55), 0 0 14px 2px rgb(255 214 102 / .8); }
.io-orb:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.io-orb[data-side="over"] { height: 38px; padding: 0 13px 0 6px; gap: 7px; font-size: 13px; }
.io-orb[data-side="over"] i { width: 26px; height: 26px; }
.io-orb[data-side="beside"] { flex-direction: column; gap: 7px; height: auto; padding: 0; border-radius: 0; font-size: 12px; color: #fff; text-shadow: 0 1px 8px #000; background: none; box-shadow: none; animation: none; }
.io-orb[data-side="beside"] i { width: 48px; height: 48px; animation: io-glow 1.600s ease-in-out infinite; }
@keyframes io-glow { 50% { box-shadow: 0 0 0 2px rgb(255 255 255 / .55), 0 0 0 9px rgb(255 138 31 / .3), 0 0 22px 6px rgb(255 214 102 / .9); } }
@keyframes io-pulse { 50% { box-shadow: inset 0 1px 0 rgb(255 255 255 / .45), 0 0 0 7px rgb(255 138 31 / .28), 0 10px 22px -8px #e4480f; } }
@media (prefers-reduced-motion: reduce) { .io-orb, .io-orb i, .io-cell.pop { animation: none !important; } }
`;
const BARS = '<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.500" width="3" height="6.500" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></svg>';
const WIFI = '<svg viewBox="0 0 17 12" fill="currentColor"><path d="M8.500 2.600c2.300 0 4.400.9 6 2.400l1.100-1.200A10.300 10.300 0 0 0 8.500 1 10.300 10.300 0 0 0 1.400 3.800l1.100 1.200a8.700 8.700 0 0 1 6-2.400zm0 3.500c1.300 0 2.500.5 3.400 1.300l1.100-1.200a6.700 6.700 0 0 0-9 0l1.100 1.200c.9-.8 2.100-1.300 3.400-1.300zm0 3.300c-.6 0-1.100.2-1.500.6l1.500 1.700L10 10c-.4-.4-.9-.6-1.500-.6z"/></svg>';
const BATTERY = '<svg viewBox="0 0 27 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="19" height="8" rx="1.800" fill="currentColor"/><path d="M24 4v4c.8-.3 1.500-1.100 1.500-2S24.800 4.300 24 4z" fill="currentColor" opacity=".45"/></svg>';

/**
 * community: an entry of COMMUNITIES. tint: the app's colour. world: true when the post is a world that opens
 * past the phone (then there is no app inside, and frameAt() says where the world should show through).
 * api.orb() is called when the orb is pressed.
 */
export function phone({ community, tint = '#007aff', world = false, api }) {
  const app = el('div', { class: 'io-app', style: `--tint:${tint}` });
  const frame = el('div', { class: `io-frame${world ? ' io-frame--world' : ''}` }, world ? null : app);
  const flow = el('div', { class: 'io-flow' },
    el('section', { class: 'io-comm' },
      el('div', { class: 'io-cover', html: community.cover }),
      el('div', { class: 'io-row' }, el('div', { class: 'io-pic', html: community.avatar }),
        el('span', { class: `io-join${community.locked ? ' io-join--in' : ''}`, html: community.locked ? `${ICON.lock}Member` : 'Join' }), el('span', { class: 'io-dots' }, '···')),
      el('h3', { class: 'io-name' }, community.slug), el('p', { class: 'io-desc' }, community.description),
      el('p', { class: 'io-meta', html: community.locked ? `${ICON.lock}Members only · ${community.members} members` : `${svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')}Public community` }),
      el('div', { class: 'io-sections' }, el('span', {}, 'About'), el('span', {}, 'Wall'), el('span', {}, 'Artifacts'))));
  const dock = el('div', { class: `io-dock${world ? ' io-dock--over' : ''}`, 'aria-hidden': 'true', html: DOCK.join('') });   // over a world it floats above it, as on the real page
  const site = el('div', { class: 'io-site', 'aria-hidden': 'true' }, flow, el('div', { class: 'io-top' }, community.slug), world ? null : dock);
  const tap = el('i', { class: 'io-tap' });
  const device = el('div', { class: 'io-phone', 'data-ui': true }, site, frame, el('div', { class: 'io-island' }),
    el('div', { class: 'io-status', 'aria-hidden': 'true', html: `9:41<span>${BARS}${WIFI}${BATTERY}</span>` }), el('div', { class: 'io-home' }));
  const us = el('canvas', { class: 'io-us', width: 38, height: 23, 'aria-hidden': 'true' });
  const g = us.getContext('2d');
  drawRobot(g, 2, 6, 0, 2); drawPerson(g, 20, 6, 2, 0, 'coral');
  const orb = el('button', { class: 'io-orb', type: 'button', 'data-ui': true, 'aria-label': 'Touch the orb to fly to the next planet', onclick: () => api.orb() }, el('i'), 'Next planet');
  const root = el('div', { class: 'io' }, el('style', {}, CSS), device, us, orb, world ? dock : null, tap);

  let box = { x: 0, y: 0, w: 340, h: 700 }, mode = 'device', stage = { w: 1, h: 1 }, em = 16, edge = 0, docked = true;
  let up = 1, scroll = 1, open = 1;           // how far the phone has slid up, the page has scrolled and the post has opened: each 0..1
  const inner = () => ({ w: box.w - edge * 2, h: box.h - edge * 2 });
  /** Where the post's frame is inside the phone's screen right now. */
  function frameIn() {
    const s = inner(), top = flow.offsetHeight + em * 0.6, rest = em * (mode === 'bare' ? 7.3 : 9.5), gap = em * 0.65;
    const y = lerp(top, rest, scroll), h = s.h - rest - em * (!docked ? 0.7 : mode === 'bare' ? 4.3 : 5.1);
    // an app opens to fill the phone's screen; a world opens past the phone, to fill the stage
    const full = world ? { x: -box.x - edge, y: -box.y - edge, w: stage.w, h: stage.h } : { x: 0, y: 0, w: s.w, h: s.h };
    return { x: lerp(gap, full.x, open), y: lerp(y, full.y, open), w: lerp(s.w - gap * 2, full.w, open), h: lerp(h, full.h, open), r: lerp(em * 1.75, 0, open), slide: lerp(top, rest, scroll) - top };
  }
  function place() {
    const drop = (1 - up) * (stage.h - box.y + 30), f = frameIn();
    device.style.transform = `translate(${box.x.toFixed(1)}px, ${(box.y + drop).toFixed(1)}px)`;
    flow.style.transform = `translateY(${f.slide.toFixed(1)}px)`;
    frame.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px)`;
    frame.style.width = `${f.w.toFixed(1)}px`; frame.style.height = `${f.h.toFixed(1)}px`; frame.style.borderRadius = `${f.r.toFixed(1)}px`;
    site.style.opacity = world ? '1' : String(1 - open);
    device.classList.toggle('open', !world && open > 0.5);
    device.style.opacity = world ? String(1 - open) : '';
    // an app keeps the size it has when open, and shows through the frame like a window while the frame is small
    if (!world) { const s = inner(); app.style.width = `${s.w}px`; app.style.height = `${s.h}px`; app.style.transform = `translate(${(-f.x).toFixed(1)}px, ${(-f.y * 0.35).toFixed(1)}px)`; }
    if (world) {
      dock.style.display = docked ? '' : 'none'; dock.style.fontSize = `${em.toFixed(2)}px`; dock.style.width = `${(inner().w - em * 2.2).toFixed(1)}px`; dock.style.opacity = String(1 - open);
      dock.style.transform = `translate(${(box.x + edge + em * 1.1).toFixed(1)}px, ${(box.y + drop + box.h - edge - em * (mode === 'bare' ? 3.8 : 4.6)).toFixed(1)}px)`;
    }
    const margin = stage.w - box.x - box.w, beside = margin >= 100, seen = world ? 0 : up * open;
    us.style.display = beside ? '' : 'none';
    us.style.transform = `translate(${(box.x - 86).toFixed(1)}px, ${(box.y + box.h - 52 + drop).toFixed(1)}px)`;
    // beside the phone when there is a margin, in the middle of it; otherwise at the end of the app's tab bar
    orb.dataset.side = device.dataset.orb = beside ? 'beside' : 'over';
    orb.style.transform = beside ? `translate(${(box.x + box.w + (margin - orb.offsetWidth) / 2).toFixed(1)}px, ${(box.y + box.h - 150 + drop).toFixed(1)}px)` : `translate(${(box.x + box.w - orb.offsetWidth - 10).toFixed(1)}px, ${(box.y + box.h - 46 + drop).toFixed(1)}px)`;
    orb.style.opacity = us.style.opacity = String(seen); orb.style.pointerEvents = seen > 0.9 ? 'auto' : 'none';
  }
  return {
    root, app, community,
    /** The top of an app: its large title, and anything for the right-hand side. */
    nav(title, side) {
      return el('header', { class: 'io-nav' }, el('p', { class: 'io-where', html: community.locked ? ICON.lock : '' }, community.slug, community.locked ? el('i', {}, '· Private') : null),
        el('div', { class: 'io-nav-row' }, el('h2', { class: 'io-title' }, title), side || null));
    },
    /** Size the phone for the stage: a device with room around it, or the whole stage when it is narrow. */
    fit(w, h) {
      stage = { w, h };
      mode = w >= 520 && h >= 600 ? 'device' : 'bare';
      if (mode === 'device') {
        let ph = Math.min(h - 82, 760), pw = ph * 0.49;
        if (pw > w - 210) { pw = w - 210; ph = pw / 0.49; }
        box = { x: (w - pw) / 2, y: Math.max(10, (h - 60 - ph) / 2), w: pw, h: ph };
      } else if (w >= 520) box = { x: (w - 360) / 2, y: 12, w: 360, h: h - 12 - 64 };   // wide but short: a card as wide as a phone
      else box = { x: 0, y: 34, w, h: h - 34 - 56 };
      em = Math.max(11, Math.min(18, (mode === 'device' ? box.w - 16 : box.w) / 340 * 16)); edge = mode === 'device' ? em * 0.5 : 0;
      docked = mode === 'device' || h >= 600;      // a short screen has no room for the page's dock
      device.dataset.mode = mode; device.dataset.dock = docked ? 'on' : 'off'; device.dataset.fill = box.w >= w ? 'yes' : 'no';
      device.style.width = `${box.w.toFixed(1)}px`; device.style.height = `${box.h.toFixed(1)}px`; device.style.fontSize = `${em.toFixed(2)}px`;
      place();
    },
    /**
     * The way in, 0..1: the phone slides up with the community's page, the page scrolls to the post, a tap lands
     * on it, and the post opens.
     */
    arrive(k) {
      up = ease.out(clamp(k / 0.26)); scroll = ease.inOut(clamp((k - 0.34) / 0.24)); open = ease.inOut(clamp((k - 0.7) / 0.3));
      const f = frameIn(), press = clamp((k - 0.58) / 0.14);
      tap.style.opacity = String(press > 0 && press < 1 ? Math.sin(press * Math.PI) : 0);
      tap.style.transform = `translate(${(box.x + edge + f.x + f.w / 2).toFixed(1)}px, ${(box.y + edge + f.y + f.h * 0.42).toFixed(1)}px) scale(${(1.25 - press * 0.45).toFixed(2)})`;
      place();
    },
    /** The way out, 0..1: the post closes back into the page, then the phone slides away. */
    leave(k) { open = 1 - ease.inOut(clamp(k / 0.5)); up = 1 - ease.in(clamp((k - 0.45) / 0.55)); scroll = 1; tap.style.opacity = '0'; place(); },
    /** True when the phone hides everything behind it, so space need not be drawn. */
    bare: () => mode === 'bare' && box.w >= stage.w,
    /** How far the post has opened, 0..1. */
    opened: () => open,
    /** Where the post's frame is on the stage, and how round its corners are: a world shows through exactly there. */
    frameAt() {
      const f = frameIn(), drop = (1 - up) * (stage.h - box.y + 30), y = box.y + edge + f.y + drop;
      // until it opens, it ends where the phone's screen ends
      const floor = lerp(box.y + box.h - edge + drop, stage.h, open), cut = y + f.h > floor + 0.5;
      return { x: box.x + edge + f.x, y, w: f.w, h: Math.max(0, Math.min(f.h, floor - y)), r: f.r, rb: cut ? lerp(mode === 'device' ? em * 2 : box.w < stage.w ? em * 0.9 : 0, 0, open) : f.r };
    },
    /** Where the orb is on the stage, for anything that needs to point at it. */
    orbAt() { const a = orb.getBoundingClientRect(), b = root.getBoundingClientRect(); return { x: a.left - b.left + 22, y: a.top - b.top + 22 }; },
  };
}
