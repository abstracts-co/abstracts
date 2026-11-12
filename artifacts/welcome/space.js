// space.js: the solar system the story starts and ends in. three.js draws the sun, the orbits and the planets,
// and flies the camera from the whole system down to a planet until it fills the stage.
import * as THREE from './lib/three.module.min.js';
import { clamp, lerp, ease, rand, el } from './lib/util.js';

const FOV = 38;
const TAN = Math.tan((FOV / 2) * Math.PI / 180);
const SUN_R = 1.35;

const SUN_VERT = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`;
const SUN_FRAG = `precision highp float; uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float g = noise(vP * 3.2 + t * 0.12) * 0.6 + noise(vP * 7.5 - t * 0.2) * 0.4;
  float k = pow(f, 1.15) + (g - 0.5) * 0.2 * smoothstep(0.05, 0.6, f);
  vec3 c = mix(vec3(0.79, 0.145, 0.10), vec3(1.0, 0.54, 0.12), smoothstep(0.0, 0.34, k));
  c = mix(c, vec3(1.0, 0.84, 0.40), smoothstep(0.34, 0.86, k));
  c = mix(c, vec3(1.0, 0.95, 0.70), smoothstep(0.86, 1.08, k));
  gl_FragColor = vec4(c, 1.0);
}`;

function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, color] of stops) r.addColorStop(at, color);
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * host: the element the canvas goes in. worlds: [{ id, name, orbit: { r, size, phase, speed, spin, tilt }, planet(THREE) }];
 * a planet with a name gets a label. onPick(i) is called when a planet is tapped.
 */
export function createSpace(host, worlds, onPick) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x06060a);
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 900);
  let w = 1, h = 1, clock = 0, orbitClock = 0, orbitRate = 1, orbitRateTo = 1;

  /* stars */
  {
    const rnd = rand(11), n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 300;
      pos.set([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R], i * 3);
      const b = 0.25 + Math.pow(rnd(), 3) * 0.75, warm = rnd() > 0.8 ? 0.85 : 1;
      col.set([b, b * (warm < 1 ? 0.86 : 0.95), b * warm], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    stars.name = 'stars'; scene.add(stars);
  }

  /* sun */
  const sunMat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { t: { value: 0 } } });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), sunMat);
  scene.add(sun);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,214,120,1)'], [0.2, 'rgba(255,138,31,.85)'], [0.36, 'rgba(228,72,15,.4)'], [0.62, 'rgba(160,30,18,.12)'], [1, 'rgba(120,20,12,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(SUN_R * 6.2); scene.add(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,110,40,.34)'], [0.3, 'rgba(200,50,20,.16)'], [0.7, 'rgba(120,24,14,.05)'], [1, 'rgba(90,16,10,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(SUN_R * 22); scene.add(halo);
  scene.add(new THREE.PointLight(0xfff0dc, 2.9, 0, 0));
  scene.add(new THREE.AmbientLight(0xbdb4ae, 0.5));
  // A soft light from the camera, so a planet's night side still shows what it is.
  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(0.4, 0.6, 1); camera.add(fill); camera.add(fill.target); fill.target.position.set(0, 0, -1); scene.add(camera);

  /* orbits and planets */
  const planets = worlds.map((world, i) => {
    const o = world.orbit;
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos((k / 160) * Math.PI * 2) * o.r, 0, Math.sin((k / 160) * Math.PI * 2) * o.r))),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false }));
    scene.add(ring);
    const pivot = new THREE.Group(), tiltG = new THREE.Group(), spinG = new THREE.Group();
    let made = null;
    try { made = world.planet(THREE); } catch (error) { console.warn(`planet ${world.id}:`, error); }
    if (!made) made = { object: new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshLambertMaterial({ color: 0x8899aa })) };
    spinG.add(made.object); if (made.still) tiltG.add(made.still);
    tiltG.add(spinG); tiltG.rotation.z = o.tilt || 0; tiltG.scale.setScalar(o.size);
    pivot.add(tiltG); scene.add(pivot);
    const label = el('span', { class: 'planet-label' }, world.name || '');
    if (world.name) host.append(label);
    return { world, o, pivot, spinG, made, ring, label, index: i };
  });
  const maxOrbit = Math.max(...worlds.map(wd => wd.orbit.r));
  const labelStyle = el('style', {}, `.planet-label{position:absolute;left:0;top:0;font:700 12px/1 var(--sans);letter-spacing:.02em;color:rgb(255 255 255/.86);text-shadow:0 1px 8px #000;pointer-events:none;white-space:nowrap;opacity:0;transition:opacity .4s ease;will-change:transform}.planet-labels .planet-label{opacity:1}`);
  host.append(labelStyle);

  const place = () => {
    for (const p of planets) {
      const a = p.o.phase + orbitClock * p.o.speed;
      p.pivot.position.set(Math.cos(a) * p.o.r, 0, Math.sin(a) * p.o.r);
      p.spinG.rotation.y = clock * (p.o.spin ?? 0.25);
      p.made.tick?.(clock);
    }
  };

  /* camera poses */
  let framing = null;               // { tilt, zoom, side }: a hand-set view of the whole system, for pictures
  const overview = () => {
    const aspect = w / h;
    const tilt = framing ? framing.tilt : aspect < 1 ? 0.88 : 0.5;
    const R = maxOrbit + 1.2;
    const dist = Math.max(R / (TAN * aspect), (R * Math.sin(tilt) + 2.4) / TAN) * 1.02 * (framing ? framing.zoom : 1);
    const shift = framing ? 0 : aspect < 1 ? R * 0.2 : R * 0.12;
    if (framing) return { pos: new THREE.Vector3(framing.side * R, dist * Math.sin(tilt), dist * Math.cos(tilt)), look: new THREE.Vector3(framing.side * R, 0, 0) };
    return { pos: new THREE.Vector3(0, dist * Math.sin(tilt), dist * Math.cos(tilt) + shift), look: new THREE.Vector3(0, 0, shift) };
  };
  /** A camera pose that shows planet `i` with radius `fill` * min(w, h) pixels, from its sunlit side. */
  const closeup = (i, fill) => {
    const p = planets[i], P = p.pivot.position.clone(), out = P.clone().normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const dir = out.multiplyScalar(-0.3).add(side.multiplyScalar(0.74)).add(new THREE.Vector3(0, 0.4, 0)).normalize();
    const px = fill * Math.min(w, h), k = (h / 2) / (TAN * px);
    const dist = p.o.size * Math.sqrt(1 + k * k);
    return { pos: P.clone().add(dir.multiplyScalar(dist)), look: P };
  };
  const coverFill = () => (Math.hypot(w, h) * 0.56) / Math.min(w, h);
  const poseOf = (shot, fill) => (shot.planet == null ? overview() : closeup(shot.planet, fill ?? shot.fill));

  let from = null, to = { planet: null }, tween = 1, tweenLength = 1, tweenEase = ease.inOut, startPose = null;
  const current = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  /** Move the camera to a shot: { planet: null } for the whole system, or { planet: i, fill }. `seconds` 0 jumps. */
  function go(shot, seconds = 1.4, easing = ease.inOut) {
    from = to; to = shot; startPose = { pos: current.pos.clone(), look: current.look.clone() };
    tween = seconds > 0 ? 0 : 1; tweenLength = Math.max(0.001, seconds); tweenEase = easing;
    orbitRateTo = shot.planet == null ? 1 : 0;
  }
  function frameCamera() {
    const k = tweenEase(clamp(tween));
    let pose;
    if (tween >= 1) pose = poseOf(to);
    else if (from && from.planet != null && from.planet === to.planet) pose = closeup(to.planet, from.fill * Math.pow(to.fill / from.fill, k));
    else { const end = poseOf(to); pose = { pos: startPose.pos.clone().lerp(end.pos, k), look: startPose.look.clone().lerp(end.look, k) }; }
    current.pos.copy(pose.pos); current.look.copy(pose.look);
    camera.position.copy(pose.pos); camera.lookAt(pose.look);
    camera.updateMatrixWorld();
  }
  /** Where planet `i` is on the stage, in CSS pixels: centre and radius. */
  function circle(i) {
    const p = planets[i], v = p.pivot.position.clone().project(camera);
    const d = camera.position.distanceTo(p.pivot.position);
    const r = (h / 2) / TAN * (p.o.size / Math.sqrt(Math.max(1e-6, d * d - p.o.size * p.o.size)));
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, r, front: v.z < 1 };
  }

  /* picking */
  let down = null;
  const hit = (e) => {
    const box = host.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    let best = -1, bestD = Infinity;
    planets.forEach((p, i) => { const c = circle(i), d = Math.hypot(c.x - x, c.y - y); if (c.front && d < Math.max(c.r * 1.15, 26) && d < bestD) { best = i; bestD = d; } });
    return best;
  };
  host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  host.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) { const i = hit(e); if (i >= 0) onPick(i); } down = null; });
  host.addEventListener('pointermove', e => { host.style.cursor = hit(e) >= 0 ? 'pointer' : ''; });

  return {
    THREE, go, circle, coverFill,
    get moving() { return tween < 1; },
    labels(on) { host.classList.toggle('planet-labels', on); },
    frame(tilt, zoom, side = 0) { framing = { tilt, zoom, side }; },
    /** Stop the planets at these angles (radians), one per world. */
    hold(angles) { planets.forEach((p, i) => { if (Number.isFinite(angles[i])) p.o = { ...p.o, phase: angles[i], speed: 0 }; }); },
    resize(nw, nh, dpr) {
      w = nw; h = nh;
      renderer.setPixelRatio(Math.min(dpr, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      scene.getObjectByName('stars').material.size = 1.7 * Math.min(dpr, 2);
    },
    update(dt) {
      clock += dt; sunMat.uniforms.t.value = clock;
      orbitRate = lerp(orbitRate, orbitRateTo, 1 - Math.exp(-dt * 3));
      orbitClock += dt * orbitRate;
      if (tween < 1) tween = Math.min(1, tween + dt / tweenLength);
      place(); frameCamera();
    },
    render() {
      renderer.render(scene, camera);
      const circles = planets.map(p => circle(p.index));
      planets.forEach((p, i) => {
        const c = circles[i], y = c.y + c.r + 13;
        const covered = circles.some((o, k) => k !== i && Math.hypot(o.x - c.x, o.y - y) < o.r + 12);
        p.label.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y + c.r + 7)}px) translateX(-50%)`;
        p.label.style.visibility = covered ? 'hidden' : '';
      });
    },
  };
}
