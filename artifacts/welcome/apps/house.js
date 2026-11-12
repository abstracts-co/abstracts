// house.js: a post from a private house, as the app it is. A house of friends keeps two things here: a wall of
// memories anyone can add to, and ideas for the next event, where the one with the most votes gets a plan
// drafted by an agent. The people, the memories and the ideas are made up. What you do here stays on this page.
import { el } from '../lib/util.js';
import { phone, face, who, svg, ICON } from '../lib/ios.js';
import { COMMUNITIES } from '../communities.js';

const IDEAS = [
  { id: 'roof', name: 'Rooftop movie night', by: ['zoe', false], votes: ['zoe', 'maya', 'omar', 'lina'] },
  { id: 'trivia', name: 'Trivia night fundraiser', by: ['kenji', false], votes: ['kenji', 'sam', 'lina', 'maya'] },
  { id: 'beach', name: 'Beach clean-up and bonfire', by: ['omar', false], votes: ['omar', 'sam', 'zoe'] },
  { id: 'alumni', name: 'Alumni brunch', by: ['maya', true], votes: ['maya', 'kenji'] },
];
const PLANS = {
  roof: ['Book the roof for Friday, 8 pm', 'Projector and speakers: Omar has both', 'Snacks: about $5 each for 24 people'],
  trivia: ['Reserve the common room for Thursday, 7 pm', 'Six rounds: Kenji writes three, the AI drafts three', 'Entry $5 a head, all of it to the food bank'],
  beach: ['Saturday, 4 pm at the north lot', 'Bags and gloves from the city: Sam picks them up', 'Fire permit, wood and marshmallows'],
  alumni: ['Sunday, 11 am in the dining room', 'Invite list from the last five years', 'Coffee, bagels and name tags'],
};
const scene = (sky, parts) => `<svg viewBox="0 0 60 44" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="60" height="44" fill="${sky}"/>${parts}</svg>`;
const MEMORIES = [
  ['Lake weekend', 'omar', 'July', scene('#ffd9a0', '<circle cx="44" cy="14" r="7" fill="#ff8a1f"/><rect y="24" width="60" height="20" fill="#3d94cf"/><path d="M0 24q10-8 22-2t20-4 18 4v2H0z" fill="#4f9e45"/><rect x="14" y="30" width="16" height="3" rx="1.500" fill="#fffdf8"/>')],
  ['Move-in day', 'maya', 'August', scene('#bfe1f3', '<rect x="0" y="30" width="60" height="14" fill="#8fd16a"/><rect x="18" y="14" width="24" height="18" fill="#fbf4e4"/><path d="M14 15 30 4l16 11z" fill="#ef6b4e"/><rect x="27" y="22" width="6" height="10" fill="#7a4f2e"/><rect x="46" y="27" width="8" height="6" fill="#d19a5e"/><rect x="6" y="26" width="7" height="7" fill="#d19a5e"/>')],
  ['Game night', 'kenji', 'October', scene('#2a2140', '<rect x="8" y="24" width="44" height="6" rx="2" fill="#7a4f2e"/><rect x="16" y="14" width="9" height="9" rx="2" fill="#fffdf8"/><circle cx="20.500" cy="18.500" r="1.300" fill="#1f2436"/><rect x="33" y="13" width="9" height="9" rx="2" fill="#f7d154" transform="rotate(14 37 17)"/><circle cx="48" cy="9" r="3" fill="#ffd766"/>')],
  ['Spring formal', 'zoe', 'April', scene('#1b1f4a', '<circle cx="12" cy="10" r="1.200" fill="#fff"/><circle cx="30" cy="6" r="1" fill="#fff"/><circle cx="48" cy="12" r="1.300" fill="#fff"/><circle cx="20" cy="30" r="6" fill="#f472b6"/><circle cx="33" cy="26" r="6" fill="#a78bfa"/><circle cx="44" cy="31" r="6" fill="#38bdf8"/><path d="M20 36v8M33 32v12M44 37v7" stroke="#fff" stroke-width=".8"/>')],
  ['Finals week', 'sam', 'May', scene('#f3eadb', '<rect x="8" y="26" width="26" height="5" fill="#2f6fd6"/><rect x="10" y="21" width="24" height="5" fill="#d9432a"/><rect x="12" y="16" width="20" height="5" fill="#3ea66f"/><rect x="40" y="20" width="10" height="11" rx="2" fill="#fffdf8" stroke="#2a2320"/><path d="M50 23h3v5h-3" fill="none" stroke="#2a2320"/>')],
  ['Graduation', 'lina', 'June', scene('#8fc7ee', '<rect y="32" width="60" height="12" fill="#6dbd58"/><path d="M12 14l8-3 8 3-8 3z" fill="#1f2436"/><path d="M34 9l8-3 8 3-8 3z" fill="#1f2436" transform="rotate(-12 42 9)"/><path d="M24 22l8-3 8 3-8 3z" fill="#1f2436" transform="rotate(9 32 22)"/><circle cx="50" cy="8" r="4" fill="#ffd766"/>')],
];
const TODAY = ['Walked the island', 'you', 'Today', scene('#58b3e6', '<path d="M10 30q6-16 22-14t18 14q-8 8-22 7T10 30z" fill="#8fd16a"/><path d="M29 18v19" stroke="#ecd9a9" stroke-width="3"/><circle cx="20" cy="26" r="3.500" fill="#2f8f4a"/><rect x="34" y="22" width="8" height="6" fill="#fbf4e4"/><path d="M33 22l5-4 5 4z" fill="#7d5ba6"/><circle cx="30" cy="27" r="2.200" fill="#ef6b4e"/>')];

