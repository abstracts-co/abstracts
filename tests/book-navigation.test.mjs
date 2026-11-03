import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../artifacts/about/', import.meta.url);
const pageSource = await readFile(new URL('pages.js', root), 'utf8');
const { FACES } = await import(`data:text/javascript;base64,${Buffer.from(pageSource).toString('base64')}`);
const bookSource = await readFile(new URL('book.js', root), 'utf8');
const navigation = bookSource.slice(bookSource.indexOf('/* ---------- state ---------- */'), bookSource.indexOf('/* ---------- pointer:'));

function controls(narrow) {
  const element = () => ({
    hidden: false, disabled: false, children: [], attributes: {}, events: {},
    classList: { add() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.events[name] = handler; },
    append(child) { this.children.push(child); },
  });
  const ui = Object.fromEntries(['prev', 'next', 'again', 'join', 'dots', 'hint', 'live'].map(name => [name, element()]));
  const leaves = Array.from({ length: FACES.length / 2 + 1 }, () => ({ target: 0 }));
  const context = vm.createContext({
    FACES, leaves, ui, reduced: true,
    document: { createElement: element }, addEventListener() {},
    turn(leaf, target) { leaf.target = target; }, wake() {}, setTimeout(fn) { fn(); },
  });
  vm.runInContext(navigation, context);
  vm.runInContext(`narrow = ${narrow}; syncUI();`, context);
  return { ui, leaves, run: source => vm.runInContext(source, context) };
}

for (const narrow of [false, true]) test(`book reaches its ending, goes back and restarts (${narrow ? 'phone' : 'desktop'})`, () => {
  assert.equal(FACES.length, 12, 'six story sheets, with no empty guestbook sheet');
  const { ui, leaves, run } = controls(narrow);
  assert.equal(ui.dots.children.length, 8);
  assert.equal(ui.prev.disabled, true);
  assert.equal(ui.live.textContent, 'Page 1 of 8: Cover');
  let turns = 0;
  while (!ui.next.hidden && turns++ < 30) ui.next.events.click();
  assert.ok(turns < 30, 'navigation terminates');
  assert.equal(ui.live.textContent, 'Page 8 of 8: one brain. Come build with us.');
  assert.equal(ui.again.hidden, false);
  assert.equal(ui.join.hidden, false);
  assert.ok(leaves.every(leaf => leaf.target === 1));
  assert.equal(run('step(1)'), false, 'no extra blank spread after the ending');
  ui.prev.events.click();
  assert.equal(ui.next.hidden, false);
  assert.equal(ui.again.hidden, true);
  ui.next.events.click();
  assert.equal(ui.next.hidden, true);
  ui.again.events.click();
  assert.equal(ui.prev.disabled, true);
  assert.equal(ui.next.hidden, false);
  assert.equal(ui.join.hidden, true);
  assert.equal(ui.live.textContent, 'Page 1 of 8: Cover');
  assert.ok(leaves.every(leaf => leaf.target === 0));
});

test('published book has no guestbook opt-in, editor, imports or accessible navigation', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('artifact.json', root), 'utf8'));
  assert.ok(!('bridge' in manifest));
  for (const source of [html, bookSource, pageSource]) assert.doesNotMatch(source, /guest|abstracts:entries/i);
  assert.match(html, /data-layout="viewport"/);
  assert.match(bookSource, /abstractsHeight/);
  assert.match(bookSource, /abstractsLayout/);
});
