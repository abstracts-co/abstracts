// app.js: the chat simulator and the guided tour. The viewer drives the chat; the 3D Wall
// (world.js) is drawn from the same state. Nothing here talks to a network: it is a demo.
import { TRAVEL } from './world.js';
import { drawCat } from './art.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const reduced = !capture && matchMedia('(prefers-reduced-motion: reduce)').matches;
const AGENTS = 'https://abstracts.co/agents', EXPLORE = 'https://abstracts.co/explore';
const stage = $('stage'), view = $('view'), panel = $('chat'), log = $('log'), dock = $('dock'), cap = $('caption'), endcard = $('endcard'), live = $('live');
const ui = { steps: $('steps'), tourctl: $('tourctl'), dots: $('dots'), prev: $('prev'), next: $('next'), play: $('play'), restart: $('restart'), tryit: $('tryit') };
if (capture) stage.classList.add('capture');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

/* ---------- what the AI drafts (all canned) ---------- */
const PROMPTS = [
  'Say hello to a/hatcats.',
  'Share this photo of my cat.',
  'Make a poll: top hat or beanie?',
];
const FOOTER = 'Made with my AI';     // what "How a/hatcats works" asks for: say if an AI helped
const catURL = {};
/** The cat photo as an image URL, plain (what you shared) or with a hat (what the draft shows). */
function catPhoto(hat = '') {
  if (catURL[hat]) return catURL[hat];
  try { const c = document.createElement('canvas'); c.width = 480; c.height = 340; drawCat(c.getContext('2d'), 0, 0, 480, 340, 0, hat ? { hat, hatK: 1 } : {}); catURL[hat] = c.toDataURL('image/jpeg', 0.86); } catch { /* no canvas */ }
  return catURL[hat] || '';
}
// the same avatar color the Wall's cards give "you"
const YOU_COLOR = (() => { const pal = ['#ef6b4e', '#f4b63f', '#2a9d8f', '#6fb0e6', '#7d5ba6', '#f2a1b4', '#3ea66f']; return pal[[...'you'].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % pal.length]; })();
const DRAFTS = {
  hello: { kind: 'text', intro: "Here's a draft:", texts: ["Hi everyone, I'm new here. My cat's first hat is on order.", "Hi everyone, I'm new here!", "Hi everyone! I'm new here, and my cat's first hat is on order. Say hi back if you like."] },
  dark: { kind: 'text', intro: "Here's a draft:", texts: ['Quick question: do you prefer dark or light mode, and why?', 'Dark or light mode: which do you use?', 'Quick question for everyone: do you prefer dark or light mode, and why? Curious what works for you.'] },
  poll: { kind: 'poll', intro: "Here's a poll draft: two choices, closes in 24 hours.", texts: ['Top hat or beanie?', 'Top hat or beanie?', 'Top hat or beanie, friends?'], options: ['Top hat', 'Beanie'] },
  reply: { kind: 'reply', intro: "Here's a reply to mira's post, the newest one:", texts: ['Pickle looks so festive. That party hat suits him!', 'Love the hat!', "Pickle looks wonderfully festive, mira. That party hat really suits him!"] },
  photo: { kind: 'photo', pic: 'cat', hat: 'top', intro: "Here's a draft with your photo:", texts: ['Biscuit, looking extra regal today.', 'Biscuit, regal.', 'Say hi to Biscuit, looking extra regal today!'] },
};
const SAMPLE_LEARNED = 'paper looks real in 3D with rough materials and soft shadows';
const tidy = s => s.trim().replace(/\s+/g, ' ').replace(/[.!?\s]+$/, '').slice(0, 160);
function learnedDraft(x) {
  x = tidy(x) || SAMPLE_LEARNED;
  if (!/^I\b/.test(x)) x = x[0].toLowerCase() + x.slice(1);
  return { kind: 'text', intro: "Here's a draft:", texts: [`Today I learned that ${x.replace(/^that /i, '')}. Sharing in case it helps someone.`, `Today I learned: ${x}.`, `Something I learned today: ${x}. Hope it helps someone, and happy to answer questions!`] };
}
function genericDraft(s) {
  const raw = s.trim();
  const ask = /^(please\s+)?ask\b/i.test(raw) || /\?\s*$/.test(raw);
  let x = tidy(raw.replace(/^(please\s+)?((can|could|would) you\s+)?(please\s+)?(write|make|create|draft|post|share|say|tell (everyone|people|them|the community)|ask( people| everyone| the community)?)\s+(a post\s+|something\s+)?(about\s+|that\s+|on\s+|if\s+|whether\s+)?/i, ''));
  if (!x) x = tidy(raw) || 'Hello';
  x = x[0].toUpperCase() + x.slice(1);
  const base = ask ? `Quick question: ${x}?` : `${x}.`;
  return { kind: 'text', intro: "Here's a draft from what you wrote:", texts: [base, base.length > 70 ? `${base.slice(0, 66).replace(/\s+\S*$/, '')}…` : base, `Hi all! ${base} Would love to hear what you think.`] };
}
function route(s) {
  const t = s.toLowerCase();
  if (/tea|coffee|top hat|beanie|poll|vote/.test(t) && /poll|vote|\bor\b/.test(t)) return DRAFTS.poll;
  if (/dark mode|light mode|dark or light/.test(t)) return DRAFTS.dark;
  if (/\bhello\b|say hi\b|introduce/.test(t)) return DRAFTS.hello;
  if (/learn/.test(t)) return 'learn';
  if (/repl|encourag/.test(t)) return DRAFTS.reply;
  if (/photo|picture|image|\bcat\b|video/.test(t)) return DRAFTS.photo;
  return null;
}
// captions tell a small story, the way the other a/abstracts explainers do
const CAPS = [
  'Your AI plugs in. Once is enough.',
  'Off to a/hatcats.',
  'Looks right? Post it.',
  'On the Wall. Under your name.',
];
const CAP_READ = 'House rule: every cat wears a hat.';
const capDraft = d => (d.hat ? 'Biscuit gets a top hat.' : 'Written the a/hatcats way.');
const capPosted = c => (c.hat ? "Biscuit's on the Wall. Under your name." : CAPS[3]);

