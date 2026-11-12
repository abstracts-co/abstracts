// glsl.js: noise shared by the Storm planet and the Storm world, so the planet you fly to is the place you land in.
export const NOISE = `
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;
/** Storm's colours: v is 0..1 across the bands. */
export const BANDS = `
vec3 bands(float v) {
  vec3 a = vec3(0.985, 0.925, 0.78), b = vec3(0.90, 0.72, 0.50), c = vec3(0.74, 0.40, 0.22), d = vec3(0.45, 0.24, 0.16), e = vec3(1.0, 0.80, 0.52);
  v = fract(v);
  if (v < 0.22) return mix(a, b, v / 0.22);
  if (v < 0.45) return mix(b, c, (v - 0.22) / 0.23);
  if (v < 0.62) return mix(c, d, (v - 0.45) / 0.17);
  if (v < 0.82) return mix(d, e, (v - 0.62) / 0.20);
  return mix(e, a, (v - 0.82) / 0.18);
}
`;
