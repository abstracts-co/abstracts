// planets.js: the planets around the sun. The first one is ours: the island you play on is on it.
// The others are there because every planet is a community, each made its own way.
import { hash2, rand } from './lib/util.js';
import { NOISE, BANDS } from './lib/glsl.js';

const smooth = t => t * t * (3 - 2 * t);
/** Value noise that wraps every `px` cells across, so a planet's map has no seam. */
function wrapNoise(x, y, px, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const at = (ix, iy) => hash2(((ix % px) + px) % px + seed * 57, iy + seed * 131);
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}
const h3 = (x, y, z) => hash2(x * 31 + z * 17, y * 13 + z * 7);
/** Smooth 3D value noise, 0..1. */
function noise3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const mix = (a, b, t) => a + (b - a) * t;
  const plane = iz => mix(mix(h3(x0, y0, iz), h3(x0 + 1, y0, iz), fx), mix(h3(x0, y0 + 1, iz), h3(x0 + 1, y0 + 1, iz), fx), fy);
  return mix(plane(z0), plane(z0 + 1), fz);
}
const height = (x, y, z) => (noise3(x * 1.6 + 5, y * 1.6 + 9, z * 1.6 + 2) * 0.65 + noise3(x * 3.4, y * 3.4, z * 3.4) * 0.35 - 0.5) * 0.5;
const LAND = { deep: '#2f62b8', sea: '#3f7fd6', sand: '#f0d9a0', grass: '#63c06b', forest: '#3c9a55', rock: '#9a8f85', snow: '#ffffff' };
const landColor = (h, lat) => (Math.abs(lat) > 0.86 ? LAND.snow : h < -0.04 ? LAND.deep : h < 0 ? LAND.sea : h < 0.02 ? LAND.sand : h < 0.075 ? LAND.grass : h < 0.12 ? LAND.forest : h < 0.16 ? LAND.rock : LAND.snow);
/** A faceted globe: an icosphere pushed in and out by `height`, each face one flat colour. */
function globe(THREE, detail = 3, relief = 1) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const hs = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), h = height(x, y, z);
    hs.push(h);
    const r = 1 + Math.max(0, h) * relief;
    pos.setXYZ(i, x * r, y * r, z * r);
  }
  for (let f = 0; f < pos.count; f += 3) {
    const h = (hs[f] + hs[f + 1] + hs[f + 2]) / 3, lat = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    c.set(landColor(h, lat));
    const shade = 0.94 + hash2(f, 7) * 0.12;
    for (let k = 0; k < 3; k++) colors.set([c.r * shade, c.g * shade, c.b * shade], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}
function textured(THREE, width, height, paint, pixelated = false) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  paint(c.getContext('2d'));
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  if (pixelated) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; } else map.anisotropy = 4;
  return { object: new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshLambertMaterial({ map })) };
}

export const PLANETS = [
  {
    id: 'home', name: 'a/builders',
    orbit: { r: 3.5, size: 0.62, phase: 2.5, speed: 0.16, spin: 0.5, tilt: 0.25 },
    planet: THREE => textured(THREE, 64, 32, g => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
        const n = wrapNoise(x / 8, y / 8, 8, 1) * 0.62 + wrapNoise(x / 4, y / 4, 16, 2) * 0.38;
        const pole = Math.abs(y - 15.5) / 15.5;
        let color = n < 0.36 ? '#3d94cf' : n < 0.5 ? '#58b3e6' : n < 0.53 ? '#ecd9a9' : n < 0.66 ? '#8fd16a' : '#4f9e45';
        if (pole > 0.86 - n * 0.12) color = '#fffdf8';
        g.fillStyle = color; g.fillRect(x, y, 1, 1);
      }
    }, true),
  },
  {
    id: 'poly', name: 'a/atlantis',
    orbit: { r: 5.1, size: 0.72, phase: 5.4, speed: 0.12, spin: 0.4, tilt: -0.3 },
    planet: THREE => ({ object: globe(THREE, 5, 1) }),
  },
  {
    id: 'storm', name: 'a/coast-trip',
    orbit: { r: 7.2, size: 1.08, phase: 3.6, speed: 0.08, spin: 0.5, tilt: 0.35 },
    planet(THREE) {
      const uniforms = { t: { value: 0 } };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
          void main() { vP = position; vWN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `precision highp float; uniform float t; varying vec3 vP; varying vec3 vWN; varying vec3 vWP;
          ${NOISE} ${BANDS}
          void main() {
            float f = fbm3(vec3(vP.x * 1.4, vP.y * 5.0, vP.z * 1.4) + vec3(0.0, 0.0, t * 0.03));
            vec3 col = bands((vP.y * 1.5 + f * 0.42) * 0.9) * (0.74 + 0.5 * f);
            float dif = max(dot(normalize(vWN), normalize(-vWP)), 0.0);
            gl_FragColor = vec4(col * (0.3 + 0.95 * dif), 1.0);
          }`,
      });
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const g = c.getContext('2d'), grad = g.createRadialGradient(512, 512, 318, 512, 512, 512);
      for (let i = 0; i <= 60; i++) {
        const k = i / 60, gap = (k > 0.5 && k < 0.58) || k > 0.96 || k < 0.03;
        const alpha = gap ? 0.04 : 0.42 + 0.3 * Math.sin(k * 23) * Math.sin(k * 7 + 1);
        grad.addColorStop(k, `rgba(${Math.round(236 - k * 46)}, ${Math.round(206 - k * 56)}, ${Math.round(166 - k * 56)}, ${alpha.toFixed(3)})`);
      }
      g.fillStyle = grad; g.fillRect(0, 0, 1024, 1024);
      const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 2.12, 128), new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      return { object: new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material), still: ring, tick(t) { uniforms.t.value = t; } };
    },
  },
  {
    id: 'pads', name: 'a/our-house',
    orbit: { r: 9.1, size: 0.7, phase: 0.6, speed: 0.06, spin: 0.35, tilt: 0.15 },
    planet: THREE => textured(THREE, 512, 256, g => {
      const rnd = rand(5), colors = ['#ff5c8a', '#ffd766', '#ffb84d', '#fbf4e4'];   // lit windows at night
      g.fillStyle = '#2a2140'; g.fillRect(0, 0, 512, 256);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 16; col++) {
        g.fillStyle = rnd() < 0.34 ? colors[row % 4] : '#3d3160';
        g.beginPath(); g.roundRect(col * 32 + 4, row * 32 + 4, 24, 24, 5); g.fill();
      }
    }),
  },
  {
    id: 'paper', name: 'yours?',
    orbit: { r: 10.7, size: 0.55, phase: 4.5, speed: 0.05, spin: 0.3, tilt: -0.2 },
    planet: THREE => textured(THREE, 512, 256, g => {
      const rnd = rand(9);
      g.fillStyle = '#f6f0e6'; g.fillRect(0, 0, 512, 256);
      for (let col = 0; col < 4; col++) for (let row = 0; row < 15; row++) {
        const x = col * 128 + 12, y = 22 + row * 15, heading = row % 6 === 0;
        g.fillStyle = heading ? '#2a2420' : rnd() < 0.08 ? '#ff7a14' : '#a89c8c';
        g.fillRect(x, y, heading ? 60 + rnd() * 30 : 60 + rnd() * 44, heading ? 6 : 3);
      }
    }),
  },
];
