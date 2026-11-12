// sound.js: the sounds, the music and the narrator. Browsers allow no sound until the visitor has touched the page,
// so nothing plays before the first tap or key press; after that the speaker button turns it off and on.
// The files are in ./sfx.
const NAMES = ['step-pixel', 'step-poly', 'orb', 'shift-poly', 'open', 'dive', 'leave', 'finale', 'talk-pixel', 'talk-bubble', 'ui', 'amb-island', 'amb-space', 'music',
  'vo-intro-1', 'vo-intro-2', 'vo-intro-3', 'vo-builders', 'vo-pixel', 'vo-poly', 'vo-poly-2', 'vo-atlantis', 'vo-atlantis-2', 'vo-trip', 'vo-trip-2', 'vo-house', 'vo-house-2', 'vo-outro', 'vo-finale-1', 'vo-finale-2'];
/* How loud each sound is against the rest: square waves and bass sound much louder than their peaks say. */
const LEVEL = { 'step-pixel': 0.3, 'talk-pixel': 0.45, 'leave': 0.8 };
/** A one-file copy of the artifact carries its sounds in `__SFX`; otherwise they load from the folder beside this file. */
const address = name => globalThis.__SFX?.[name] || new URL(`./sfx/${name}.mp3`, import.meta.url).href;

export function createSound() {
  let ctx = null, master = null, under = null, on = true, bed = null, want = null, tune = null, wantTune = false, voice = null, asleep = false, since = 0;
  const buffers = new Map(), loading = new Map();
  function load(name) {
    if (!loading.has(name)) {
      loading.set(name, fetch(address(name)).then(res => res.arrayBuffer()).then(data => ctx.decodeAudioData(data))
        .then(buffer => { buffers.set(name, buffer); return buffer; }).catch(() => null));
    }
    return loading.get(name);
  }
  const api = {
    /** True once sound can be heard: the visitor has touched the page and has not turned it off. */
    get on() { return Boolean(ctx) && on; },
    /** Call from a tap or key press. The first call starts the sound; later ones are free. */
    unlock() {
      if (ctx) { if (ctx.state === 'suspended' && !asleep) ctx.resume().catch(() => {}); return; }
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      try { ctx = new Context(); } catch { return; }
      since = performance.now();
      master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
      under = ctx.createGain(); under.connect(master);       // the music and the background, which dip while the narrator speaks
      for (const name of NAMES) load(name);
      if (want) api.ambience(want.name, want.volume);
      if (wantTune) api.music(true);
    },
    /** Turn sound off or on. A press that has only just started the sound leaves it on. */
    toggle() {
      if (!ctx) { on = true; api.unlock(); return api.on; }
      if (performance.now() - since < 700) return on;
      on = !on;
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
      return on;
    },
    /** Play a short sound once. */
    play(name, { volume = 1, rate = 1 } = {}) {
      if (!ctx || !on || asleep) return;
      const buffer = buffers.get(name);
      if (!buffer) { load(name); return; }
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = volume * (LEVEL[name] ?? 1);
      source.connect(gain).connect(master); source.start();
    },
    /** Fade to a looping background sound, or to quiet with no name. */
    async ambience(name, volume = 0.4) {
      want = name ? { name, volume } : null;
      if (!ctx || (bed ? bed.name : null) === name) return;
      if (bed) { const old = bed; bed = null; old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { old.source.stop(); } catch { /* already stopped */ } }, 2400); }
      if (!name) return;
      const buffer = await load(name);
      if (!buffer || want?.name !== name || bed) return;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      // MP3 files carry a sliver of silence at each end: loop just inside them.
      source.buffer = buffer; source.loop = true; source.loopStart = 0.06; source.loopEnd = buffer.duration - 0.06;
      gain.gain.value = 0; gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.7);
      source.connect(gain).connect(under); source.start(0, 0.06);
      bed = { name, source, gain };
    },
    /** The music under the whole story: on from the dive, off when asked. */
    async music(play) {
      wantTune = play;
      if (!ctx) return;
      if (!play) { if (tune) { const old = tune; tune = null; old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5); setTimeout(() => { try { old.source.stop(); } catch { /* already stopped */ } }, 2600); } return; }
      if (tune) return;
      const buffer = await load('music');
      if (!buffer || !wantTune || tune) return;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.loop = true; source.loopStart = 0.06; source.loopEnd = buffer.duration - 0.06;
      gain.gain.value = 0; gain.gain.setTargetAtTime(0.3, ctx.currentTime, 1.2);
      source.connect(gain).connect(under); source.start(0, 0.06);
      tune = { source, gain };
    },
    /** The narrator says a line, and the music and background dip under it. A new line cuts the last one short. */
    say(name) {
      if (!ctx || !on || asleep) return;
      const buffer = buffers.get(name);
      if (!buffer) { load(name); return; }
      const source = ctx.createBufferSource(), gain = ctx.createGain(), now = ctx.currentTime;
      if (voice) { const old = voice; old.gain.gain.setTargetAtTime(0, now, 0.05); setTimeout(() => { try { old.source.stop(); } catch { /* already over */ } }, 400); }
      voice = { source, gain };
      source.onended = () => { if (voice?.source === source) voice = null; };
      source.buffer = buffer; gain.gain.value = 1;
      source.connect(gain).connect(master); source.start();
      under.gain.cancelScheduledValues(now); under.gain.setTargetAtTime(0.4, now, 0.08); under.gain.setTargetAtTime(1, now + buffer.duration + 0.15, 0.4);
    },
    /** Quiet while the artifact is off screen or the tab is hidden. */
    sleep(yes) {
      asleep = yes;
      if (!ctx) return;
      if (yes) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
    },
  };
  return api;
}