const CSS = `
.ho-first { position: relative; height: 10.500em; border-radius: 1.100em; overflow: hidden; }
.ho-first svg, .ho-tile svg { display: block; width: 100%; height: 100%; }
.ho-first figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 2.200em .9em .7em; color: #fff; background: linear-gradient(180deg, transparent, rgb(0 0 0 / .62)); }
.ho-first small { display: block; font-size: .72em; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
.ho-first b { font-size: 1.350em; letter-spacing: -.015em; }
.ho-first.new { animation: ho-in .6s cubic-bezier(.2, 1.2, .4, 1); }
@keyframes ho-in { from { opacity: 0; transform: scale(.92); } }
.ho-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .6em; margin-top: .6em; }
.ho-tile { margin: 0; border-radius: .9em; overflow: hidden; background: #fff; }
.ho-tile svg { height: 5.200em; }
.ho-tile figcaption { display: flex; align-items: center; gap: .45em; padding: .45em .6em .55em; font-weight: 600; font-size: .86em; }
.ho-tile figcaption small { display: block; font-weight: 400; font-size: .86em; color: #8e8e93; }
.ho-tile .io-face { font-size: .72em; }
.ho-lead { flex: none; padding: .12em .5em; border-radius: .5em; font-weight: 700; font-size: .68em; letter-spacing: .03em; text-transform: uppercase; color: #fff; background: var(--tint); }
.ho-check { flex: none; width: 1.300em; height: 1.300em; border-radius: 50%; box-shadow: inset 0 0 0 1.500px #c7c7cc; }
figure { margin: 0; }
@media (prefers-reduced-motion: reduce) { .ho-first.new { animation: none; } }
`;
const TAB = { memories: svg('<rect x="3.500" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.700"/><path d="M4 17l5-4.500 3.500 3 3-2.500 4.500 4"/>', 'stroke-width="1.700"'), events: svg('<rect x="4" y="5.500" width="16" height="14" rx="3"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4M8.500 14.500l2 2 4-4"/>', 'stroke-width="1.700"') };