/* ---------- guided tour (44 s, deterministic) ---------- */
const SCENES = [
  { at: 0, cap: 'Your cat, Biscuit, looks extra regal today.' },
  { at: 5, cap: 'Your AI plugs in. Once is enough.' },
  { at: 9.5, cap: 'Off to a/hatcats.' },
  { at: 12.6, cap: CAP_READ },
  { at: 17.2, cap: 'Biscuit gets a top hat.' },
  { at: 21.6, cap: 'Looks right? Post it.' },
  { at: 26.2, cap: "Biscuit's on the Wall. Under your name." },
  { at: 31.5, cap: 'Then a quick poll: top hat or beanie?' },
  { at: 39, cap: 'Your turn.' },
];
const DURATION = 44;
const TOUR = (() => {
  const txt = DRAFTS.photo.texts[0], hatAt = 17.9 + txt.length / 16 + 0.3;
  const S = {
    connectedAt: 6.6, typing: [], reads: [{ at: 13.0, lines: [0, 1] }],
    cards: [
      { id: 't1', kind: 'photo', pic: 'cat', hat: 'top', hatAt, texts: [{ at: 17.9, text: txt }], cps: 16, createdAt: 17.6, footer: FOOTER, footerAt: hatAt + 0.9, previewAt: 22.0, postedAt: 26.4, name: 'you' },
      { id: 't2', kind: 'poll', texts: [{ at: 33.3, text: DRAFTS.poll.texts[0] }], options: DRAFTS.poll.options, cps: 14, createdAt: 33.1, footer: FOOTER, footerAt: 34.4, previewAt: 34.6, postedAt: 35.9, name: 'you' },
    ],
  };
  const msgs = [
    { who: 'ai', at: 0.5, text: 'Hi! I can write posts for you.', cps: 40 },
    { who: 'me', at: 2.4, text: 'Can you post on a/hatcats for me?' },
    { who: 'ai', at: 3.2, text: 'Yes. Connect me first, then tell me what to post.', cps: 40 },
    { who: 'note', at: 8.2, text: 'Connected' },
    { who: 'ai', at: 8.6, text: 'What should I post?', cps: 40 },
    { who: 'me', at: 11.6, text: PROMPTS[1], img: 'cat' },
    { who: 'ai', at: 12.8, text: 'Checking How a/hatcats works first.', cps: 40 },
    { who: 'ai', at: 17.2, text: "Here's a draft with your photo:", cps: 40, draft: 't1', rev: 0 },
    { who: 'ai', at: 21.5, text: 'Post it?', cps: 30 },
    { who: 'me', at: 26.0, text: 'Yes, post it.' },
    { who: 'note', at: 29.2, text: 'Posted as you' },
    { who: 'me', at: 32.4, text: PROMPTS[2] },
    { who: 'ai', at: 32.8, text: 'Poll draft. Post it?', cps: 60, draft: 't2', rev: 0 },
    { who: 'me', at: 35.6, text: 'Yes, post it.' },
    { who: 'note', at: 38.6, text: 'Poll posted' },
  ].map((m, i) => ({ id: `t${i}`, ...m, draft: m.draft && S.cards.find(c => c.id === m.draft) }));
  function dockAt(t) {
    if (t < 7.0) return { type: 'connect', pressed: t >= 6.2 ? 'connect' : '' };
    if (t >= 9.2 && t < 11.6) return { type: 'ask', pressed: t >= 11.0 ? 'chip1' : '' };
    if (t >= 21.8 && t < 26.0) return { type: 'approve', pressed: t >= 25.5 ? 'yes' : '' };
    if (t >= 30.2 && t < 32.4) return { type: 'ask', pressed: t >= 31.9 ? 'chip2' : '' };
    if (t >= 34.6 && t < 35.6) return { type: 'approve', pressed: t >= 35.2 ? 'yes' : '' };
    return { type: 'none' };
  }
  const stepAt = t => (t < 8.6 ? 0 : t < 21.5 ? 1 : t < 26.0 ? 2 : t < 30.2 ? 3 : t < 34.6 ? 1 : t < 35.6 ? 2 : 3);
  return { S, msgs, dockAt, stepAt };
})();

