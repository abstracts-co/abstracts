// pixel.js: the island as a 2D game. A top-down map drawn on a small canvas with whole pixels, then scaled up.
import { el } from '../lib/util.js';
import { TILE, W, H, P, R, disc, PLACES, isTall, paintGround, tallGrassFront, props, drawPerson, drawRobot } from '../lib/town.js';

const MARGIN = 14;                  // extra water tiles drawn around the island

const CSS = `
.px { background: ${P.w1}; overflow: hidden; touch-action: manipulation; cursor: pointer; }
.px canvas { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; }
`;

function star(g, color, x, y, big) { R(g, color, x, y - (big ? 2 : 1), 1, big ? 5 : 3); R(g, color, x - (big ? 2 : 1), y, big ? 5 : 3, 1); }
/** The orb: cx, cy is the middle of its tile; `lift` is how many pixels it is off the ground. */
function drawOrb(g, cx, cy, t, lift) {
  const y = cy - 5 + Math.round(Math.sin(t * 4) * 1.5) - Math.round(lift);
  g.globalAlpha = lift > 2 ? 0.14 : 0.3; disc(g, P.sunL, cx, cy + 6, 8, 3); g.globalAlpha = 1;
  disc(g, P.ink, cx, y, 6, 6);
  disc(g, '#c9251a', cx, y, 5, 5); disc(g, '#ff8a1f', cx, y - 1, 4, 4); disc(g, '#ffd766', cx - 1, y - 2, 2, 2);
  R(g, P.white, cx - 3, y - 4, 2, 1);
  for (let i = 0; i < 4; i++) {
    const a = t * 2.2 + i * Math.PI / 2, r = 10 + Math.sin(t * 3 + i) * 1.5;
    star(g, i % 2 ? P.white : P.sunL, Math.round(cx + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), Math.floor(t * 4 + i) % 2 === 0);
  }
}

export default {
  id: 'pixel', name: 'a/builders', kind: 'a 2D game', headline: 'You make it\nwith your *AI.*',
  dot: 'radial-gradient(circle at 34% 30%, #b4e58a 0 28%, #6dbd58 29% 46%, #58b3e6 47% 78%, #3d94cf 79%)',
  create() {
    const canvas = el('canvas');
    const root = el('div', { class: 'px' }, el('style', {}, CSS), canvas);
    const g = canvas.getContext('2d');
    const grounds = [0, 1].map(frame => {
      const c = document.createElement('canvas'); c.width = c.height = (Math.max(W, H) + MARGIN * 2) * TILE;
      paintGround(c.getContext('2d'), frame, MARGIN);
      return c;
    });
    const fixed = props();
    let s = 3, vw = 1, vh = 1, w = 1, h = 1, ox = 0, oy = 0;

    return {
      el: root,
      resize(nw, nh) {
        w = nw; h = nh;
        s = Math.max(2, Math.round(Math.min(w, h) / 176));
        vw = Math.ceil(w / s); vh = Math.ceil(h / s);
        canvas.width = vw; canvas.height = vh;
        canvas.style.width = `${vw * s}px`; canvas.style.height = `${vh * s}px`;
      },
      render(game, view) {
        const t = game.t, frame = Math.floor(t * 2) % 2;
        ox = Math.round(vw / 2 - view.cx * TILE); oy = Math.round(vh / 2 - view.cy * TILE);
        g.imageSmoothingEnabled = false;
        R(g, P.w1, 0, 0, vw, vh);
        g.drawImage(grounds[frame], ox - MARGIN * TILE, oy - MARGIN * TILE);
        const list = fixed.map(p => ({ row: p.row, z: 0, draw: () => p.draw(g, ox, oy) }));
        const n = PLACES.neighbour;
        list.push({ row: n.y, z: 1, draw: () => drawPerson(g, ox + n.x * TILE, oy + n.y * TILE, 0, 0, 'teal') });
        const walker = (who, z, draw) => {
          const at = game.pos(who), px = Math.round(at.x * TILE), py = Math.round(at.y * TILE);
          list.push({ row: at.y, z, draw: () => {
            draw(ox + px, oy + py);
            const tx = Math.round(at.x), ty = Math.round(at.y);
            if (isTall(tx, ty)) tallGrassFront(g, ox + tx * TILE, oy + ty * TILE, tx, ty, frame);
          } });
        };
        const walking = game.moving() ? Math.floor(t * 9) % 2 : 0;
        walker(game.buddy, 1, (x, y) => drawRobot(g, x, y - (walking && frame ? 1 : 0), frame, game.buddy.dir));
        walker(game.player, 2, (x, y) => drawPerson(g, x, y, game.player.dir, walking, 'coral'));
        const orb = game.orbPos();
        list.push({ row: orb.y + 0.2 + (orb.landed ? 0 : 30), z: 3, draw: () => drawOrb(g, ox + Math.round(orb.x * TILE) + 8, oy + Math.round(orb.y * TILE) + 8, t, orb.lift * TILE) });
        list.sort((a, b) => a.row - b.row || a.z - b.z);
        for (const item of list) item.draw();
      },
      /** The tile under a point on the stage. */
      pick(x, y) {
        return { x: Math.floor(((x - (w - vw * s) / 2) / s - ox) / TILE), y: Math.floor(((y - (h - vh * s) / 2) / s - oy) / TILE) };
      },
      /** Where the middle of a tile is on the stage. */
      screenOf(tx, ty) {
        return { x: (w - vw * s) / 2 + ((tx + 0.5) * TILE + ox) * s, y: (h - vh * s) / 2 + ((ty + 0.5) * TILE + oy) * s };
      },
    };
  },
};