export default {
  id: 'house', name: 'a/our-house', kind: 'private', planet: 3, community: COMMUNITIES.house,
  dot: 'radial-gradient(circle at 50% 38%, #fbf4e4 0 26%, #ff5c8a 27% 56%, #2a2140 57%)',
  create(api) {
    const frame = phone({ community: COMMUNITIES.house, tint: '#ff2d55', api });
    const mine = new Set();
    let memories = MEMORIES.slice(), script = 0, popped = null;

    const add = el('button', { type: 'button', class: 'io-navbtn', onclick: () => { api.take(); remember(); } }, '+ Today');
    const first = el('figure', { class: 'ho-first' }), grid = el('div', { class: 'ho-grid' }), count = el('p', { class: 'io-foot' });
    const memoriesTab = el('div', { class: 'io-scroll' }, first, grid, count);
    const ideas = el('ul', { class: 'io-group' }), ai = el('div', { class: 'io-ai', style: 'margin-top:1em' }), plan = el('ul', { class: 'io-group', style: 'margin-top:.6em' });
    const eventsTab = el('div', { class: 'io-scroll', hidden: true }, el('p', { class: 'io-head', style: 'margin-top:.2em' }, 'What’s next? Vote, and the winner gets a plan'), ideas, ai, plan);
    const tabs = [['Memories', TAB.memories], ['Events', TAB.events]].map(([label, icon], i) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), onclick: () => { api.take(); show(i); }, html: `${icon}<span>${label}</span>` }));
    frame.app.append(el('style', {}, CSS), frame.nav('The house', add), memoriesTab, eventsTab, el('nav', { class: 'io-tabs', role: 'tablist' }, tabs));

    function show(i) { memoriesTab.hidden = i !== 0; eventsTab.hidden = i !== 1; add.hidden = i !== 0 || memories[0] === TODAY; tabs.forEach((tab, k) => tab.setAttribute('aria-selected', String(k === i))); }
    function remember() { if (memories[0] !== TODAY) { memories = [TODAY, ...memories]; popped = 'today'; draw(); add.hidden = true; } }
    function vote(id) { if (mine.has(id)) mine.delete(id); else mine.add(id); popped = id; draw(); }
    function draw() {
      const [title, name, when, picture] = memories[0];
      first.className = `ho-first${popped === 'today' ? ' new' : ''}`; first.innerHTML = picture;
      first.append(el('figcaption', {}, el('small', {}, `${when} · added by ${who(name, false)}`), el('b', {}, title)));
      grid.textContent = '';
      for (const [t, n, w, pic] of memories.slice(1)) grid.append(el('figure', { class: 'ho-tile', html: pic }, el('figcaption', {}, face(n), el('span', {}, t, el('small', {}, w)))));
      count.textContent = `${memories.length} memories from ${new Set(memories.map(memory => memory[1])).size} people. Anyone in the house can add one.`;
      const tally = IDEAS.map(idea => ({ idea, count: idea.votes.length + (mine.has(idea.id) ? 1 : 0) })).sort((a, b) => b.count - a.count);
      ideas.textContent = '';
      tally.forEach(({ idea, count: votes }, i) => ideas.append(el('li', { class: `io-cell${popped === idea.id ? ' pop' : ''}` }, face(...idea.by),
        el('span', { class: 'io-cell-text' }, idea.name, el('small', {}, `${who(...idea.by)} suggested it`)), i === 0 ? el('span', { class: 'ho-lead' }, 'Leading') : null,
        el('button', { type: 'button', class: 'io-vote', 'aria-pressed': String(mine.has(idea.id)), 'aria-label': `${mine.has(idea.id) ? 'Take back your vote for' : 'Vote for'} ${idea.name}`, onclick: () => { api.take(); vote(idea.id); }, html: `${ICON.thumb}${votes}` }))));
      const top = tally[0].idea;
      ai.innerHTML = ICON.spark; ai.append(el('span', {}, el('b', {}, `Lina’s AI drafted a plan for “${top.name}”. `), 'Change the vote and the plan changes with it.'));
      plan.textContent = '';
      for (const line of PLANS[top.id]) plan.append(el('li', { class: 'io-cell' }, el('span', { class: 'ho-check' }), el('span', { class: 'io-cell-text' }, line)));
      popped = null;
    }

    return {
      el: frame.root, app: true, arrive: frame.arrive, leave: frame.leave, bare: frame.bare,
      enter() { mine.clear(); memories = MEMORIES.slice(); script = 0; draw(); show(Number(new URLSearchParams(location.search).get('tab')) || 0); },
      resize(w, h) { frame.fit(w, h); },
      /** The story's own run through the app: one memory, then one vote. */
      pilot(dt) {
        const was = script; script += dt;
        const at = t => was < t && script >= t;
        if (at(1.6)) remember();
        if (at(3.8)) show(1);
        if (at(5.6)) vote('trivia');
        return script > 8.6;
      },
      render() {},
      pick: () => null,
      screenOf: () => frame.orbAt(),
    };
  },
};