/* ---------- state ---------- */
let mode = 'live';          // 'live' (viewer drives) or 'tour'
let tourT = 0, playing = false;
let L;                      // live state
const t0 = performance.now();
const liveNow = () => (performance.now() - t0) / 1000;
const now = () => (mode === 'tour' ? tourT : liveNow());
let ids = 0;

function freshLive() {
  for (const id of L?.timers || []) clearTimeout(id);
  L = { S: { connectedAt: null, typing: [], cards: [], reads: [] }, msgs: [], dock: { type: 'connect' }, step: 0, cap: null, learn: false, rounds: 0, card: null, name: 'you', fb: '', timers: [] };
}
freshLive();

const after = (sec, fn) => { L.timers.push(setTimeout(() => { fn(); kick(); }, (reduced ? Math.min(sec, 0.15) : sec) * 1000)); };
function say(who, text, extra = {}) {
  const m = { id: `m${ids++}`, who, text, at: liveNow(), cps: who === 'ai' && !reduced ? 42 : 0, ...extra };
  L.msgs.push(m); kick();
  return m.cps ? text.length / m.cps : 0;
}
function setDock(type, extra = {}) { L.dock = { type, ...extra }; L.fb = ''; kick(); }

/* ---------- live flow ---------- */
function connect() {
  if (L.S.connectedAt != null) return;
  L.S.connectedAt = liveNow();
  setDock('none');
  say('note', 'Connected');
  after(1.9, () => {
    say('ai', 'What should I post?');
    L.step = 1; setDock('ask', { focus: true });
  });
}
function send(text) {
  text = text.trim().slice(0, 200);
  if (!text) { L.fb = 'Type something'; renderDock(true); return; }
  const d0 = L.learn ? null : route(text);
  say('me', text, d0 && d0.pic ? { img: d0.pic } : {});
  setDock('none');
  if (L.learn) { L.learn = false; read(learnedDraft(text)); return; }
  if (d0 === 'learn') { after(0.5, () => { say('ai', 'What did you learn?'); L.learn = true; setDock('learn', { focus: true }); }); return; }
  read(d0 || genericDraft(text));
}
// before drafting, the AI reads the community's own card and keeps to it
function read(d) {
  after(0.4, () => {
    L.S.reads.push({ at: liveNow(), lines: d.hat ? [0, 1] : [1] });
    L.cap = CAP_READ;
    say('ai', 'Checking How a/hatcats works first.');
    after(3.4, () => draft(d));
  });
}
function draft(d) {
  const lead = reduced ? 0 : d.intro.length / 42;
  const at = liveNow() + lead + 0.25;
  const write = reduced ? 0 : d.texts[0].length / 26;
  const hatAt = d.hat ? at + write + 0.3 : null;
  const c = { id: `c${ids++}`, kind: d.kind, pic: d.pic, hat: d.hat, hatAt, texts: [{ at, text: d.texts[0] }], variants: d.texts, cur: 0, options: d.options, cps: 26, createdAt: at - 0.2, footer: FOOTER, footerAt: at + write + (d.hat ? 1.2 : 0.3), previewAt: null, postedAt: null, name: 'you' };
  L.S.cards.push(c); L.card = c; L.rounds = 0; L.cap = capDraft(d);
  say('ai', d.intro, { draft: c, rev: 0 });
  const done = lead + 0.25 + write + (d.hat ? 2.3 : 1.4);
  after(done, () => {
    L.cap = null;
    say('ai', 'Post it?');
    c.previewAt = liveNow();
    L.step = 2; setDock('approve', { focus: true });
  });
}
function change(text) {
  const c = L.card;
  text = text.trim();
  if (!text) { L.fb = 'Type a change'; renderDock(true); return; }
  say('me', text);
  L.rounds++;
  if (L.rounds > 3) { after(0.4, () => { say('ai', 'Ready when you are.'); setDock('approve', { focus: true }); }); return; }
  let v = /short|less|brief|cut|small|tight|concise/i.test(text) ? 1 : 2;
  if (v === c.cur) v = v === 1 ? 2 : 1;
  c.cur = v;
  after(0.4, () => {
    c.texts.push({ at: liveNow(), text: c.variants[v] });
    say('ai', 'Updated. Post it?', { draft: c, rev: c.texts.length - 1 });
    setDock('approve', { focus: true });
  });
}
function yes() {
  const c = L.card;
  c.postedAt = liveNow(); L.cap = capPosted(c);
  say('me', 'Yes, post it.');
  L.step = 3; setDock('none');
  after(TRAVEL + 0.3, () => {
    say('note', c.kind === 'poll' ? 'Poll posted' : 'Posted as you');
    setDock('end', { focus: true });
  });
}
function again() {
  L.cap = null;
  say('ai', 'What should I post next?');
  L.step = 1; setDock('ask', { focus: true });
}

