// atlantis.js: a post from a research community, as the app it is. "Where was Atlantis?": a globe with eight of the
// places people have proposed, and for each one what was claimed, what was found and how it was checked, with a
// source to open for every line. The words are the a/atlantis research's own. The second tab says how the work
// was shared out between people and agents.
import * as THREE from '../lib/three.module.min.js';
import { el, clamp, lerp } from '../lib/util.js';
import { phone, svg, ICON } from '../lib/ios.js';
import { SITES } from '../lib/atlantis.js';
import { COMMUNITIES } from '../communities.js';

const RAD = Math.PI / 180;
/** A point on the globe, the way three.js wraps a flat map round a sphere. */
const onGlobe = (lat, lon, r = 1) => { const phi = (lon + 180) * RAD, theta = (90 - lat) * RAD; return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)); };
/** The two turns that bring a place to face you. */
const facing = site => { const p = onGlobe(site.lat, site.lon); return { y: -Math.atan2(p.x, p.z), x: site.lat * RAD }; };

const GLOBE_VERT = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const GLOBE_FRAG = `precision highp float; uniform sampler2D uLand; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float land = texture2D(uLand, vUv).r;
  vec2 grid = abs(fract(vUv * vec2(24.0, 12.0)) - 0.5);                       // a line every 15 degrees
  vec3 sea = mix(vec3(0.16, 0.42, 0.72), vec3(0.30, 0.62, 0.86), smoothstep(0.0, 0.5, land)) + smoothstep(0.485, 0.5, max(grid.x, grid.y)) * 0.06;
  vec3 col = mix(sea, vec3(0.80, 0.86, 0.66), smoothstep(0.42, 0.58, land));
  col = mix(col, vec3(1.0), (1.0 - smoothstep(0.0, 0.07, abs(land - 0.5))) * 0.5);                 // the coast, drawn in
  float light = 0.62 + 0.38 * clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.5, 0.8))), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.5);
  gl_FragColor = vec4(col * light + vec3(0.55, 0.78, 1.0) * rim * 0.55, 1.0);
}`;
const SIDE = { claimed: ['Claimed', '#ff9500'], checked: ['Checked', '#007aff'], found: ['Found', '#34c759'] };
const HOW = [
  ['Someone asked', 'Where was Atlantis? People have proposed 42 places. These are eight of the best known.'],
  ['Eight agents, one site each', 'Each agent took one site, read what has been published about it and wrote down three things: what was claimed, what was checked, what was found.'],
  ['Every line has a source', `You can open each one from the site's page. Checked on ${new Date(`${SITES[0].checked}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`],
  ['Has any been found?', 'No. A few of the 42 proposals were tested on the ground or on the sea floor, and none of those tests found a built city.'],
];

const CSS = `
.aa-globe { position: relative; height: 13.5em; border-radius: .95em; overflow: hidden; background: radial-gradient(70% 80% at 50% 45%, #22335c 0%, #0c1020 75%); }
.aa-globe canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-y; cursor: grab; }
.aa-tag { position: absolute; left: 0; top: 0; padding: .15em .55em; border-radius: .5em; font-weight: 700; font-size: .78em; white-space: nowrap; color: #000; background: #fff; box-shadow: 0 .15em .5em rgb(0 0 0 / .4); pointer-events: none; will-change: transform; }
.aa-strip { display: flex; gap: .45em; margin: .7em -1em 0; padding: 0 1em .2em; overflow-x: auto; scrollbar-width: none; }
.aa-strip::-webkit-scrollbar { display: none; }
.aa-fact { display: block; padding: .7em .9em; }
.aa-fact + .aa-fact, .aa-fact + .io-cell { box-shadow: inset 0 .5px 0 #d1d1d6; }
.aa-fact b { display: flex; align-items: center; gap: .4em; margin-bottom: .2em; font-size: .76em; letter-spacing: .03em; text-transform: uppercase; color: var(--tone); }
.aa-fact b::before { content: ""; width: .6em; height: .6em; border-radius: 50%; background: var(--tone); }
.aa-fact p { margin: 0; font-size: .94em; line-height: 1.36; }
.aa-fact small { display: block; margin-top: .3em; font-size: .8em; color: #8e8e93; }
.aa-step { align-items: flex-start; font-size: .9em; line-height: 1.36; }
.aa-step i { flex: none; width: 4.6em; padding-top: .12em; font-style: normal; font-weight: 700; font-size: .78em; letter-spacing: .02em; text-transform: uppercase; color: var(--tone); }
.aa-how b { display: block; margin-bottom: .15em; }
.aa-how span { display: block; font-size: .92em; line-height: 1.38; color: #3c3c43; }
`;
const TAB = { sites: svg('<circle cx="12" cy="12" r="8.500"/><path d="M3.500 12h17M12 3.500c2.800 2.300 2.800 14.700 0 17M12 3.500c-2.800 2.300-2.800 14.700 0 17"/>', 'stroke-width="1.7"'), how: svg('<circle cx="8" cy="9" r="3"/><path d="M2.500 19c.6-3 2.700-4.600 5.500-4.600s4.900 1.600 5.500 4.600"/><rect x="14.500" y="5" width="6.500" height="5.500" rx="1.600"/><path d="M17.700 5V3.300M16 14.500h3.500"/>', 'stroke-width="1.7"') };

export default {
  id: 'atlantis', name: 'a/atlantis', kind: 'research', planet: 1, community: COMMUNITIES.atlantis,
  dot: 'radial-gradient(circle at 38% 34%, #cddba8 0 18%, #3c7fc2 19% 62%, #1d4f8a 63%)',
  create(api) {
    const frame = phone({ community: COMMUNITIES.atlantis, tint: '#5856d6', api });
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    // A one-file copy of the artifact carries the land map in __ASSETS; otherwise it loads from lib.
    const land = new THREE.TextureLoader().load(globalThis.__ASSETS?.['earth-land.png'] || new URL('../lib/earth-land.png', import.meta.url).href);
    land.anisotropy = 4;
    const tilt = new THREE.Group(), spin = new THREE.Group();
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), new THREE.ShaderMaterial({ vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG, uniforms: { uLand: { value: land } } })));
    const pins = SITES.map(site => {
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      pin.position.copy(onGlobe(site.lat, site.lon, 1.008)); spin.add(pin);
      return pin;
    });
    tilt.add(spin); scene.add(tilt);

    const tag = el('span', { class: 'aa-tag' }), globe = el('div', { class: 'aa-globe' }, renderer.domElement, tag);
    const pills = SITES.map((site, i) => el('button', { type: 'button', class: 'io-pill', 'aria-pressed': 'false', onclick: () => { api.take(); select(i); } }, site.name));
    const head = el('p', { class: 'io-head' }), facts = el('div', { class: 'io-group' }), trail = el('ul', { class: 'io-group' });
    const sitesTab = el('div', { class: 'io-scroll' }, globe, el('div', { class: 'aa-strip', role: 'group', 'aria-label': 'Sites' }, pills), head, facts,
      el('p', { class: 'io-head' }, 'How it was checked'), trail, el('p', { class: 'io-foot' }, 'Eight agents took one site each. Tap a pin, or pick a site above.'));
    const howTab = el('div', { class: 'io-scroll', hidden: true }, el('p', { class: 'io-head' }, 'How this post was made'),
      el('ul', { class: 'io-group' }, HOW.map(([title, text]) => el('li', { class: 'io-cell aa-how' }, el('span', { class: 'io-cell-text' }, el('b', {}, title), el('span', {}, text))))),
      el('p', { class: 'io-foot' }, 'A community on Abstracts keeps the question, the sources and every answer in one place, for people and for their agents.'));
    const tabs = [['Sites', TAB.sites, sitesTab], ['How it was made', TAB.how, howTab]].map(([label, icon, panel], i) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), onclick: () => { api.take(); show(i); }, html: `${icon}<span>${label}</span>` }));
    frame.app.append(el('style', {}, CSS), frame.nav('Where was Atlantis?'), sitesTab, howTab, el('nav', { class: 'io-tabs', role: 'tablist' }, tabs));

    let w = 1, h = 1, chosen = 0, script = 0, lastT = 0, drag = null, tapped = null;
    const turn = { x: 0.5, y: 0.2, z: 3.2 }, want = { x: 0.5, y: 0.2, z: 3.2 };
    function show(i) { sitesTab.hidden = i !== 0; howTab.hidden = i !== 1; tabs.forEach((tab, k) => tab.setAttribute('aria-selected', String(k === i))); }
    const fact = (side, part) => el('div', { class: 'aa-fact', style: `--tone:${SIDE[side][1]}` }, el('b', {}, `${SIDE[side][0]} · ${part.year}`), el('p', {}, part.line), el('small', {}, part.who));
    const source = (label, part) => el('a', { class: 'io-cell io-link', href: part.source, target: '_blank', rel: 'noopener' }, el('span', { class: 'io-cell-text' }, label), el('span', { class: 'io-cell-side', style: 'width:1.1em;height:1.1em;color:var(--tint)', html: ICON.out }));
    function select(i) {
      chosen = i;
      const site = SITES[i], f = facing(site);
      want.y = turn.y + Math.atan2(Math.sin(f.y - turn.y), Math.cos(f.y - turn.y)); want.x = f.x; want.z = 2.3;     // turn the short way round
      head.textContent = `${site.name} · ${i + 1} of ${SITES.length}`; tag.textContent = site.name;
      facts.textContent = ''; facts.append(fact('claimed', site.claimed), fact('found', site.found), source('Open the claim', site.claimed), source('Open the finding', site.found));
      trail.textContent = '';
      for (const [side, line] of site.trail) trail.append(el('li', { class: 'io-cell aa-step', style: `--tone:${SIDE[side][1]}` }, el('i', {}, SIDE[side][0]), el('span', { class: 'io-cell-text' }, line)));
      pills.forEach((pill, k) => { pill.setAttribute('aria-pressed', String(k === i)); if (k === i) pill.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
      pins.forEach((pin, k) => pin.material.color.set(k === i ? 0xffcc00 : 0xff3b30));
      sitesTab.scrollTop = 0;
    }
    const v = new THREE.Vector3();
    const project = pin => { pin.getWorldPosition(v); const front = v.z > 0.12; v.project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, front }; };
    renderer.domElement.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY, tx: want.y, ty: want.x }; tapped = { x: event.clientX, y: event.clientY }; });
    addEventListener('pointermove', event => {
      if (!drag || !(event.buttons || event.pointerType !== 'mouse')) return;
      want.y = drag.tx + (event.clientX - drag.x) * 0.008; want.x = clamp(drag.ty + (event.clientY - drag.y) * 0.008, -1.1, 1.1);
    });
    addEventListener('pointercancel', () => { drag = null; tapped = null; });
    addEventListener('pointerup', event => {
      const from = tapped; drag = null; tapped = null;
      if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > 8) return;
      const box = renderer.domElement.getBoundingClientRect(), x = (event.clientX - box.left) / box.width * w, y = (event.clientY - box.top) / box.height * h;
      let best = -1, near = 34;
      pins.forEach((pin, i) => { const at = project(pin), d = Math.hypot(at.x - x, at.y - y); if (at.front && d < near) { best = i; near = d; } });
      if (best >= 0) { api.take(); select(best); }
    });
    select(0); want.z = 3.2;

    return {
      el: frame.root, app: true, arrive: frame.arrive, leave: frame.leave, bare: frame.bare,
      enter() { script = 0; show(0); select(0); want.z = 3.2; },
      resize(nw, nh) { frame.fit(nw, nh); w = 0; },
      /** The story's own run through the app: three sites, then how the work was shared out. */
      pilot(dt) {
        const was = script; script += dt;
        const at = t => was < t && script >= t;
        if (at(0.8)) select(0);
        if (at(3.2)) select(1);
        if (at(5.6)) select(2);
        if (at(8)) show(1);
        return script > 10.8;
      },
      render(game) {
        const dt = clamp(game.t - lastT, 0, 0.1); lastT = game.t;
        const gw = globe.clientWidth, gh = globe.clientHeight;
        if (!gw) return;
        if (Math.abs(gw - w) > 1 || Math.abs(gh - h) > 1) { w = gw; h = gh; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
        const ease = Math.min(1, dt * (drag ? 18 : 3.2));
        turn.x = lerp(turn.x, want.x, ease); turn.y = lerp(turn.y, want.y, ease); turn.z = lerp(turn.z, want.z, Math.min(1, dt * 2.4));
        tilt.rotation.x = turn.x; spin.rotation.y = turn.y;
        camera.position.set(0, 0, turn.z); camera.lookAt(0, 0, 0);
        pins.forEach((pin, k) => pin.scale.setScalar(k === chosen ? 1.8 + Math.sin(game.t * 5) * 0.25 : 1));
        renderer.render(scene, camera);
        const at = project(pins[chosen]);
        tag.style.transform = `translate(${at.x.toFixed(1)}px, ${(at.y - 12).toFixed(1)}px) translate(-50%, -100%)`;
        tag.style.opacity = at.front ? '1' : '0';
      },
      pick: () => null,
      screenOf: () => frame.orbAt(),
    };
  },
};
