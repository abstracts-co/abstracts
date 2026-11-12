import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const repo = new URL('../', import.meta.url);
const root = new URL('artifacts/welcome/', repo);
const town = await import(new URL('lib/town.js', root));
const { createGame, SITES, THINGS, AGENT } = await import(new URL('game.js', root));
const { SITES: PROPOSED } = await import(new URL('lib/atlantis.js', root));
const { fit } = await import(new URL('apps/trip.js', root));
const { COMMUNITIES } = await import(new URL('communities.js', root));
const { PLANETS } = await import(new URL('planets.js', root));
const exists = url => access(url).then(() => true, () => false);
const FORMS = ['pixel', 'poly', 'atlantis', 'trip', 'house'];
const WALKED = ['pixel', 'poly'];   // the two forms of the island, which you walk in; the other three are apps on a phone
const run = (game, seconds, story = false, until = () => false) => { for (let t = 0; t < seconds && !until(); t += 1 / 30) game.update(1 / 30, story); };

test('the island: the orb and every thing you can talk to can be walked to', () => {
  const { PLACES, walkable, isTall, findPath } = town;
  const taken = (x, y) => x === PLACES.neighbour.x && y === PLACES.neighbour.y;
  assert.ok(walkable(PLACES.spawn.x, PLACES.spawn.y) && walkable(PLACES.spawn.x, PLACES.spawn.y + 1), 'room to start, with the agent behind you');
  assert.equal(SITES.length, WALKED.length, 'one place for the orb in each form of the island');
  let from = PLACES.spawn;
  for (const site of SITES.slice(0, WALKED.length)) {
    assert.ok(walkable(site.x, site.y) && !taken(site.x, site.y), `orb at ${site.x},${site.y}: nowhere to stand`);
    assert.ok(findPath(from, site, taken), `no way to the orb at ${site.x},${site.y}`);
    from = site;
  }
  assert.ok(isTall(SITES[0].x, SITES[0].y), 'the idea lands in the tall grass');
  for (const thing of THINGS) {
    assert.ok(walkable(thing.stand.x, thing.stand.y) && !taken(thing.stand.x, thing.stand.y), `${thing.id}: nowhere to stand`);
    assert.ok(findPath(PLACES.spawn, thing.stand, taken), `${thing.id}: no way there`);
  }
  for (const id of WALKED) assert.ok(AGENT[id], `the agent has nothing to say in ${id}`);
});

test('the story: left alone, it walks to the orb in both worlds, and waits while the world changes', () => {
  let touched = 0, over = false, changed = null;
  const game = createGame(FORMS, {
    orb() {
      touched++;
      if (game.form + 1 >= WALKED.length) { game.frozen = true; over = true; return; }   // next is another planet: the walking stops
      game.hopOrb(game.form + 1); game.form++; changed = game.t;
    },
  });
  let stray = 0;
  for (let t = 0; t < 150 && !over; t += 1 / 30) {
    game.update(1 / 30, true);
    if (changed != null && game.moving()) stray++;                              // while the world changes, the story must not walk on
    if (changed != null && game.t - changed > 2.2) { changed = null; game.startChapter(); }
  }
  assert.equal(stray, 0, 'the story walked on while the world was still changing');
  assert.equal(touched, WALKED.length, `the story stopped in the ${FORMS[game.form]} form`);
  assert.deepEqual([game.player.x, game.player.y], [SITES[1].x, SITES[1].y], 'it ends at the second orb');
});

test('exploring: keys and taps move you, the agent follows, and nothing moves by itself', () => {
  const game = createGame(FORMS);
  const start = { x: game.player.x, y: game.player.y };
  run(game, 5);
  assert.deepEqual([game.player.x, game.player.y], [start.x, start.y], 'the story is paused, so you stay put');
  game.key({ key: 'ArrowUp' }); game.keyup({ key: 'ArrowUp' });   // a quick press, let go before the next frame
  run(game, 1);
  assert.deepEqual([game.player.x, game.player.y], [start.x, start.y - 1], 'one press is one step');
  assert.deepEqual([game.buddy.x, game.buddy.y], [start.x, start.y], 'the agent steps into the tile you left');
  const sign = THINGS.find(thing => thing.id === 'sign');
  game.tap(sign.tiles[0][0], sign.tiles[0][1]);
  run(game, 1.5);
  assert.deepEqual([game.player.x, game.player.y], [sign.stand.x, sign.stand.y], 'a tap on a thing walks you up to it');
  assert.equal(game.cap?.who, sign.who, 'and it speaks');
  game.tap(0, 0);   // the sea
  run(game, 1);
  assert.deepEqual([game.player.x, game.player.y], [sign.stand.x, sign.stand.y], 'a tap on the sea does nothing');
});

