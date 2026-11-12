// trip.js: a post from a private group of friends, as the app it is. Six friends plan a drive up the California
// coast: anyone adds a stop, a stop joins the trip once three of them vote for it, and an agent fits the days.
// The friends are made up. The road is real, with rough driving times. What you do here stays on this page.
import { el } from '../lib/util.js';
import { phone, face, who, svg, ICON } from '../lib/ios.js';
import { COMMUNITIES } from '../communities.js';

const NEEDED = 3;                   // a stop joins the trip once half the group wants it
/** Stops along the coast, south to north. `h` and `mi` are the hours and miles driven from Los Angeles to get there. */
export const STOPS = [
  { id: 'la', name: 'Los Angeles', lat: 34.05, lon: -118.24, h: 0, mi: 0, fixed: true },
  { id: 'sb', name: 'Santa Barbara', lat: 34.42, lon: -119.7, h: 1.75, mi: 95, by: ['maya', false], votes: ['maya', 'sam', 'lina', 'omar'] },
  { id: 'pismo', name: 'Pismo Beach', lat: 35.14, lon: -120.64, h: 3.2, mi: 180, by: ['omar', false], votes: ['omar', 'kenji'] },
  { id: 'mcway', name: 'McWay Falls', lat: 36.16, lon: -121.67, h: 5.6, mi: 300, by: ['lina', false], votes: ['lina', 'maya', 'sam', 'kenji', 'zoe'] },
  { id: 'bixby', name: 'Bixby Bridge', lat: 36.37, lon: -121.9, h: 6.2, mi: 322, by: ['lina', true], votes: ['lina', 'zoe', 'omar'] },
  { id: 'monterey', name: 'Monterey', lat: 36.6, lon: -121.89, h: 6.7, mi: 340, by: ['sam', false], votes: ['sam', 'maya', 'kenji', 'omar'] },
  { id: 'cruz', name: 'Santa Cruz', lat: 36.97, lon: -122.03, h: 7.5, mi: 382, by: ['kenji', false], votes: ['kenji', 'maya'] },
  { id: 'sf', name: 'San Francisco', lat: 37.77, lon: -122.42, h: 8.9, mi: 455, fixed: true },
];
/* The coast itself, north to south, as [lat, lon]: enough points to draw it by hand. */
const COAST = [[38.5, -123.2], [38.0, -123.0], [37.81, -122.52], [37.75, -122.51], [37.46, -122.45], [37.1, -122.3], [36.95, -122.03], [36.8, -121.79], [36.62, -121.86], [36.64, -121.94], [36.55, -121.93], [36.31, -121.9], [36.16, -121.68], [35.78, -121.33], [35.56, -121.1], [35.37, -120.87], [35.14, -120.64], [34.9, -120.67], [34.58, -120.65], [34.45, -120.47], [34.47, -120.23], [34.41, -119.69], [34.27, -119.28], [34.09, -119.06], [34.03, -118.68], [34.01, -118.5], [33.74, -118.41], [33.75, -118.19], [33.4, -117.6]];
const X = lon => (lon + 123.9) * 15.2, Y = lat => (38.55 - lat) * 19;       // degrees to map units: 100 wide, 100 tall
/** A smooth line through points, as an SVG path (a Catmull-Rom spline written as cubic curves). */
function smooth(points) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
const TAB = { Stops: svg('<path d="M9 6.500h11M9 12h11M9 17.500h11"/><circle cx="4.500" cy="6.500" r="1.200"/><circle cx="4.500" cy="12" r="1.200"/><circle cx="4.500" cy="17.500" r="1.200"/>', 'stroke-width="1.7"'), Days: svg('<rect x="3.500" y="5" width="17" height="15.500" rx="3"/><path d="M3.500 10h17M8 3v4M16 3v4"/>', 'stroke-width="1.7"') };
const hm = h => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** Which stops are on the trip, and the two nights that keep the longest day's drive as short as it can be. */
export function fit(stops, mine) {
  const on = stops.filter(stop => stop.fixed || stop.votes.length + (mine.has(stop.id) ? 1 : 0) >= NEEDED);
  let best = null;
  for (let a = 1; a < on.length - 1; a++) for (let b = a + 1; b < on.length - 1; b++) {
    const legs = [on[a].h, on[b].h - on[a].h, on.at(-1).h - on[b].h], longest = Math.max(...legs);
    if (!best || longest < best.longest) best = { nights: [on[a], on[b]], legs, longest };
  }
  return { on, ...(best || { nights: [], legs: [on.at(-1).h], longest: on.at(-1).h }) };
}

