import * as THREE from 'three';
import {
  createAmbience,
  createGame,
  createParticles,
  createPostFX,
  createScore,
  createStateMachine,
  flash,
  followCamera,
  lights,
  math,
  models,
  pop,
  shockwave,
} from 'easy-game-maker/3d';
import type { HudOverlay } from 'easy-game-maker/3d';
import {
  SHIP_LIMIT,
  SHIP_Z,
  SPAWN_Z,
  START_LIVES,
  clamp,
  createRng,
  findHit,
  hitRun,
  laneX,
  newRun,
  nextRow,
  openLanes,
  registerDodges,
  rowSpacing,
  scoreOf,
  speedAt,
  startRun,
  stepObstacles,
  tickRun,
  type Obstacle,
} from './logic';
import { buildAsteroid, buildShip, buildTrack } from './track';

const STEER_SPEED = 13;
const BASE_FOV = 62;

const game = createGame({
  background: '#050816',
  cameraPosition: [0, 3.6, 7],
  fog: { color: '#050816', near: 25, far: 105 },
  fov: BASE_FOV,
});

lights.night(game.scene, { area: 30 });
lights.studio(game.scene, { intensity: 0.7 });
const track = buildTrack();
game.add(track.group);
createAmbience(game.engine, { count: 500, radius: 70, color: '#93c5fd', size: 0.16, drift: 0.2 });

const ship = buildShip();
ship.position.set(0, 0, SHIP_Z);
game.add(ship);
lights.attachLight(ship, { color: '#38bdf8', intensity: 7, distance: 9, offset: [0, 0.6, 0.8] });
followCamera(game, ship, { distance: 7, height: 3.4, stiffness: 7, lookHeight: 0.4, behind: false });

const sparks = createParticles(game.engine, { max: 900, size: 0.2 });
const post = createPostFX(game.engine, {
  quality: new URLSearchParams(location.search).get('fx') === 'off' ? 'off' : 'auto',
  bloom: { strength: 0.6, radius: 0.5, threshold: 0.85 },
});

// Asteroids come from a pool: nothing is allocated while playing.
const pool = models.createPool(buildAsteroid, { size: 24, parent: game.scene });
const meshes = new Map<number, THREE.Mesh>();
let obstacles: Obstacle[] = [];
let nextId = 1;
let nextRowId = 1;
let previousOpen: number[] = [2];
let sinceRow = 0;
const rng = createRng(Date.now() & 0xffff);

// HUD.
const scoreStat = game.hud.stat('Score', 0, { at: 'top-left' });
const hull = game.hud.bar('Hull', { at: 'top-right', value: START_LIVES, max: START_LIVES, dangerBelow: 0.4 });
const speedText = game.hud.text('', { at: 'bottom-center' });
game.hud.keys({ 'A D': 'steer', '← →': 'steer' }, { at: 'bottom-left' });
const best = createScore({ key: 'orbit-dodge-3d.best' });

let run = newRun();
let shipVelocity = 0;
let targetX = 0;
let overlay: HudOverlay | null = null;
let steering = false;

function clearField(): void {
  for (const id of meshes.keys()) releaseMesh(id);
  obstacles = [];
  previousOpen = [2];
  sinceRow = 0;
}

function releaseMesh(id: number): void {
  const mesh = meshes.get(id);
  if (mesh) pool.give(mesh);
  meshes.delete(id);
}

function spawnRow(): void {
  const blocked = nextRow(rng, previousOpen, run.elapsed);
  previousOpen = openLanes(blocked);
  nextRowId += 1;
  for (const lane of blocked) {
    const obstacle: Obstacle = { id: nextId, row: nextRowId, lane, z: SPAWN_Z };
    nextId += 1;
    obstacles = [...obstacles, obstacle];
    const mesh = pool.take();
    mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    meshes.set(obstacle.id, mesh);
  }
}

function resetRun(): void {
  clearField();
  run = newRun();
  targetX = 0;
  ship.position.x = 0;
  ship.visible = true;
  scoreStat.set(0);
  hull.set(START_LIVES);
}

function syncMeshes(elapsed: number): void {
  const live = new Set(obstacles.map((o) => o.id));
  for (const id of [...meshes.keys()]) if (!live.has(id)) releaseMesh(id);
  for (const o of obstacles) {
    const mesh = meshes.get(o.id);
    if (!mesh) continue;
    mesh.position.set(laneX(o.lane), 0.4 + Math.sin(elapsed * 2 + o.id) * 0.12, o.z);
    mesh.rotation.x += 0.012;
    mesh.rotation.y += 0.009;
  }
}

function crash(): void {
  run = hitRun(run);
  hull.set(run.lives);
  const at = ship.position;
  sparks.burst(at, { count: 60, color: '#f97316', speed: 8, lifetime: 0.9 });
  shockwave(game.engine, at, { color: '#f97316', to: 5, duration: 0.5 });
  flash(ship, { color: '#ffffff', duration: 0.2 });
  game.hud.flash('#ef4444');
  game.audio.play(run.status === 'over' ? 'explosion' : 'hurt');
  void pop(ship, game.tweens, { scale: 1.3, duration: 0.3 });
}