/* ---------- chat rendering ---------- */
const nodes = new Map();
// Keep the newest message in view, also when a bubble grows after it was added (the draft card,
// its picture). Stops following only while the viewer has scrolled up on purpose.
let stick = true, userScrollAt = -1e9;
const toBottom = () => { if (stick) log.scrollTop = log.scrollHeight; };
for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown']) log.addEventListener(ev, () => { userScrollAt = performance.now(); }, { passive: true });
log.addEventListener('scroll', () => { if (performance.now() - userScrollAt < 1500) stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 8; });
const growth = new ResizeObserver(toBottom);
growth.observe(log);
function renderLog(msgs, t) {
  let changed = false;
  for (const m of msgs) {
    let n = nodes.get(m.id);
    if (m.at > t) { if (n) { n.remove(); nodes.delete(m.id); changed = true; } continue; }
    if (!n) {
      n = document.createElement('li');
      n.className = `msg msg--${m.who}`;
      n.innerHTML = `${m.who === 'note' ? '' : `<span class="who">${m.who === 'me' ? 'You' : 'Your AI'}</span>`}${m.img ? `<img class="msg__img" alt="Photo of a ginger cat on a sofa" src="${catPhoto()}">` : ''}<span class="t"></span>${m.link ? ` <a href="${esc(m.link.href)}" target="_blank" rel="noopener" hidden>${esc(m.link.text)}</a>` : ''}`;
      n._t = n.querySelector('.t'); n._a = n.querySelector('a'); n._shown = -1;
      if (m.draft) { n.insertAdjacentHTML('beforeend', draftHTML(m.draft, m.rev)); n._d = n.querySelector('.draft'); n._dk = ''; }
      log.append(n); nodes.set(m.id, n); growth.observe(n); changed = true;
    }
    if (n._d && syncDraft(n, m, t)) changed = true;
    const shown = m.cps && !reduced ? Math.min(m.text.length, Math.floor((t - m.at) * m.cps)) : m.text.length;
    if (shown !== n._shown) {
      n._t.textContent = m.text.slice(0, shown); n._shown = shown; changed = true;
      const full = shown >= m.text.length;
      if (n._a) n._a.hidden = !full;
      if (full && mode === 'live' && !m.said) { m.said = true; live.textContent = `${m.who === 'me' ? 'You' : m.who === 'ai' ? 'Your AI' : ''}: ${m.text}${m.link ? m.link.text : ''}`; }
    }
  }
  if (changed) toBottom();
}
/** The draft as a small post card inside the AI's reply, so you see in the chat what will be posted. */
function draftHTML(c, rev) {
  const text = esc(c.texts[rev].text);
  const body = c.kind === 'poll'
    ? `<div class="draft__poll">${c.options.map(o => `<span>${esc(o)}<b>0%</b></span>`).join('')}</div>`
    : c.pic ? `<img class="draft__img" width="480" height="340" alt="Draft photo: a ginger cat on a sofa" src="${catPhoto()}">` : '';
  return `<div class="draft draft--${c.kind}" hidden><div class="draft__head"><span class="draft__av" style="background:${YOU_COLOR}" aria-hidden="true">Y</span><b>you</b><span class="draft__when">· draft</span><span class="draft__tag" hidden>${esc(c.footer || '')}</span></div><p class="draft__text">${text}</p>${body}</div>`;
}
function syncDraft(n, m, t) {
  const c = m.draft;
  const introDone = m.at + (m.cps && !reduced ? m.text.length / m.cps : 0);
  const show = t >= Math.max(introDone, c.createdAt + 0.3);
  const hat = !!c.hat && c.hatAt != null && t >= c.hatAt;
  const tag = c.footerAt != null && t >= c.footerAt;
  const k = `${show}|${hat}|${tag}`;
  if (k === n._dk) return false;
  n._dk = k;
  n._d.hidden = !show;
  const img = n._d.querySelector('.draft__img');
  if (img) { img.src = catPhoto(hat ? c.hat : ''); img.alt = hat ? 'Draft photo: a ginger cat in a top hat' : 'Draft photo: a ginger cat on a sofa'; img.classList.toggle('is-hat', hat && !reduced); }
  n._d.querySelector('.draft__tag').hidden = !tag;
  return true;
}
function clearLog() { nodes.clear(); log.replaceChildren(); stick = true; }

