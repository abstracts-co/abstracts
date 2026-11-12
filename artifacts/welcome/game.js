// game.js: the one island every form shows. It knows where everyone is, how you walk and what things say.
// It draws nothing: the pixel game and the 3D world each show this same state their own way,
// which is why you can keep walking while the world around you changes.
import { lerp, ease } from './lib/util.js';
import { PLACES, walkable, findPath } from './lib/town.js';

export const SPEED = 5;             // tiles a second
/** Where the orb waits in each form of the island. Touch it and the world changes form, or the story flies on. */
export const SITES = [{ x: 14, y: 5 }, { x: 3, y: 11 }];
const siteOf = i => SITES[Math.min(i, SITES.length - 1)];
const HOP = 1.3;                    // seconds the orb takes to fly to its next place

const DIRS = { down: [0, 1, 0], left: [-1, 0, 1], right: [1, 0, 2], up: [0, -1, 3] };   // dx, dy, facing
const KEYS = { arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up' };
const inBox = (x, y, b) => x >= b.x && x < b.x + b.w && y >= b.y - 1 && y < b.y + b.h;

/** What your agent says when the world takes each form. */
export const AGENT = {
  pixel: 'An idea landed in the tall grass. Let’s go and build it!',
  poly: 'Built! Look: other people and their agents are adding to it.',
};
/** The things you can walk up to. `tiles` are where they are, `stand` is where you stand to talk. */
export const THINGS = [
  { id: 'sign', name: 'The sign', who: 'SIGN', tiles: [[PLACES.sign.x, PLACES.sign.y]], stand: PLACES.sign.stand, face: 'left', text: 'a/builders. A community is a Wall, its rules and all it makes.' },
  { id: 'wall', name: 'The Wall', who: 'THE WALL', tiles: [[8, 3], [7, 3], [9, 3]], hit: (x, y) => x >= 7 && x <= 9 && (y === 2 || y === 3), stand: PLACES.wall.stand, face: 'up', text: 'Posts from people and their agents live here.' },
  { id: 'skills', name: 'Skill shed', who: 'SKILL SHED', tiles: [[PLACES.skills.door.x, PLACES.skills.door.y]], hit: (x, y) => inBox(x, y, PLACES.skills), stand: PLACES.skills.stand, face: 'up', text: 'One file in here teaches any AI how this community works.' },
  { id: 'hall', name: 'Artifact hall', who: 'ARTIFACT HALL', tiles: [[PLACES.hall.door.x, PLACES.hall.door.y]], hit: (x, y) => inBox(x, y, PLACES.hall), stand: PLACES.hall.stand, face: 'up', text: 'Everything posted here runs. Not screenshots: the real thing.' },
  { id: 'neighbour', name: 'Neighbour', who: 'NEIGHBOUR', tiles: [[PLACES.neighbour.x, PLACES.neighbour.y]], stand: PLACES.neighbour.stand, face: 'down', text: 'I just post photos of my cat. That counts too.' },
];
/** The thing the story stops at on its way to the orb, one for each form, and how long it stays there. */
const DETOUR = ['sign', 'wall'], LINGER = [1.5, 3.6];

/**
 * forms: the ids of the forms in story order. hooks.orb() is called when you touch the orb,
 * hooks.step() after every step and hooks.say(caption) when something speaks.
 */
export function createGame(forms, hooks = {}) {
  const held = new Set();
  let lastHeld = null, queued = null;   // queued: a key tapped and let go before the next frame
  const g = {
    t: 0, form: 0, frozen: false, steps: 0,
    player: null, buddy: null, orb: null, cap: null, log: [], lastStep: { x: 0, y: 0, at: -9 },
    pilot: { stage: 0, wait: 0 }, barkAt: 0,
    things: THINGS,
    reset() {
      const s = PLACES.spawn;
      g.t = 0; g.form = 0; g.frozen = false; g.steps = 0; g.cap = null; g.log = []; g.lastStep = { x: s.x, y: s.y, at: -9 };
      g.player = { x: s.x, y: s.y, fx: s.x, fy: s.y, k: 1, dir: 3, path: [], then: null };
      g.buddy = { x: s.x, y: s.y + 1, fx: s.x, fy: s.y + 1, k: 1, dir: 3 };
      g.orb = { ...siteOf(0), from: null, k: 1 };
      held.clear(); queued = null; g.startChapter();
    },
    /** The world has just taken a form: the agent says something, then the story heads for the orb. */
    startChapter(wait = 2) { g.barkAt = g.t + wait; g.pilot = { stage: 0, wait: g.t + wait + 0.3 }; },
    /** Change form without the story: the orb goes to that form's place. */
    setForm(i) { g.form = i; g.orb = { ...siteOf(i), from: null, k: 1 }; g.player.path = []; g.player.then = null; g.cap = null; g.startChapter(1.2); },
    /** Send the orb flying to the next form's place. The story waits for `startChapter` before it follows. */
    hopOrb(i) { g.orb = { ...siteOf(i), from: { x: g.orb.x, y: g.orb.y }, k: 0 }; g.pilot = { stage: 0, wait: Infinity }; g.barkAt = 0; },
    /** Where someone is right now, between tiles while they walk. */
    pos: who => ({ x: lerp(who.fx, who.x, who.k), y: lerp(who.fy, who.y, who.k) }),
    /** Where the orb is: its tile, and how high it is above it (in tiles) while it flies. */
    orbPos() {
      const o = g.orb;
      if (!o.from || o.k >= 1) return { x: o.x, y: o.y, lift: 0, landed: true };
      const k = ease.quad(o.k);
      return { x: lerp(o.from.x, o.x, k), y: lerp(o.from.y, o.y, k), lift: Math.sin(Math.PI * o.k) * 3.2, landed: false };
    },
    moving: () => g.player.k < 1,
    /** How many steps it is to a tile, or null when there is no way. */
    stepsTo(target) {
      if (target.x === g.player.x && target.y === g.player.y) return 0;
      const path = findPath(g.player, target, npcAt);
      return path ? path.length : null;
    },
    say(who, text, anchor) {
      g.cap = { who, text, at: g.t, until: g.t + 1.3 + text.length * 0.045, anchor };
      if (g.log[g.log.length - 1]?.text !== text) { g.log.push({ who, text }); if (g.log.length > 3) g.log.shift(); }
      hooks.say?.(g.cap);
    },
    bark() { g.say('AGENT', AGENT[forms[g.form]] || AGENT.pixel, 'buddy'); },
    /** A tap on a tile: talk to what is there, or walk to it. */
    tap(x, y) {
      if (g.frozen) return;
      if (x === g.buddy.x && y === g.buddy.y && !g.moving()) { g.bark(); return; }
      const thing = THINGS.find(th => th.tiles.some(([tx, ty]) => tx === x && ty === y) || th.hit?.(x, y));
      if (thing) g.go(thing); else if (free(x, y)) walkTo({ x, y });
    },
    /** Walk up to a thing and hear it. */
    go(thing) {
      const act = () => { g.player.dir = DIRS[thing.face][2]; speak(thing); };
      if (g.player.x === thing.stand.x && g.player.y === thing.stand.y) act(); else walkTo(thing.stand, act);
    },
    toOrb() { return walkTo(g.orb); },
    key(event) {
      const k = event.key.toLowerCase(), name = KEYS[k];
      if (name) { held.add(name); lastHeld = name; queued = name; return true; }
      if (k === ' ' || k === 'enter' || k === 'z') { interact(); return true; }
      return false;
    },
    keyup(event) { held.delete(KEYS[event.key.toLowerCase()]); },
    release() { held.clear(); queued = null; },
    /** `story`: true while the story plays itself; false while the visitor is exploring. */
    update(dt, story) {
      g.t += dt;
      if (g.orb.k < 1) g.orb.k = Math.min(1, g.orb.k + dt / HOP);
      if (g.cap && g.t > g.cap.until) g.cap = null;
      if (g.barkAt && g.t >= g.barkAt && !g.frozen) { g.barkAt = 0; g.bark(); }
      const p = g.player;
      if (p.k < 1) {
        p.k = Math.min(1, p.k + dt * SPEED); g.buddy.k = p.k;
        if (p.k >= 1 && arrived()) return;      // the orb was touched: the world is changing, so nothing else this frame
      }
      if (g.frozen || p.k < 1) return;
      if (held.size || queued) { p.path = []; p.then = null; step(held.has(lastHeld) ? lastHeld : queued || [...held][0]); queued = null; }
      else if (p.path.length) { if (!step(toward(p, p.path.shift()))) p.path = []; }
      else if (p.then) { const then = p.then; p.then = null; then(); }
      else if (story) pilot();
    },
  };

  const npcAt = (x, y) => x === PLACES.neighbour.x && y === PLACES.neighbour.y;
  const free = (x, y) => walkable(x, y) && !npcAt(x, y);
  const toward = (from, to) => (to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up');
  const speak = thing => g.say(thing.who, thing.text, { x: thing.tiles[0][0], y: thing.tiles[0][1] });
  function step(name) {
    const [dx, dy, dir] = DIRS[name], p = g.player, b = g.buddy;
    p.dir = dir;
    const nx = p.x + dx, ny = p.y + dy;
    if (!free(nx, ny)) {
      // Walking into a thing is the same as talking to it.
      const thing = THINGS.find(th => th.tiles.some(([x, y]) => x === nx && y === ny));
      if (thing && g.cap?.who !== thing.who) speak(thing);
      return false;
    }
    // The agent follows one step behind, into the tile you just left.
    b.fx = b.x; b.fy = b.y; b.dir = DIRS[toward(b, p)][2]; b.x = p.x; b.y = p.y; b.k = 0;
    p.fx = p.x; p.fy = p.y; p.x = nx; p.y = ny; p.k = 0;
    return true;
  }
  function walkTo(target, then = null) {
    const p = g.player;
    if (target.x === p.x && target.y === p.y) { then?.(); return true; }
    const path = findPath(p, target, npcAt);
    if (!path) return false;
    p.path = path; p.then = then;
    return true;
  }
  function arrived() {
    const p = g.player;
    g.steps++; g.lastStep = { x: p.x, y: p.y, at: g.t };
    hooks.step?.();
    if (p.x !== g.orb.x || p.y !== g.orb.y || g.orb.k < 1 || g.frozen) return false;
    p.path = []; p.then = null; hooks.orb?.();
    return true;
  }
  function interact() {
    if (g.frozen || g.moving()) return;
    const p = g.player, [dx, dy] = Object.values(DIRS).find(d => d[2] === p.dir);
    const thing = THINGS.find(th => th.tiles.some(([x, y]) => x === p.x + dx && y === p.y + dy));
    if (thing) speak(thing); else if (g.buddy.x === p.x + dx && g.buddy.y === p.y + dy) g.bark();
  }
  /** What the story does by itself: hear the agent, stop at one thing on the way, then go to the orb. */
  function pilot() {
    const s = g.pilot, p = g.player;
    if (g.t < s.wait || g.barkAt) return;
    const thing = THINGS.find(th => th.id === DETOUR[g.form]);
    const there = thing && p.x === thing.stand.x && p.y === thing.stand.y;
    if (s.stage === 0) { s.stage = 1; if (thing && !there && walkTo(thing.stand)) return; }
    if (s.stage === 1) {
      if (g.cap && g.t - g.cap.at < 1.9) return;          // let the agent finish
      s.stage = 2;
      if (there) { p.dir = DIRS[thing.face][2]; speak(thing); s.wait = g.t + (LINGER[g.form] ?? 1.5); return; }
    }
    if (p.x !== g.orb.x || p.y !== g.orb.y) walkTo(g.orb);
    else if (g.orb.k >= 1) hooks.orb?.();
  }

  g.reset();
  return g;
}
