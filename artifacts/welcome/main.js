// main.js: the director. The solar system is the map: every planet is a community, and the story flies from one
// to the next. At each planet a phone slides up with that community's page on Abstracts and its post opens: a world
// opens past the phone to fill the stage, an app opens inside it. The director owns the clock, the flights, the
// headline, the controls and the sound, and talks to the Abstracts page around the artifact.
import { clamp, ease, lerp, el } from './lib/util.js';
import { TILE, W, H } from './lib/town.js';
import { phone } from './lib/ios.js';
import { createSpace } from './space.js';
import { PLANETS } from './planets.js';
import { COMMUNITIES } from './communities.js';
import { createGame } from './game.js';
import { createSound } from './sound.js';
import pixel from './forms/pixel.js';
import { poly, TOP, TILT } from './forms/scene.js';
import atlantis from './apps/atlantis.js';
import trip from './apps/trip.js';
import house from './apps/house.js';
import finale from './finale.js';

const FOCUS = 0.19;                 // a planet's radius on the stage when the camera stops at it, as a share of the short side
const BACK = 0.62;                  // and when it sits behind the phone
const FLY = 2.2, DIVE = 2.7, RISE = 1.0;
const IDLE = 45;                    // seconds without a touch before a story paused by a tap picks itself up again

const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const filming = params.get('film') === '1';   // frames are stepped from outside, one at a time (see the start section)
const $ = id => document.getElementById(id);
const stage = $('stage'), worldLayer = $('world');
const ui = { headline: $('headline'), hint: $('hint'), scrim: $('scrim'), prev: $('prev'), next: $('next'), play: $('play'), sound: $('sound'), dot: $('pill-dot'), name: $('pill-name'), kind: $('pill-kind') };
if (params.get('hud') === '0') $('hud').hidden = true;
if (params.get('hud') === 'card') stage.classList.add('card');   // the headline without the controls, for the card image
if (filming) document.documentElement.classList.add('film');

/* ---------- the page around us ---------- */
let layoutMode = parent === window ? 'viewport' : 'content';
document.documentElement.dataset.layout = layoutMode;
const postHeight = () => {
  if (parent === window || layoutMode !== 'content') return;
  const width = stage.getBoundingClientRect().width;
  if (width > 0) parent.postMessage({ abstractsHeight: Math.ceil(width * (width < 640 ? 4 / 3 : 10 / 16)) }, '*');
};
addEventListener('message', event => {
  if (event.source !== parent || parent === window) return;
  const mode = event.data?.abstractsLayout;
  if (mode !== 'content' && mode !== 'viewport') return;
  layoutMode = mode;
  document.documentElement.dataset.layout = mode;
  if (mode === 'viewport') parent.postMessage({ abstractsLayout: 'viewport' }, '*');
  else postHeight();
});
const requestLayout = () => { if (parent !== window) parent.postMessage({ abstractsLayout: 'request' }, '*'); };
requestLayout();
addEventListener('load', () => { requestLayout(); postHeight(); });
addEventListener('resize', postHeight);

/* ---------- state ---------- */
const size = { w: 1, h: 1, dpr: 1 };
let clock = 0;                      // seconds the director has run
let playing = !reduced && params.get('paused') !== '1';   // the story plays itself; false while the visitor explores
let pausedBy = null;                // 'tap' when the visitor took over by touching the island, 'button' when they pressed pause
let held = false;                   // pause was pressed during a flight: hold it where it is
let told = false;                   // the visitor has been told how to carry on with the story
let lastTouch = 0;                  // when the visitor last touched anything
let formAt = 0;                     // when the form on stage arrived
let shift = null;                   // the island changing form: { parts, i, t, to }
const S = { phase: 'intro', t: 0, to: 0, rang: false };
const sound = createSound();

