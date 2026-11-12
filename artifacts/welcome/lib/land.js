// land.js: the shape of the island as numbers: how far every point is from the coast, how high the ground is,
// and how much path or tall grass is near. The 3D world builds its ground from it and the painting flows along it.
import { hash2, clamp, lerp } from './util.js';
import { W, H, tile } from './town.js';

export const GROUND = 0.3;          // how high the land is above the sea
export const LAMPS = [[9.22, 16], [6.9, 12.98], [9.22, 10.2], [7, 7], [11, 14.1], [11.1, 3.9]];   // street lamps, beside the path

export const land = (x, y) => { const t = tile(x, y); return t !== '~' && t !== 'b'; };
export const fade = t => t * t * (3 - 2 * t);
export const ramp = (a, b, v) => fade(clamp((v - a) / (b - a)));
export function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
  return lerp(lerp(hash2(x0, y0), hash2(x0 + 1, y0), fx), lerp(hash2(x0, y0 + 1), hash2(x0 + 1, y0 + 1), fx), fy);
}
/* How far every point is from the coast, in tiles (negative on land), worked out once on a grid of 4 points a tile. */
export const PAD = 3, RES = 4, SIDE = (W + PAD * 2) * RES + 1;
export const FIELD = (() => {
  const tx = [], ty = [], solid = [];
  for (let y = -PAD - 1; y < H + PAD + 1; y++) for (let x = -PAD - 1; x < W + PAD + 1; x++) { tx.push(x); ty.push(y); solid.push(land(x, y)); }
  const field = new Float32Array(SIDE * SIDE);
  for (let j = 0; j < SIDE; j++) for (let i = 0; i < SIDE; i++) {
    const x = i / RES - PAD, z = j / RES - PAD;
    let out = 9, inn = 9;
    for (let k = 0; k < tx.length; k++) {
      const dx = Math.max(tx[k] - x, 0, x - tx[k] - 1), dz = Math.max(ty[k] - z, 0, z - ty[k] - 1), d = Math.sqrt(dx * dx + dz * dz);
      if (solid[k]) { if (d < out) out = d; } else if (d < inn) inn = d;
    }
    field[j * SIDE + i] = out > 0 ? out : -inn;
  }
  return field;
})();
export function shore(x, z) {
  const u = clamp((x + PAD) * RES, 0, SIDE - 1.001), v = clamp((z + PAD) * RES, 0, SIDE - 1.001), i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
  return lerp(lerp(FIELD[j * SIDE + i], FIELD[j * SIDE + i + 1], fx), lerp(FIELD[(j + 1) * SIDE + i], FIELD[(j + 1) * SIDE + i + 1], fx), fy);
}
/** The coast with a wobble, so the island's edge is not made of squares. */
export const coast = (x, z) => shore(x, z) + (vnoise(x * 0.9 + 3, z * 0.9 + 5) - 0.5) * 0.5;
/** Height of the ground: gentle rises inland, a beach that slopes under the sea. */
export const heightAt = (x, z) => { const s = coast(x, z); return lerp(GROUND + (vnoise(x * 0.45 + 7, z * 0.45 + 3) - 0.5) * 0.09 * ramp(0, -1.5, s), -0.4, ramp(-0.1, 0.9, s)); };
/** How much of a kind of tile ('=' path, ':' tall grass) is around a point, 0..1, blended between tile centres. */
export function cover(kind, x, z) {
  const u = x - 0.5, v = z - 0.5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, at = (a, b) => (tile(a, b) === kind ? 1 : 0);
  return lerp(lerp(at(i, j), at(i + 1, j), fx), lerp(at(i, j + 1), at(i + 1, j + 1), fx), fy);
}
