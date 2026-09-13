import { Group, RectShape } from 'easy-game-maker';

// ── Helper ────────────────────────────────────────────────────────────────────

function rect(
  parent: Group, x: number, y: number, w: number, h: number, fill: string, alpha = 1,
): RectShape {
  const r = new RectShape({ x, y, width: w, height: h, fill });
  r.anchorX = 0.5; r.anchorY = 0.5; r.alpha = alpha;
  parent.add(r);
  return r;
}

// ── Player ship ───────────────────────────────────────────────────────────────
// Viewed from behind (flying upward). Origin = center of hitbox.

export function createPlayerDisplay(): { group: Group; shield: RectShape } {
  const g = new Group();

  // Engine flames (bottom, slightly behind wings)
  rect(g, -6,  20, 5, 12, '#ff8800', 0.9);
  rect(g,  6,  20, 5, 12, '#ff8800', 0.9);
  rect(g,  0,  22, 4,  8, '#ffee44', 0.6);  // center afterburner

  // Main fuselage
  rect(g, 0,  2, 12, 32, '#3a7aff');

  // Wings (swept back)
  rect(g, -20, 10, 22,  8, '#2255cc');
  rect(g,  20, 10, 22,  8, '#2255cc');

  // Wing tips
  rect(g, -28, 14,  8,  6, '#4488ff');
  rect(g,  28, 14,  8,  6, '#4488ff');

  // Cockpit
  rect(g, 0, -12,  8, 12, '#88ccff');
  rect(g, 0, -16,  4,  4, '#aaddff', 0.8);

  // Cannon barrel
  rect(g, 0, -22,  3, 10, '#99bbff');

  // Shield indicator (hidden by default)
  const shield = new RectShape({ x: 0, y: 0, width: 52, height: 52, fill: '#44aaff' });
  shield.anchorX = 0.5; shield.anchorY = 0.5;
  shield.alpha = 0;
  g.add(shield);

  return { group: g, shield };
}

// ── Fighter enemy ─────────────────────────────────────────────────────────────

export function createFighterDisplay(): Group {
  const g = new Group();

  // Exhaust
  rect(g,  0, -14, 5, 8, '#ff6600', 0.7);

  // Body
  rect(g,  0,  0, 14, 20, '#cc2200');

  // Wings
  rect(g, -14, 4, 14, 7, '#991100');
  rect(g,  14, 4, 14, 7, '#991100');

  // Cockpit
  rect(g,  0, -8,  8, 8, '#ff5533');

  // Guns
  rect(g, -4, 12, 3, 8, '#ff8866');
  rect(g,  4, 12, 3, 8, '#ff8866');

  return g;
}

// ── Bomber enemy ──────────────────────────────────────────────────────────────

export function createBomberDisplay(): Group {
  const g = new Group();

  // Engines
  rect(g, -18, -10, 6, 10, '#dd5500', 0.8);
  rect(g,  18, -10, 6, 10, '#dd5500', 0.8);

  // Wide fuselage
  rect(g,  0,  2, 26, 20, '#cc6600');

  // Big wings
  rect(g, -22, 0, 18, 12, '#aa4400');
  rect(g,  22, 0, 18, 12, '#aa4400');

  // Cockpit bubble
  rect(g,  0, -10, 14, 12, '#ff9944');
  rect(g,  0, -14,  8,  6, '#ffbb66', 0.8);

  // Bomb bay
  rect(g,  0,  14, 10,  8, '#884400');

  return g;
}

// ── Gunship enemy ─────────────────────────────────────────────────────────────