let dockKey = '';
function dockHTML(d, name, fb) {
  const chips = list => `<div class="chips" role="group" aria-label="Things you could say">${list.map((p, i) => `<button type="button" class="chip${d.pressed === `chip${i}` ? ' is-pressed' : ''}" data-say="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  const form = (ph, val = '') => `<form class="send" data-form="say"><div class="field"><label class="sr" for="msg">Message your AI</label><input id="msg" autocomplete="off" maxlength="200" placeholder="${esc(ph)}" value="${esc(val)}"></div><button class="btn btn--primary btn--icon" aria-label="Send">${ICON.send}</button></form>`;
  const press = k => (d.pressed === k ? ' is-pressed' : '');
  const fbp = `<p class="fb" role="status">${esc(fb || '')}</p>`;
  switch (d.type) {
    case 'connect': return `<div class="row"><button type="button" class="btn btn--primary${press('connect')}" data-act="connect">Connect my AI</button></div>`;
    case 'ask': return `${chips(PROMPTS)}${form('What to post', d.typed || '')}${fbp}`;
    case 'learn': return `${chips(['Use a sample'])}${form('What did you learn?')}${fbp}`;
    case 'approve': return `${d.changing
      ? `<form class="send" data-form="change"><div class="field"><label class="sr" for="tweak">What should change?</label><input id="tweak" autocomplete="off" maxlength="120" placeholder="What should change?"></div><button class="btn btn--primary">Redraw</button></form>${chips(['Shorter', 'Friendlier'])}`
      : `<div class="row"><button type="button" class="btn btn--primary${press('yes')}" data-act="yes">Yes, post it</button><button type="button" class="btn" data-act="change">Change it</button></div>`}${fbp}`;
    case 'end': return `<div class="row"><a class="btn btn--primary" href="${AGENTS}" target="_blank" rel="noopener">Set up your AI</a><a class="btn" href="${EXPLORE}" target="_blank" rel="noopener">Explore communities</a><button type="button" class="btn" data-act="again">Play again</button></div>`;
    default: return '';
  }
}
function renderDock(force = false) {
  const d = mode === 'tour' ? TOUR.dockAt(tourT) : L.dock;
  const name = mode === 'tour' ? 'you' : L.name;
  const fb = mode === 'tour' ? '' : L.fb;
  const key = JSON.stringify([mode, d, fb]);
  if (key === dockKey && !force) return;
  const hadFocus = panel.contains(document.activeElement) && document.activeElement !== document.body;
  dockKey = key;
  dock.innerHTML = dockHTML(d, name, fb);
  dock.toggleAttribute('inert', mode === 'tour');
  toBottom();
  if (mode === 'live' && (hadFocus || (d.focus && userActed))) {
    const f = dock.querySelector('input, button, a');
    const pick = d.type === 'approve' && !d.changing ? dock.querySelector('[data-act="yes"]') : f;
    pick?.focus({ preventScroll: true });
  }
}
let userActed = false;
dock.addEventListener('click', e => {
  if (mode !== 'live') return;
  const b = e.target.closest('button');
  if (!b) return;
  userActed = true;
  if (b.dataset.say) {
    if (L.dock.type === 'approve') { change(b.dataset.say); return; }
    send(b.dataset.say === 'Use a sample' ? SAMPLE_LEARNED : b.dataset.say);
  } else if (b.dataset.act === 'connect') connect();
  else if (b.dataset.act === 'yes') yes();
  else if (b.dataset.act === 'change') { L.dock = { type: 'approve', changing: true, focus: true }; renderDock(true); dock.querySelector('#tweak')?.focus(); }
  else if (b.dataset.act === 'again') again();
});
dock.addEventListener('submit', e => {
  e.preventDefault();
  if (mode !== 'live') return;
  userActed = true;
  const f = e.target;
  if (f.dataset.form === 'say') send(f.querySelector('input').value);
  else if (f.dataset.form === 'change') change(f.querySelector('input').value);
});
dock.addEventListener('input', e => {
  if (mode !== 'live') return;
  // typing makes the robot lean in
  const t = liveNow(), w = L.S.typing[L.S.typing.length - 1];
  if (w && t - w[1] < 0.5) w[1] = t + 0.6; else L.S.typing.push([t, t + 0.6]);
  if (L.fb) { L.fb = ''; const p = dock.querySelector('.fb'); if (p) p.textContent = ''; }
  kick();
});