test('the Atlantis app: eight sites, each with what was claimed and found, a trail and sources to open', () => {
  assert.equal(PROPOSED.length, 8);
  for (const site of PROPOSED) {
    assert.ok(site.name && Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180, `${site.id}: where is it?`);
    for (const side of ['claimed', 'found']) {
      assert.ok(site[side].line.length > 40 && site[side].who && site[side].year, `${site.id}: nothing ${side}`);
      assert.match(site[side].source, /^https:\/\//, `${site.id}: the ${side} line has no source to open`);
    }
    assert.ok(site.trail.length >= 5 && site.trail.every(([side, line]) => ['claimed', 'checked', 'found'].includes(side) && line.length > 30), `${site.id}: the trail is thin`);
  }
});

test('the trip app: a stop joins the trip at three votes, and the days are fitted around it', () => {
  const stops = [
    { id: 'a', h: 0, fixed: true }, { id: 'b', h: 2, votes: ['x', 'y', 'z'] }, { id: 'c', h: 3.5, votes: ['x', 'y'] },
    { id: 'd', h: 6, votes: ['x', 'y', 'z'] }, { id: 'e', h: 9, fixed: true },
  ];
  const before = fit(stops, new Set());
  assert.deepEqual(before.on.map(stop => stop.id), ['a', 'b', 'd', 'e'], 'two votes is not enough');
  assert.equal(before.longest, 4, 'nights at b and d: 2 h, 4 h, 3 h');
  const after = fit(stops, new Set(['c']));
  assert.deepEqual(after.on.map(stop => stop.id), ['a', 'b', 'c', 'd', 'e'], 'your vote puts it on the trip');
  assert.equal(after.longest, 3.5, 'nights at c and d now: 3.5 h, 2.5 h, 3 h');
});

test('the communities: one for each audience, each with a page to show and a planet of its own', () => {
  const all = Object.values(COMMUNITIES);
  assert.equal(all.length, 4, 'builders, the curious, friends and a house');
  for (const community of all) {
    assert.match(community.slug, /^a\/[a-z-]+$/);
    assert.match(community.audience, /^(For|For the|For your)\n\*[a-z]+\.\*$/, `${community.slug}: who is it for?`);
    assert.ok(community.description.length > 40 && community.cover.includes('<svg') && community.avatar.includes('<svg'), `${community.slug}: its page is missing a part`);
    assert.equal(PLANETS.filter(planet => planet.name === community.slug).length, 1, `${community.slug} has no planet`);
  }
  assert.deepEqual(all.filter(community => community.locked).map(community => community.slug), ['a/coast-trip', 'a/our-house'], 'the two groups are members-only');
  for (const community of all.filter(community => community.locked)) assert.ok(community.members > 1, `${community.slug}: how many members?`);
});

test('the forms: every file main.js names is in the folder', async () => {
  const main = await readFile(new URL('main.js', root), 'utf8');
  const files = [...main.matchAll(/from '(\.\/[^']+)'/g)].map(match => match[1]);
  assert.equal(files.filter(file => file.startsWith('./forms/')).length, WALKED.length, 'the island as a 2D game and as a 3D world');
  assert.equal(files.filter(file => file.startsWith('./apps/')).length, FORMS.length - WALKED.length, 'the Atlantis, trip and house apps');
  for (const file of files) assert.ok(await exists(new URL(file, root)), file);
  for (const id of FORMS) assert.ok(new RegExp(`\\b${id}\\b`).test(main), `main.js does not use the ${id} form`);
});

test('the sounds: every sound, the music and each narrator line is in the folder, and they stay small', async () => {
  const names = (await readFile(new URL('sound.js', root), 'utf8')).match(/const NAMES = \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(name => name.slice(1, -1));
  const main = await readFile(new URL('main.js', root), 'utf8');
  const lines = names.filter(name => name.startsWith('vo-')).map(name => name.slice(3));
  assert.ok(names.includes('music') && lines.length === 16, 'the music and the sixteen lines of the narration');
  for (const line of lines) assert.ok(FORMS.includes(line) || main.includes(`'${line}'`), `nothing in main.js says the line "${line}"`);
  let total = 0;
  for (const name of names) {
    const file = new URL(`sfx/${name}.mp3`, root);
    assert.ok(await exists(file), `sfx/${name}.mp3 is missing`);
    total += (await stat(file)).size;
  }
  assert.ok(total < 1200 * 1024, `the sounds weigh ${Math.round(total / 1024)} KB`);
});

test('the page has a title, a card image and its words as Markdown', async () => {
  const manifest = JSON.parse(await readFile(new URL('artifact.json', root), 'utf8'));
  assert.equal(manifest.entry, 'index.html');
  assert.ok(manifest.title && manifest.description);
  assert.ok(await exists(new URL('preview.webp', root)));
  const words = await readFile(new URL('content.md', root), 'utf8');
  for (const head of ['A community is a place', 'A post can be the real thing', 'Your AI posts with you', 'Everyone builds on everyone', 'Where was Atlantis?', 'ElevenLabs', ...Object.values(COMMUNITIES).map(community => community.slug)])
    assert.ok(words.includes(head), `content.md is missing "${head}"`);
});

test('the community points at the artifact, its logo and its banner', async () => {
  const settings = JSON.parse(await readFile(new URL('abstracts.json', repo), 'utf8'));
  assert.equal(settings.aboutArtifact, 'welcome');
  assert.ok(settings.pinnedArtifacts.includes('welcome'));
  for (const id of settings.pinnedArtifacts) assert.ok(await exists(new URL(`artifacts/${id}/index.html`, repo)), `pinned ${id}`);
  assert.ok(await exists(new URL(settings.avatar, repo)), 'logo');
  assert.ok(await exists(new URL(settings.cover, repo)), 'banner');
});