let space = null;
let pickedAt = -1;                  // when a planet was last tapped
try {
  space = createSpace($('space'), PLANETS, i => {
    if (S.phase !== 'intro') return;
    const to = FORMS.findIndex(form => form.planet === i);
    pickedAt = clock;
    if (to >= 0) fly(to); else hint('Nobody lives here yet. It could be yours.', 4);
  });
}
catch (error) { console.warn('No WebGL: the story runs without space.', error); }

/* ---------- the island, the apps and the phone they open from ---------- */
const gameRoot = el('div', { class: 'game', hidden: true });
const ring = el('div', { class: 'ring', hidden: true });
const capWho = el('b'), capText = el('span');
const cap = el('p', { class: 'cap', hidden: true, role: 'status' }, capWho, capText);
const seek = el('div', { class: 'seek', hidden: true, 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 6l6 6-6 6"/></svg>' });
worldLayer.append(gameRoot);

/** The visitor has touched the story: it stops playing itself until they press play. Works at any moment. */
function take() {
  lastTouch = clock;
  if (S.phase !== 'play' || !playing) return;
  playing = false; pausedBy = 'tap'; syncUI();
  hint(told ? 'Exploring. Press play for the story.' : 'You’re exploring. Press play to carry on with the story.', told ? 3 : 6);
  told = true;
}
const api = { take, reduced, orb: () => change(), sfx: name => sound.play(name, { volume: 0.4 }) };
const FORMS = [];                   // in story order; forms on the same planet are one world changing form
for (const def of [pixel, poly, atlantis, trip, house]) {
  try {
    const inst = def.create(api);
    inst.el.hidden = true; gameRoot.append(inst.el);
    FORMS.push({ planet: 0, community: COMMUNITIES.builders, ...def, inst });
  } catch (error) { console.warn(`The ${def.id} form can't run here.`, error); }
}
const portal = phone({ community: COMMUNITIES.builders, world: true, api });   // the phone the island's post opens from
portal.root.hidden = true; gameRoot.prepend(portal.root);
gameRoot.append(ring, cap, seek);
const N = FORMS.length;
const cur = () => FORMS[game.form];
const TALK = { pixel: 'talk-pixel', poly: 'talk-bubble' };
const game = createGame(FORMS.map(form => form.id), {
  orb: () => change(),
  step: () => sound.play(`step-${cur().id}`, { volume: 0.32, rate: 0.92 + Math.random() * 0.16 }),
  say: () => { if (!shift && TALK[cur().id]) sound.play(TALK[cur().id], { volume: 0.5 }); },
});
const end = finale.create({ go: () => restart(), explore: () => planets() });
end.el.hidden = true; worldLayer.append(end.el);
const insts = FORMS.map(form => form.inst);

/** The part of the island on stage. Both of its forms show the same part, so they line up when one turns into the other. */
const view = { cx: W / 2, cy: H / 2, zoom: 48, story: false, since: 0 };
function frameView() {
  const zoom = TILE * Math.max(2, Math.round(Math.min(size.w, size.h) / 176)), p = game.pos(game.player);
  const axis = (c, span, max) => (span >= max + 6 ? max / 2 : clamp(c, span / 2 - 3, max + 3 - span / 2));
  view.zoom = zoom; view.cx = axis(p.x + 0.5, size.w / zoom, W); view.cy = axis(p.y + 0.5, size.h / zoom, H);
  view.story = playing; view.since = clock - formAt;
}
function showOnly(i) {
  const form = FORMS[i];
  for (const inst of insts) { inst.el.hidden = inst !== form.inst; inst.el.style.clipPath = ''; }
  portal.root.hidden = true; ring.hidden = true;
  form.inst.resize(size.w, size.h, size.dpr); form.inst.look?.(form.id); form.inst.enter?.(); form.inst.arrive?.(1);
}
/** Show a world only through the post's frame on the phone, wherever that is right now. */
function through(node, f) {
  node.style.clipPath = `inset(${f.y.toFixed(1)}px ${(size.w - f.x - f.w).toFixed(1)}px ${(size.h - f.y - f.h).toFixed(1)}px ${f.x.toFixed(1)}px round ${f.r.toFixed(1)}px ${f.r.toFixed(1)}px ${f.rb.toFixed(1)}px ${f.rb.toFixed(1)}px)`;
}

/* ---------- headline, hint, pill ---------- */
let said = null;                    // { words: [span], at, until }
function say(text, seconds = 3.2) {
  ui.headline.textContent = '';
  if (!text) { said = null; ui.headline.classList.remove('on'); ui.scrim.classList.remove('on'); return; }
  const words = [];
  for (const part of text.split(/(\*[^*]+\*)/).filter(Boolean)) {
    const accent = part.startsWith('*');
    for (const word of (accent ? part.slice(1, -1) : part).split(/( |\n)/)) {
      if (word === '\n') { ui.headline.append(document.createElement('br')); continue; }
      if (!word.trim()) { ui.headline.append(' '); continue; }
      const span = document.createElement('span'); span.className = 'w';
      if (accent) { const em = document.createElement('em'); em.textContent = word; span.append(em); } else span.textContent = word;
      ui.headline.append(span); words.push(span);
    }
  }
  said = { words, at: clock, until: clock + seconds };
  ui.headline.classList.add('on');
  ui.scrim.classList.toggle('on', S.phase !== 'intro' && S.phase !== 'rise');
}
function tickHeadline() {
  if (!said) return;
  const shown = Math.floor((clock - said.at) / 0.11) + 1;
  said.words.forEach((word, i) => word.classList.toggle('in', i < shown));
  if (clock > said.until) say('');
}
let hintUntil = 0;
function hint(text, seconds = 5) {
  ui.hint.textContent = text || '';
  ui.hint.classList.toggle('on', Boolean(text));
  hintUntil = text ? clock + seconds : 0;
}
const ICON = {
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
  loud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};
function syncUI() {
  const p = S.phase, form = p === 'play' || p === 'dive' || p === 'rise' ? cur() : null;
  ui.name.textContent = form ? form.name : 'Abstracts';
  ui.kind.textContent = form ? form.kind : p === 'intro' ? 'pick a planet' : '';
  ui.dot.style.background = form ? form.dot : '';
  ui.prev.disabled = !((p === 'play' && !shift) || p === 'finale');
  ui.next.disabled = !(p === 'intro' || (p === 'play' && !shift));
  ui.play.setAttribute('aria-label', playing ? 'Pause the story and explore' : 'Play the story');
  ui.play.setAttribute('aria-pressed', String(playing));
  ui.play.innerHTML = playing ? ICON.pause : ICON.play;
  ui.play.classList.toggle('pulse', !playing && p === 'play');
  ui.sound.setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on');
  ui.sound.setAttribute('aria-pressed', String(sound.on));
  ui.sound.innerHTML = sound.on ? ICON.loud : ICON.mute;
  stage.dataset.phase = p;
  if (form) stage.dataset.form = form.id;
  space?.labels((p === 'intro' || p === 'fly' || p === 'outro') && !$('hud').hidden);
  // The sea and birds on the island, a low hum in space; inside an app there is only the music.
  sound.ambience(!form || p !== 'play' ? 'amb-space' : form.inst.app ? null : 'amb-island', form ? 0.4 : 0.3);
  sound.music(p !== 'intro' || playing);
}
function setPhase(phase) { S.phase = phase; S.t = 0; hint(''); syncUI(); }

/* ---------- the narrator: he talks through each part of the story ---------- */
let voiceAt = 0, voiceName = null;
function speak(name, after = 0) { voiceName = `vo-${name}`; voiceAt = clock + after; }
function tickVoice() { if (voiceName && clock >= voiceAt) { sound.say(voiceName); voiceName = null; } }
/** What he adds once the story is inside a post: [seconds after it opened, the line]. */
const INSIDE = { pixel: [2.6, 'pixel'], poly: [7.3, 'poly-2'], atlantis: [5.2, 'atlantis-2'], trip: [4.4, 'trip-2'], house: [3.4, 'house-2'] };
let more = false;                   // that line is still to come

/* ---------- the island changing form: the 2D game becomes the 3D world ---------- */
const cover = o => Math.max(Math.hypot(o.x, o.y), Math.hypot(size.w - o.x, o.y), Math.hypot(o.x, size.h - o.y), Math.hypot(size.w - o.x, size.h - o.y)) + 4;
const circle = (node, o, r) => { node.style.clipPath = `circle(${Math.max(0, r).toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`; };
function ringAt(o, r, k) {
  ring.hidden = false;
  ring.style.width = ring.style.height = `${(r * 2).toFixed(1)}px`;
  ring.style.transform = `translate(${(o.x - r).toFixed(1)}px, ${(o.y - r).toFixed(1)}px)`;
  ring.style.opacity = String(clamp((1 - k) * 3));
}
/** The next form shows through a circle that opens from where the orb was. */
function reveal(a, b, site, before) {
  let o = null;
  return {
    len: 0.95,
    begin() {
      o = a.inst.screenOf(site.x, site.y);
      b.inst.el.hidden = false; b.inst.resize(size.w, size.h, size.dpr); b.inst.look?.(b.id); b.inst.enter?.(); before?.();
      circle(b.inst.el, o, 0);
    },
    tick(k) { const r = ease.out(k) * cover(o); circle(b.inst.el, o, r); ringAt(o, r, k); },
    end() { b.inst.el.style.clipPath = ''; if (a.inst !== b.inst) a.inst.el.hidden = true; ring.hidden = true; },
  };
}
/** The flat map is swapped for the 3D world seen from straight above, which looks the same. Then it stands up. */
function parts(a, b, site) {
  const s = b.inst.state;
  return [
    reveal(a, b, site, () => { s.tilt = TOP; s.rise = 0; }),
    { len: 1.3, tick(k) { const e = ease.inOut(k); s.tilt = lerp(TOP, TILT, e); s.rise = e; } },
  ];
}
function run(list, to) {
  shift = { parts: reduced ? [] : list, i: -1, t: 0, to };
  if (reduced) showOnly(to);
  syncUI(); nextPart();
}
function nextPart() {
  shift.i++; shift.t = 0;
  const part = shift.parts[shift.i];
  if (part) { part.begin?.(); part.tick(0); return; }
  shift = null; syncUI(); game.startChapter();
  // You may have walked on to the next orb while the world was still changing.
  if (game.player.x === game.orb.x && game.player.y === game.orb.y && game.orb.k >= 1 && !game.moving()) change();
}
/**
 * The orb has been touched. If the next form is on the same planet, the world changes form around you and you can
 * keep walking through it. Otherwise the post closes and the story flies to the next planet.
 */
function change() {
  if (shift || S.phase !== 'play') return;
  const from = game.form, to = from + 1;
  hint(''); sound.play('orb', { volume: 0.7 });
  if (to >= N || FORMS[to].planet !== FORMS[from].planet) { depart(to); return; }
  const site = { x: game.orb.x, y: game.orb.y }, list = parts(FORMS[from], FORMS[to], site);
  game.hopOrb(to); game.form = to; formAt = clock; more = true;
  sound.play('shift-poly', { volume: 0.8 }); speak('poly', 0.5);
  say(FORMS[to].headline, list.reduce((sum, part) => sum + part.len, 0) + 1.7);
  run(list, to);
}

/* ---------- flying between planets ---------- */
/** Fly to the planet of form `to`. Its community's headline says who it is for. */
function fly(to = 0) {
  if (S.phase !== 'intro' && S.phase !== 'rise') return;
  const form = FORMS[to];
  S.to = to; introCue = INTRO.length;
  space?.go({ planet: form.planet, fill: FOCUS }, FLY * 0.68);   // there with time to read who it is for
  setPhase('fly');
  say(form.community.audience, FLY - 0.1); speak(to === 0 ? 'builders' : form.id, 0.3);   // gone as the phone comes up
  sound.play('dive', { volume: 0.45 });
}
/** At the planet: the phone comes up with the community's page, and its post opens. */
function land(to) {
  const form = FORMS[to];
  gameRoot.hidden = false; gameRoot.style.opacity = '';
  showOnly(to); game.form = to; game.frozen = true; formAt = clock; S.rang = false;
  if (form.inst.app) form.inst.arrive(0);
  else { portal.root.hidden = false; portal.fit(size.w, size.h); portal.arrive(0); through(form.inst.el, portal.frameAt()); }
  space?.go({ planet: form.planet, fill: BACK }, DIVE * 0.7, ease.inOut);
  setPhase('dive');
}
function arrived() {
  const form = cur();
  setPhase('play'); formAt = clock; more = true;
  if (form.inst.app) { form.inst.arrive(1); if (!playing) hint('Try it. The orb takes you to the next planet.', 5); return; }
  form.inst.el.style.clipPath = ''; portal.root.hidden = true;
  game.frozen = false; game.startChapter(1.6);
  say(form.headline, 2.8); hint('Tap to walk, or use the arrow keys', 6);
}
/** Close the post and leave this planet, for form `to` or, after the last one, for the whole system. */
function depart(to) {
  const form = cur();
  S.to = to; game.frozen = true; game.release();
  if (!form.inst.app) { portal.root.hidden = false; portal.fit(size.w, size.h); portal.leave(0); }
  space?.go({ planet: form.planet, fill: FOCUS }, RISE, ease.out);
  sound.play('leave', { volume: 0.45 });
  setPhase('rise');
}
/** Go straight to a form, without the flight. */
function jump(i) {
  if (shift || S.phase !== 'play' || i < 0) return;
  if (i >= N) { depart(N); return; }
  const form = FORMS[i];
  showOnly(i); game.setForm(i); game.frozen = Boolean(form.inst.app); formAt = clock; more = false;
  space?.go({ planet: form.planet, fill: BACK }, 0);
  say(form.inst.app ? form.community.audience : form.headline, 2.2); syncUI();
}
function outro() {
  setPhase('outro');
  space?.go({ planet: null }, 2.6);
  say('Every planet is\na *community.*', 4); speak('outro', 0.4);
}

/* ---------- the story ---------- */
const INTRO = [[0.5, 'Welcome to\n*Abstracts.*', 9, 'intro-1'], [2.2, 'Every planet is\na *community.*', 9, 'intro-2'], [4.1, 'Let’s dive\n*into one.*', 9, 'intro-3']];
let introCue = 0, sting = false;
function restart() {
  end.el.hidden = true; gameRoot.hidden = true;
  game.reset(); introCue = 0; playing = !reduced; pausedBy = null; held = false;
  space?.go({ planet: null }, 0);
  setPhase('intro');
}
/** Out to the whole system with the story paused: tap any planet to visit it. */
function planets() {
  end.el.hidden = true; gameRoot.hidden = true; shift = null;
  game.reset(); introCue = INTRO.length; playing = false; pausedBy = 'button'; held = false;
  space?.go({ planet: null }, 1.2);
  setPhase('intro'); say('Every planet is\na *community.*', 1e9); hint('Tap a planet to visit it', 8);
}
/** Back into the story with it paused, to look around as long as you like. */
function explore(i = 0) {
  end.el.hidden = true; gameRoot.hidden = false;
  setPhase('play'); playing = false; pausedBy = 'button';
  jump(i);
}

function tick(dt) {
  clock += dt;
  if (hintUntil && clock > hintUntil) hint('');
  tickHeadline(); tickVoice();
  const p = S.phase;
  // Pause pressed during a flight holds it where it is.
  if (held && (p === 'fly' || p === 'dive' || p === 'rise' || p === 'outro')) return;
  S.t += dt;
  if (p === 'intro') {
    if (!playing) { S.t -= dt; if (introCue === 0) { say('Every planet is\na *community.*', 1e9); introCue = INTRO.length; } }
    while (introCue < INTRO.length && S.t >= INTRO[introCue][0]) { const [, text, seconds, voice] = INTRO[introCue++]; say(text, seconds); if (voice) speak(voice); }
    if (playing && S.t > 5.4) fly(0);
  } else if (p === 'fly') {
    if (S.t >= FLY) land(S.to);
  } else if (p === 'dive') {
    const k = clamp(S.t / DIVE), form = cur();
    game.update(dt, false);
    if (form.inst.app) form.inst.arrive(k); else { portal.arrive(k); through(form.inst.el, portal.frameAt()); }
    if (!S.rang && k > 0.6) { S.rang = true; sound.play('open', { volume: 0.6 }); }
    if (k >= 1) arrived();
  } else if (p === 'play') {
    if (shift) { shift.t += dt; const part = shift.parts[shift.i], k = clamp(shift.t / part.len); part.tick(k); if (k >= 1) { part.end?.(); nextPart(); } }
    if (!playing && pausedBy === 'tap' && clock - lastTouch > IDLE && !game.moving() && !shift) { playing = true; pausedBy = null; syncUI(); hint('Back to the story', 3); }
    game.update(dt, playing && !shift);
    const line = INSIDE[cur().id];
    if (more && playing && line && clock - formAt >= line[0]) { more = false; speak(line[1]); }
    if (playing && !shift && cur().inst.app && cur().inst.pilot(dt)) change();   // the story has shown this app: on to the next planet
    const at = `${game.player.x},${game.player.y}`;
    if (stage.dataset.at !== at) stage.dataset.at = at;
  } else if (p === 'rise') {
    const k = clamp(S.t / RISE), form = cur();
    game.update(dt, false);
    if (form.inst.app) form.inst.leave(k); else { portal.leave(k); through(form.inst.el, portal.frameAt()); }
    if (k >= 1) {
      for (const inst of insts) { inst.el.hidden = true; inst.el.style.clipPath = ''; }
      portal.root.hidden = true; gameRoot.hidden = true;
      if (S.to >= N) outro(); else fly(S.to);
    }
  } else if (p === 'outro') {
    if (S.t > 4.6) { end.el.hidden = false; end.el.style.opacity = '0'; end.resize?.(size.w, size.h); end.enter(); sting = false; S.rang = false; setPhase('finale'); }
  } else if (p === 'finale') {
    end.el.style.opacity = String(clamp(S.t / 1.2)); end.update(dt);
    if (S.t > 0.8 && !S.rang) { S.rang = true; speak('finale-1'); }
    if (S.t > 6.1 && !sting) { sting = true; sound.play('finale', { volume: 0.5 }); speak('finale-2', 0.5); }
  }
  if (space && spaceOn()) space.update(dt);
}
/** Space is drawn whenever it can be seen: between planets, and behind a phone that leaves room around it. */
function spaceOn() {
  const p = S.phase;
  if (p === 'finale') return S.t <= 1.3;
  if (p !== 'play') return true;
  const inst = cur().inst;
  return Boolean(inst.app && !inst.bare());
}
function render() {
  if (space && spaceOn()) space.render();
  if (gameRoot.hidden) return;
  frameView();
  for (const inst of insts) if (!inst.el.hidden) inst.render(game, view);
  drawCaption(); drawSeek();
}

/* ---------- what things say, and the way to the orb ---------- */
const LAYOUT = { pixel: 'box', poly: 'bubble' };   // only the island's forms have things that speak
let capShown = null;
function drawCaption() {
  const c = game.cap, form = cur(), layout = LAYOUT[form.id];
  if (!c || !layout || shift || S.phase !== 'play') { cap.hidden = true; capShown = null; return; }
  if (capShown !== c) { capShown = c; capWho.textContent = c.who; capText.textContent = ''; cap.dataset.layout = layout; cap.dataset.form = form.id; cap.hidden = false; }
  const typed = layout === 'box' ? Math.min(c.text.length, Math.floor((game.t - c.at) * 60)) : c.text.length;
  if (capText.textContent.length !== typed) capText.textContent = c.text.slice(0, typed);
  if (layout !== 'bubble') { cap.style.transform = ''; return; }
  const who = c.anchor === 'buddy' ? game.pos(game.buddy) : c.anchor, at = form.inst.screenOf(who.x, who.y, 1.45);
  const half = cap.offsetWidth / 2 + 8;
  cap.style.transform = `translate(${clamp(at.x, half, size.w - half).toFixed(1)}px, ${Math.max(cap.offsetHeight + 8, at.y).toFixed(1)}px) translate(-50%, -100%)`;
}
function drawSeek() {
  const form = cur(), orb = game.orbPos();
  if (S.phase !== 'play' || shift || form.inst.app || !orb.landed) { seek.hidden = true; return; }
  const at = form.inst.screenOf(orb.x, orb.y), pad = 28;
  const x = clamp(at.x, pad, size.w - pad), y = clamp(at.y, pad, size.h - 118);
  if (Math.hypot(at.x - x, at.y - y) < 24) { seek.hidden = true; return; }
  seek.hidden = false;
  seek.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${Math.atan2(at.y - y, at.x - x).toFixed(3)}rad)`;
}

/* ---------- controls ---------- */
const click = (button, act) => button.addEventListener('click', () => { sound.unlock(); sound.play('ui', { volume: 0.5 }); act(); });
click(ui.prev, () => { if (S.phase === 'finale') explore(N - 1); else if (game.form > 0) jump(game.form - 1); else planets(); });   // back from the first post is back out to the planets
click(ui.next, () => { if (S.phase === 'intro') fly(0); else jump(game.form + 1); });
click(ui.play, () => {
  playing = !playing; pausedBy = playing ? null : 'button'; held = !playing && ['fly', 'dive', 'rise', 'outro'].includes(S.phase);
  hint(playing || S.phase !== 'play' ? '' : cur().inst.app ? 'Paused. Try it yourself, or press play.' : 'Paused. Walk anywhere, or press play.', 4); syncUI();
  if (playing && S.phase === 'intro' && introCue >= INTRO.length) fly(0);   // the opening lines are over: play goes straight in
});
ui.sound.addEventListener('click', () => { sound.toggle(); syncUI(); sound.play('ui', { volume: 0.5 }); });
$('space').addEventListener('click', () => { if (S.phase === 'intro' && pickedAt !== clock) fly(0); });   // a tap on no planet starts the story
// The first touch of any kind lets the browser play sound.
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { const was = sound.on; sound.unlock(); lastTouch = clock; if (sound.on !== was) syncUI(); }, { capture: true });
for (const type of ['pointermove', 'wheel']) stage.addEventListener(type, () => { lastTouch = clock; }, { capture: true, passive: true });
stage.addEventListener('scroll', () => { lastTouch = clock; }, { capture: true, passive: true });
// A tap walks you there. A drag is left alone, so the page around the artifact can still be scrolled.
let down = null;
gameRoot.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY, ui: Boolean(event.target.closest('[data-ui]')) }; });
gameRoot.addEventListener('pointercancel', () => { down = null; });
gameRoot.addEventListener('pointerup', event => {
  const from = down; down = null;
  if (!from || S.phase !== 'play' || Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10) return;
  take();
  if (from.ui) return;
  const box = stage.getBoundingClientRect(), spot = cur().inst.pick(event.clientX - box.left, event.clientY - box.top);
  if (spot) game.tap(spot.x, spot.y);
});
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const button = event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
  if (button && (event.key === ' ' || event.key === 'Enter')) return;
  if (S.phase === 'intro' && (event.key === ' ' || event.key === 'Enter')) { fly(0); event.preventDefault(); }
  else if (S.phase === 'play' && !cur().inst.app && game.key(event)) { take(); event.preventDefault(); }
});
addEventListener('keyup', event => game.keyup(event));
addEventListener('blur', () => game.release());

/* ---------- size and loop ---------- */
function layout() {
  const box = stage.getBoundingClientRect();
  if (!box.width || !box.height) return;
  size.w = box.width; size.h = box.height; size.dpr = Math.min(devicePixelRatio || 1, 2);
  space?.resize(size.w, size.h, size.dpr);
  for (const inst of insts) inst.resize(size.w, size.h, size.dpr);
  portal.fit(size.w, size.h);
  end.resize?.(size.w, size.h);
  postHeight();
}
new ResizeObserver(layout).observe(stage);
layout();

let visible = true, onScreen = true, last = 0, raf = 0;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
  try { tick(dt); render(); } catch (error) { console.error(error); }
  if (visible && onScreen) raf = requestAnimationFrame(frame);
}
const wake = () => {
  sound.sleep(!(visible && onScreen));
  if (!raf && visible && onScreen && !filming) { last = 0; raf = requestAnimationFrame(frame); }
};
document.addEventListener('visibilitychange', () => { visible = !document.hidden; wake(); });
new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; wake(); }).observe(stage);

/* ---------- start (with switches for pictures and checks: ?form=trip&paused=1, ?form=poly&at=8,9&ff=6) ---------- */
space?.go({ planet: null }, 0);
syncUI();
const startForm = FORMS.findIndex(form => form.id === params.get('form'));
if (startForm >= 0) {
  introCue = INTRO.length; gameRoot.hidden = false;
  space?.update(0); setPhase('play'); jump(startForm); say('');
  const [ax, ay] = (params.get('at') || '').split(',').map(Number);
  if (Number.isFinite(ax) && Number.isFinite(ay)) Object.assign(game.player, { x: ax, y: ay, fx: ax, fy: ay });
} else if (params.get('form') === 'finale') { introCue = INTRO.length; end.el.hidden = false; end.enter(); setPhase('finale'); }
const part = params.get('dive');    // ?form=trip&dive=0.5 holds the way in to a post half done, for pictures
if (startForm >= 0 && part != null) { land(startForm); S.t = DIVE * Number(part); tick(0); held = true; }
const cam = params.get('cam');       // ?cam=0.3,0.6,0.1 sets the whole-system view by hand: tilt, zoom, sideways shift
if (cam && space) { const [tilt, zoom, side] = cam.split(',').map(Number); space.frame(tilt, zoom || 1, side || 0); }
const hold = params.get('hold');     // ?hold=3.6,5.6,0.5,3.5,5.9 stops each planet at an angle
if (hold && space) space.hold(hold.split(',').map(Number));
const look = params.get('view');     // ?view=storm:0.3 holds the camera on one planet, for pictures
if (look && space) {
  const [id, fill] = look.split(':');
  introCue = INTRO.length; playing = false; S.t = 0;
  space.update(0); space.go({ planet: Math.max(0, PLANETS.findIndex(planet => planet.id === id)), fill: Number(fill) || 0.3 }, 0);
  syncUI();
}
const forward = Number(params.get('ff') || 0);
for (let t = 0; t < forward; t += 1 / 30) tick(1 / 30);
// ?film=1: nothing moves by itself. A filming script calls film.step() once for each frame and takes a picture.
if (filming) {
  const state = () => ({ t: clock, phase: S.phase, since: S.t, form: S.phase === 'play' ? cur().id : '' });
  window.film = { step(dt = 1 / 30) { tick(dt); render(); return state(); }, skip(dt = 1 / 30) { tick(dt); return state(); } };
}
wake();