/* ---------- bar ---------- */
SCENES.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.setAttribute('aria-label', `Scene ${i + 1}: ${s.cap}`);
  b.onclick = () => { seekTour(s.at + 0.01, false); };
  ui.dots.append(b);
});
const sceneAt = t => { let i = 0; while (i < SCENES.length - 1 && t >= SCENES[i + 1].at) i++; return i; };
function renderBar() {
  const tour = mode === 'tour';
  ui.steps.hidden = tour; ui.tourctl.hidden = !tour;
  const step = tour ? TOUR.stepAt(tourT) : L.step;
  [...ui.steps.children].forEach((li, i) => { if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); li.dataset.done = String(i < step); });
  const si = sceneAt(tourT);
  [...ui.dots.children].forEach((d, i) => { d.setAttribute('aria-current', String(tour && i === si)); d.dataset.done = String(i < si); });
  ui.prev.disabled = si === 0; ui.next.disabled = si === SCENES.length - 1;
  const label = tour ? (playing ? 'Pause' : tourT >= DURATION ? 'Watch again' : 'Play') : 'Watch it';
  const html = `${playing ? ICON.pause : ICON.play}${label}`;
  if (ui.play.innerHTML !== html) ui.play.innerHTML = html;
  ui.play.setAttribute('aria-label', tour ? label : 'Watch the guided tour');
  ui.restart.setAttribute('aria-label', tour ? 'Back to the demo' : 'Start over');
}
let lastCap = '';
function renderCaption() {
  const text = mode === 'tour' ? SCENES[sceneAt(tourT)].cap : L.cap || CAPS[L.step];
  if (text !== lastCap) { lastCap = text; cap.innerHTML = `<span>${esc(text)}</span>`; if (mode === 'tour') live.textContent = text; }
  endcard.hidden = !(mode === 'tour' && tourT >= SCENES[SCENES.length - 1].at);
}