const machine = createStateMachine(
  {
    menu: {
      enter: () => {
        steering = false;
        resetRun();
        overlay = game.hud.overlay({
          title: 'Orbit Dodge 3D',
          body: `Steer the ship with A and D (or the arrow keys) and slip through the gaps.\nYou have ${START_LIVES} hull points. Best score: ${best.best}`,
          buttons: [{ label: 'Launch', onClick: () => machine.go('play') }],
        });
      },
      update: () => {
        if (game.input.pressed('jump') || game.input.pressed('fire')) {
          overlay?.close();
          machine.go('play');
        }
      },
    },
    play: {
      enter: () => {
        resetRun();
        run = startRun(run);
        steering = true;
        game.audio.play('powerup');
        game.audio.music.start({ notes: [110, 165, 131, 196], tempo: 260, gain: 0.05 });
        game.hud.banner('Go!');
      },
      update: (dt) => {
        run = tickRun(run, dt);
        const speed = speedAt(run.elapsed);
        sinceRow += speed * dt;
        if (sinceRow >= rowSpacing(run.elapsed)) {
          sinceRow = 0;
          spawnRow();
        }
        const step = stepObstacles(obstacles, dt, speed);
        obstacles = step.obstacles;
        if (step.passed.length > 0) {
          run = registerDodges(run, new Set(step.passed.map((o) => o.row)).size);
          game.audio.play('blip', { pitch: 1.2 });
        }
        const hit = findHit(obstacles, ship.position.x);
        if (hit && run.invulnerable <= 0) {
          crash();
          obstacles = obstacles.filter((o) => o.id !== hit.id);
        }
        scoreStat.set(scoreOf(run));
        speedText.set(`${Math.round(speed * 3.6)} km/s`);
        if (run.status === 'over') machine.go('over');
      },
      exit: () => {
        steering = false;
        game.audio.music.stop();
      },
    },
    over: {
      enter: () => {
        const score = scoreOf(run);
        const record = score > best.best;
        best.set(Math.max(best.best, score));
        ship.visible = false;
        overlay = game.hud.overlay({
          title: `Hull breached: ${score}`,
          body: `Rows dodged: ${run.dodged}\nDistance: ${Math.round(run.distance)} m${record ? '\nNew best score!' : `\nBest: ${best.best}`}`,
          buttons: [{ label: 'Launch again', onClick: () => machine.go('play') }],
        });
      },
      update: () => {
        if (machine.time > 0.8 && (game.input.pressed('restart') || game.input.pressed('jump'))) {
          overlay?.close();
          machine.go('play');
        }
      },
    },
  },
  'menu',
  game,
);

game.onUpdate((dt, elapsed) => {
  const axis = steering ? game.input.axis('left', 'right') : 0;
  targetX = clamp(targetX + axis * STEER_SPEED * dt, -SHIP_LIMIT, SHIP_LIMIT);
  const before = ship.position.x;
  ship.position.x = math.damp(ship.position.x, targetX, 14, dt);
  shipVelocity = (ship.position.x - before) / Math.max(dt, 1e-4);
  if (steering) ship.rotation.z = math.damp(ship.rotation.z, -shipVelocity * 0.06, 10, dt);
  ship.position.y = Math.sin(elapsed * 3) * 0.08;
  if (steering && run.invulnerable > 0) ship.visible = Math.floor(run.invulnerable * 12) % 2 === 0;
  else if (steering) ship.visible = true;

  const speed = machine.is('play') ? speedAt(run.elapsed) : 8;
  track.scroll(speed * dt);
  syncMeshes(elapsed);
  if (steering) sparks.stream([ship.position.x, ship.position.y + 0.25, ship.position.z + 1.3], dt, { rate: 70, direction: new THREE.Vector3(0, 0, 1), color: '#fb923c', speed: 6, spread: 0.6, lifetime: 0.35, size: 0.18 });
  const fov = BASE_FOV + (speed - 16) * 0.5;
  game.camera.fov = math.damp(game.camera.fov, machine.is('play') ? fov : BASE_FOV, 4, dt);
  game.camera.updateProjectionMatrix();
});

game.probe.register('orbitDodge', () => ({
  state: machine.current,
  lives: run.lives,
  score: scoreOf(run),
  distance: Math.round(run.distance),
  dodged: run.dodged,
  invulnerable: Number(run.invulnerable.toFixed(2)),
  speed: Number(speedAt(run.elapsed).toFixed(1)),
  ship: { x: Number(ship.position.x.toFixed(2)) },
  obstacles: obstacles.map((o) => ({ lane: o.lane, z: Number(o.z.toFixed(1)) })),
  postfx: post.enabled,
}));