const CSS = `
.tr-map { display: block; width: 100%; height: 13.200em; border-radius: .95em; background: #a9d3f5; }
.tr-map text { font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; }
.tr-n { flex: none; display: grid; place-items: center; width: 1.550em; height: 1.550em; border-radius: 50%; font-weight: 700; font-size: .78em; color: #fff; background: var(--tint); }
.tr-n--night { background: #af52de; }
.tr-n--off { color: #8e8e93; background: none; box-shadow: inset 0 0 0 1.500px #c7c7cc; }
`;

export default {
  id: 'trip', name: 'a/coast-trip', kind: 'private', planet: 2, community: COMMUNITIES.trip,
  dot: 'linear-gradient(180deg, #ff9a5a, #ff6f91 55%, #2a6f97 56%)',
  create(api) {
    const frame = phone({ community: COMMUNITIES.trip, tint: '#007aff', api });
    const mine = new Set();
    let script = 0, tab = 0, popped = null;

    const shore = COAST.map(([lat, lon]) => [X(lon), Y(lat)]);
    const land = `${smooth(shore)}L${X(-113)} ${Y(33.4)}L${X(-113)} ${Y(38.5)}Z`;
    const road = smooth(shore.filter((_, i) => COAST[i][0] <= 37.82 && COAST[i][0] >= 34.0).map(([x, y]) => [x + 1.5, y + 0.2]));
    const map = el('div', { html: `<svg class="tr-map" viewBox="-10 9 124 82" preserveAspectRatio="xMidYMid slice" role="img" aria-label="The coast of California from Los Angeles to San Francisco, with the stops of the trip">
      <defs><clipPath id="tr-land"><path d="${land}"/></clipPath><linearGradient id="tr-sea" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ccbf2"/><stop offset="1" stop-color="#b9dcf8"/></linearGradient></defs>
      <rect x="-30" y="0" width="180" height="100" fill="url(#tr-sea)"/>
      <path d="${land}" fill="#f7f3e9"/>
      <g clip-path="url(#tr-land)"><ellipse cx="33" cy="46" rx="9" ry="13" fill="#d7e8c5" transform="rotate(-38 33 46)"/><ellipse cx="62" cy="76" rx="17" ry="5" fill="#d7e8c5" transform="rotate(-12 62 76)"/><ellipse cx="80" cy="40" rx="12" ry="30" fill="#efe9d8"/><ellipse cx="26" cy="21" rx="6" ry="5" fill="#d7e8c5"/></g>
      <path d="${smooth(shore)}" fill="none" stroke="#fff" stroke-width="1.1"/>
      <path d="${road}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="${road}" fill="none" stroke="#0a84ff" stroke-width="1.5" stroke-linecap="round"/>
      <text x="4" y="66" font-size="3.6" font-style="italic" fill="#5f97c4">Pacific Ocean</text><g id="tr-pins"></g></svg>` }).firstChild;
    const pins = map.querySelector('#tr-pins');
    const ai = el('div', { class: 'io-ai' }), stops = el('ul', { class: 'io-group' }), days = el('ul', { class: 'io-group', hidden: true }), foot = el('p', { class: 'io-foot' });
    const seg = ['Stops', 'Days'].map((label, i) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), onclick: () => { api.take(); show(i); }, html: `${TAB[label]}<span>${label}</span>` }));
    frame.app.append(el('style', {}, CSS), frame.nav('Coast trip', el('span', { class: 'io-stack' }, ['maya', 'sam', 'kenji', 'lina', 'omar', 'zoe'].map(name => face(name)))),
      el('div', { class: 'io-scroll' }, map, el('div', { style: 'height:.75em' }), ai, el('div', { style: 'height:.75em' }), stops, days, foot), el('nav', { class: 'io-tabs', role: 'tablist' }, seg));

    function show(i) { tab = i; stops.hidden = i !== 0; days.hidden = i !== 1; seg.forEach((button, k) => button.setAttribute('aria-selected', String(k === i))); }
    function vote(id) { if (mine.has(id)) mine.delete(id); else mine.add(id); popped = id; draw(); }
    function draw() {
      const plan = fit(STOPS, mine);
      pins.innerHTML = STOPS.map(stop => {
        const n = plan.on.indexOf(stop), x = X(stop.lon) + 1.5, y = Y(stop.lat) + 0.2, night = plan.nights.includes(stop);
        const name = `<text x="${x + 4.6}" y="${y + 1.2}" font-size="3.3" font-weight="600" fill="${n < 0 ? '#8e8e93' : '#1c1c1e'}" paint-order="stroke" stroke="#fff" stroke-width=".9" stroke-linejoin="round">${stop.name}</text>`;
        return n < 0 ? `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff" stroke="#8e8e93" stroke-width=".7"/>${name}`
          : `<circle cx="${x}" cy="${y}" r="3.1" fill="${night ? '#af52de' : '#0a84ff'}" stroke="#fff" stroke-width=".9"/><text x="${x}" y="${y + 1.25}" font-size="3.4" font-weight="700" text-anchor="middle" fill="#fff">${n + 1}</text>${name}`;
      }).join('');
      ai.innerHTML = ICON.spark; ai.append(el('span', {}, el('b', {}, 'Sam’s AI fitted it into 3 days. '), `The longest drive is ${hm(plan.longest)}, and you sleep in ${plan.nights.map(stop => stop.name).join(' and ')}.`));
      stops.textContent = '';
      for (const stop of STOPS.filter(s => !s.fixed)) {
        const yes = mine.has(stop.id), count = stop.votes.length + (yes ? 1 : 0), n = plan.on.indexOf(stop);
        stops.append(el('li', { class: `io-cell${popped === stop.id ? ' pop' : ''}` },
          el('span', { class: `tr-n${n < 0 ? ' tr-n--off' : plan.nights.includes(stop) ? ' tr-n--night' : ''}` }, n < 0 ? '' : String(n + 1)),
          el('span', { class: 'io-cell-text' }, stop.name, el('small', {}, `${who(...stop.by)} added it · ${n < 0 ? `needs ${NEEDED - count} more` : plan.nights.includes(stop) ? 'you sleep here' : 'on the trip'}`)),
          el('button', { type: 'button', class: 'io-vote', 'aria-pressed': String(yes), 'aria-label': `${yes ? 'Take back your vote for' : 'Vote for'} ${stop.name}`, onclick: () => { api.take(); vote(stop.id); }, html: `${ICON.thumb}${count}` })));
      }
      const ends = [STOPS[0], ...plan.nights, STOPS.at(-1)];
      days.textContent = '';
      plan.legs.forEach((leg, i) => days.append(el('li', { class: 'io-cell' }, el('span', { class: 'io-cell-text' }, `Day ${i + 1}`,
        el('small', {}, plan.on.filter(stop => stop.h >= ends[i].h && stop.h <= ends[i + 1].h).map(stop => stop.name).join(' → '))), el('span', { class: 'io-cell-side' }, hm(leg)))));
      foot.textContent = `${STOPS.at(-1).mi} miles in all, about ${Math.round(STOPS.at(-1).mi / 28)} gallons in Omar’s car. A stop joins the trip at ${NEEDED} votes.`;
      popped = null;
    }

    return {
      el: frame.root, app: true, arrive: frame.arrive, leave: frame.leave, bare: frame.bare,
      enter() { mine.clear(); script = 0; draw(); show(0); },
      resize(w, h) { frame.fit(w, h); },
      /** The story's own run through the app: one vote, and the plan changes. */
      pilot(dt) {
        const was = script; script += dt;
        const at = t => was < t && script >= t;
        if (at(2.4)) vote('cruz');
        if (at(5.2)) show(1);
        return script > 8.4;
      },
      render() {},
      pick: () => null,
      screenOf: () => frame.orbAt(),
      tab: () => tab,
    };
  },
};