export function createGunshipDisplay(): Group {
  const g = new Group();

  // Thruster
  rect(g,  0, -16, 8, 10, '#9900ff', 0.7);

  // Armored hull
  rect(g,  0,  0, 22, 28, '#770099');
  rect(g,  0,  0, 14, 18, '#aa22cc');  // inner core

  // Weapon pods (wings)
  rect(g, -20, 4, 18, 12, '#550077');
  rect(g,  20, 4, 18, 12, '#550077');

  // Heavy cannons
  rect(g, -8,  16, 6, 14, '#cc00ff');
  rect(g,  8,  16, 6, 14, '#cc00ff');
  rect(g,  0,  16, 5, 12, '#dd44ff');  // center cannon

  // Cockpit shield dome
  rect(g,  0,  -8, 12, 10, '#bb66ff');

  return g;
}

// ── Boss ──────────────────────────────────────────────────────────────────────

export function createBossDisplay(): { group: Group; hpBarFill: RectShape } {
  const g = new Group();

  // Engine exhausts
  rect(g, -24, -36, 10, 14, '#ff4400', 0.8);
  rect(g,   0, -38, 12, 16, '#ff6600', 0.9);
  rect(g,  24, -36, 10, 14, '#ff4400', 0.8);

  // Main hull
  rect(g,  0,  0, 68, 52, '#880000');
  rect(g,  0,  0, 48, 36, '#aa0000');
  rect(g,  0, -4, 22, 22, '#cc0000');  // core

  // Main wings
  rect(g, -52, 10, 28, 22, '#660000');
  rect(g,  52, 10, 28, 22, '#660000');

  // Mid-wing extensions
  rect(g, -36,  4, 16, 14, '#880000');
  rect(g,  36,  4, 16, 14, '#880000');

  // Weapon turrets
  rect(g, -22, 18,  8, 18, '#ff2200');
  rect(g,  22, 18,  8, 18, '#ff2200');
  rect(g,  -8, 22,  6, 16, '#ff4400');
  rect(g,   8, 22,  6, 16, '#ff4400');

  // Cockpit
  rect(g,  0, -18, 18, 14, '#ff3300');
  rect(g,  0, -22, 10,  8, '#ff6655', 0.8);

  // ── Boss HP bar (relative to boss group, at top) ───────────────────────────
  const barBg = new RectShape({ x: 0, y: -46, width: 88, height: 8, fill: '#330000' });
  barBg.anchorX = 0.5; barBg.anchorY = 0.5;
  g.add(barBg);

  const barFill = new RectShape({ x: 0, y: -46, width: 88, height: 6, fill: '#ff2200' });
  barFill.anchorX = 0.5; barFill.anchorY = 0.5;
  g.add(barFill);

  return { group: g, hpBarFill: barFill };
}

// ── Power-up diamond ──────────────────────────────────────────────────────────

const POWERUP_COLORS: Record<string, string> = {
  double:  '#ffe040',
  triple:  '#40ffee',
  shield:  '#44ff88',
  bomb:    '#ff6622',
};

export function createPowerUpDisplay(kind: string): RectShape {
  const fill = POWERUP_COLORS[kind] ?? '#ffffff';
  const r = new RectShape({ x: 0, y: 0, width: 16, height: 16, fill });
  r.rotation = Math.PI / 4;
  r.anchorX = 0.5; r.anchorY = 0.5;
  return r;
}

// ── Explosion shard ───────────────────────────────────────────────────────────

export function createShardDisplay(): RectShape {
  const r = new RectShape({ x: -200, y: -200, width: 6, height: 6, fill: '#ff8800' });
  r.anchorX = 0.5; r.anchorY = 0.5;
  return r;
}

// ── Player bullet ─────────────────────────────────────────────────────────────

export function createPlayerBulletDisplay(): RectShape {
  const r = new RectShape({ x: -200, y: -200, width: 4, height: 14, fill: '#ffe040' });
  r.anchorX = 0.5; r.anchorY = 0.5;
  return r;
}

// ── Enemy bullet ──────────────────────────────────────────────────────────────

export function createEnemyBulletDisplay(): RectShape {
  const r = new RectShape({ x: -200, y: -200, width: 5, height: 10, fill: '#ff2244' });
  r.anchorX = 0.5; r.anchorY = 0.5;
  return r;
}