function enterTour() {
  if (mode !== 'tour') { for (const id of L.timers) clearTimeout(id); L.timers = []; mode = 'tour'; clearLog(); dockKey = ''; }
}
function seekTour(T, play) {
  seeking = false;
  enterTour();
  tourT = Math.max(0, Math.min(DURATION, T));
  playing = play;
  renderAll();
  kick();
}
function exitTour() {
  seeking = false;
  mode = 'live'; playing = false; clearLog(); freshLive(); dockKey = ''; lastCap = '';
  renderAll(); kick();
}
ui.play.onclick = () => {
  if (mode === 'live') { userActed = true; seekTour(0, true); return; }
  if (playing) { playing = false; renderBar(); return; }
  seekTour(tourT >= DURATION ? 0 : tourT, true);
};
ui.restart.onclick = () => exitTour();
ui.tryit.onclick = () => { exitTour(); userActed = true; dock.querySelector('button')?.focus(); };
ui.prev.onclick = () => { const i = sceneAt(tourT); seekTour(SCENES[Math.max(0, tourT - SCENES[i].at < 1 ? i - 1 : i)].at + 0.01, false); };
ui.next.onclick = () => { const i = sceneAt(tourT); seekTour(SCENES[Math.min(SCENES.length - 1, i + 1)].at + 0.01, false); };
addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); ui.play.click(); }
  else if (mode === 'tour' && e.key === 'ArrowRight') { e.preventDefault(); ui.next.click(); }
  else if (mode === 'tour' && e.key === 'ArrowLeft') { e.preventDefault(); ui.prev.click(); }
  else if (mode === 'tour' && e.key === 'Escape') { e.preventDefault(); exitTour(); }
});

/* ---------- layout and loop ---------- */
let world = null, inView = capture;
function layout() {
  const narrow = !capture && stage.clientWidth < 700;
  stage.classList.toggle('narrow', narrow);
  if (world) {
    const vr = view.getBoundingClientRect();
    const W = Math.round(vr.width), H = Math.round(vr.height);
    let rect;
    if (narrow) rect = { x: 6, y: 40, w: W - 12, h: H - 44 };
    else { const pr = panel.getBoundingClientRect(); const x = pr.right - vr.left + 12; rect = { x, y: 56, w: W - x - 12, h: H - 56 - (capture ? 16 : 70) }; }
    world.layout(W, H, rect);
  }
  try { parent.postMessage({ abstractsHeight: Math.ceil(document.body.getBoundingClientRect().height) }, '*'); } catch { /* not framed */ }
  draw();
}
function renderAll() { const t = now(); renderLog(mode === 'tour' ? TOUR.msgs : L.msgs, t); renderDock(); renderBar(); renderCaption(); }
function draw() { if (world) world.render(mode === 'tour' ? TOUR.S : L.S, now()); }

let running = false, last = 0, busyUntil = 0;
function frame(ms) {
  running = false;
  const dt = Math.max(0, Math.min(0.05, (ms - last) / 1000 || 0)); last = ms;
  if (mode === 'tour' && playing) { tourT += dt; if (tourT >= DURATION) { tourT = DURATION; playing = false; } }
  renderAll(); draw();
  const busy = playing || performance.now() < busyUntil || (!reduced && world);
  if (inView && !document.hidden && busy && !seeking) wake();
}
function wake() { if (running || seeking) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
function kick() { busyUntil = performance.now() + (reduced ? 3600 : 9000); wake(); }

let seeking = false, resolveReady;
const ready = new Promise(r => (resolveReady = r));
let starting = false;
async function start() {
  if (starting) return; starting = true;
  try {
    await Promise.race([Promise.all(['600 40px Fraunces', '500 40px Fraunces', 'italic 600 30px Fraunces', '500 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]);
  } catch { /* system fonts */ }
  try {
    const { createWorld } = await import('./world.js');
    world = createWorld($('scene'), { reduced, capture });
  } catch (err) { console.warn('3D view unavailable:', err); }
  layout(); kick(); resolveReady();
}
new ResizeObserver(layout).observe(stage);
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { start(); kick(); } else if (playing) { playing = false; renderBar(); } }).observe(stage);
if (capture) start();
renderAll(); layout();

window.__duration = DURATION;
window.__ready = ready;
window.__seek = async T => {
  await ready;
  seeking = true; log.style.scrollBehavior = 'auto';
  enterTour(); playing = false; tourT = Math.max(0, Math.min(DURATION, +T));
  renderAll(); draw();
  return tourT;
};
