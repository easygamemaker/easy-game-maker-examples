import * as THREE from 'three';
import {
  Spring,
  createAmbience,
  createCooldown,
  createDifficulty,
  createGame,
  createParticles,
  createPhysics,
  createPostFX,
  createScore,
  createShake,
  createStateMachine,
  createTicker,
  firstPerson,
  flash,
  lights,
  math,
  models,
  pop,
  shockwave,
} from 'easy-game-maker/3d';
import type { HudOverlay } from 'easy-game-maker/3d';
import { NEON_CYAN, NEON_MAGENTA, buildArena } from './arena';
import { buildBolt, buildDrone, buildMuzzleFlash, buildPickup, buildRifle, buildTracer, type DroneModel } from './actors';
import { defineSounds } from './sounds';
import {
  FIRE_INTERVAL,
  PICKUP_LIFETIME,
  PLAYER_EYE,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  RIFLE_DAMAGE,
  accuracy,
  applyPickup,
  boltBlocked,
  boltExpired,
  boltHitsPlayer,
  canReload,
  canShoot,
  createRng,
  damagePlayer,
  hurtDrone,
  isDead,
  isDry,
  newBolt,
  newDrone,
  newPlayer,
  newRun,
  newWaves,
  newWeapon,
  pickupInReach,
  registerKill,
  registerShot,
  rollDrop,
  shoot,
  spawnPoint,
  startReload,
  stepBolt,
  stepDrone,
  tickPlayer,
  tickWaves,
  tickWeapon,
  waveConfig,
  type Bolt,
  type Drone,
  type Pickup,
  type Vec3,
} from './logic';

const START_POSITION: [number, number, number] = [0, 0.5, 9];
const TRACER_LIFE = 0.09;
const FLASH_LIFE = 0.055;
const MAX_TRACE = 90;
const DRONE_SCALE = 1.4;

const params = new URLSearchParams(location.search);
const game = createGame({
  background: '#04030c',
  cameraPosition: [0, PLAYER_EYE, 9],
  fov: 76,
  near: 0.05,
  far: 260,
  fog: { color: '#0c0724', near: 32, far: 120 },
  actions: { reload: ['KeyR'] },
});
defineSounds(game.audio);

// --- World ---------------------------------------------------------------------------------

lights.night(game.scene, { area: 30 });
lights.moody(game.scene, { color: '#7c3aed', intensity: 2.2 });
lights.studio(game.scene, { intensity: 0.45 });
const arena = buildArena();
game.add(arena.group);
arena.group.updateMatrixWorld(true);
createAmbience(game.engine, { count: 350, radius: 30, color: '#a78bfa', size: 0.09, drift: 0.15, follow: game.camera });

const world = createPhysics();
world.addGround(0);
world.addArena(arena.walls);
for (const mesh of arena.coverMeshes) world.addBox(mesh);

const body = world.addBody({ radius: 0.5, height: 1.8, position: START_POSITION, tag: 'player' });
const fps = firstPerson(game.engine, game.input, {
  body,
  speed: 7,
  sprintSpeed: 10.5,
  jump: 8.5,
  eyeHeight: PLAYER_EYE,
  position: [START_POSITION[0], PLAYER_EYE, START_POSITION[2]],
  lockOnClick: !game.input.touch,
});
game.onUpdate((dt) => world.step(dt));

// The camera hangs from a rig so shake and recoil never fight the controller, which rewrites the camera every frame.
const rig = new THREE.Object3D();
fps.object.add(rig);
rig.add(game.camera);
const shake = createShake(rig, { decay: 14, frequency: 45 });
const recoil = new Spring({ stiffness: 260, damping: 18 });

const rifle = buildRifle();
const RIFLE_HOME = new THREE.Vector3(0.16, -0.15, -0.48);
rifle.group.position.copy(RIFLE_HOME);
rifle.group.rotation.y = 0.05;
rifle.group.scale.setScalar(0.5);
game.camera.add(rifle.group);
const muzzleFlash = buildMuzzleFlash();
rifle.muzzle.add(muzzleFlash);
const muzzleLight = lights.attachLight(rifle.muzzle, { color: '#fde68a', intensity: 0, distance: 14, offset: [0, 0, -0.15] });

const sparks = createParticles(game.engine, { max: 1400, size: 0.13 });
const post = createPostFX(game.engine, {
  quality: params.get('fx') === 'off' ? 'off' : 'auto',
  bloom: { strength: 0.5, radius: 0.35, threshold: 0.85 },
  vignette: { offset: 1.05, darkness: 1.0 },
});

// --- Pools ---------------------------------------------------------------------------------

const dronePool = models.createPool(buildDrone, { size: 12, parent: game.scene });
const boltPool = models.createPool(buildBolt, { size: 24, parent: game.scene });
const tracerPool = models.createPool(buildTracer, { size: 8, parent: game.scene });
const pickupPools = { health: models.createPool(() => buildPickup('health'), { size: 4, parent: game.scene }), ammo: models.createPool(() => buildPickup('ammo'), { size: 4, parent: game.scene }) };

const droneViews = new Map<number, DroneModel>();
const boltViews = new Map<number, THREE.Mesh>();
const pickupViews = new Map<number, THREE.Group>();
const hitboxOwner = new Map<THREE.Object3D, number>();
const tracers: { mesh: THREE.Mesh; life: number }[] = [];

// --- HUD -----------------------------------------------------------------------------------

const healthBar = game.hud.bar('Health', { at: 'top-left', value: PLAYER_MAX_HEALTH, max: PLAYER_MAX_HEALTH, color: NEON_CYAN, dangerColor: '#ef4444', dangerBelow: 0.3 });
const waveStat = game.hud.stat('Wave', 0, { at: 'top-center' });
const scoreStat = game.hud.stat('Score', 0, { at: 'top-right' });
const ammoText = game.hud.text('', { at: 'bottom-right' });
const remainText = game.hud.text('', { at: 'top-center' });
const hintText = game.hud.text('', { at: 'bottom-center' });
const crosshair = game.hud.crosshair();
game.hud.keys({ WASD: 'move', Shift: 'sprint', Space: 'jump', Click: 'fire', R: 'reload' }, { at: 'bottom-left' });
game.hud.touchButtons({ Fire: 'fire', Reload: 'reload', Jump: 'jump' }, game.input, { at: 'bottom-right' });
ammoText.element.style.cssText += 'font-size:30px;font-weight:800;letter-spacing:0.04em;color:#fff;text-shadow:0 0 12px #22d3ee;';
remainText.element.style.cssText += 'font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#f5d0fe;';

const best = createScore({ key: 'neon-siege-3d.best' });

// --- Game state ----------------------------------------------------------------------------

const rng = createRng(Date.now() & 0xffff);
const difficulty = createDifficulty({ rampSeconds: 240 });
const cooldown = createCooldown(FIRE_INTERVAL);

let weapon = newWeapon();
let player = newPlayer();
let waves = newWaves();
let run = newRun();
let drones: Drone[] = [];
let bolts: Bolt[] = [];
let pickups: Pickup[] = [];
let nextId = 1;
let runTime = 0;
let flashLife = 0;
let hitmarker = 0;
let overlay: HudOverlay | null = null;
let lastWave = 0;
let playing = false;

const heartbeat = createTicker(0.85, () => {
  if (playing && player.health > 0 && player.health <= PLAYER_MAX_HEALTH * 0.3) game.audio.play('thud', { pitch: 0.7 });
});
const refresh = createTicker(0.2, () => updateHud());

const eye = new THREE.Vector3();
const forward = new THREE.Vector3();
const muzzlePoint = new THREE.Vector3();

/** The player's eye as plain numbers, for the pure rules. */
function playerEye(): Vec3 {
  return { x: fps.object.position.x, y: fps.object.position.y, z: fps.object.position.z };
}

function updateHud(): void {
  healthBar.set(player.health);
  waveStat.set(waves.wave);
  scoreStat.set(run.score);
  const left = waves.toSpawn + drones.length;
  remainText.set(waves.phase === 'break' ? (waves.wave === 0 ? 'Get ready' : 'Wave cleared') : `${left} drone${left === 1 ? '' : 's'} left`);
  ammoText.set(weapon.reloadLeft > 0 ? 'RELOADING' : isDry(weapon) ? 'NO AMMO' : `${weapon.mag} / ${weapon.reserve}`);
  hintText.set(playing && !game.input.locked && !game.input.touch ? 'Click the screen to capture the mouse' : '');
}

function clearField(): void {
  for (const view of droneViews.values()) dronePool.give(view);
  for (const view of boltViews.values()) boltPool.give(view);
  for (const view of pickupViews.values()) pickupPools[view.userData['kind'] as 'health' | 'ammo'].give(view);
  pickupViews.clear();
  droneViews.clear();
  boltViews.clear();
  hitboxOwner.clear();
  for (const t of tracers) tracerPool.give(t.mesh);
  tracers.length = 0;
  drones = [];
  bolts = [];
  pickups = [];
  sparks.clear();
}

function resetRun(): void {
  clearField();
  weapon = newWeapon();
  player = newPlayer();
  waves = newWaves();
  run = newRun();
  runTime = 0;
  lastWave = 0;
  difficulty.reset();
  body.position.set(...START_POSITION);
  body.velocity.set(0, 0, 0);
  fps.object.rotation.y = 0;
  updateHud();
}

// --- Spawning ------------------------------------------------------------------------------

function addDrone(): void {
  const cfg = waveConfig(waves.wave, difficulty.level);
  const at = spawnPoint(rng, playerEye());
  const drone = newDrone(nextId, at, cfg, rng);
  nextId += 1;
  drones = [...drones, drone];
  const view = dronePool.take();
  view.userData.droneId = drone.id;
  view.position.set(at.x, at.y, at.z);
  view.scale.setScalar(0.01);
  droneViews.set(drone.id, view);
  hitboxOwner.set(view.userData.hitbox, drone.id);
  void game.tweens.to(view.scale, { x: DRONE_SCALE, y: DRONE_SCALE, z: DRONE_SCALE }, { duration: 0.35, ease: math.ease.outBack });
  sparks.burst([at.x, at.y, at.z], { count: 18, color: NEON_MAGENTA, speed: 4, lifetime: 0.5 });
  game.audio.play('whoosh', { pitch: 1.6, vary: 0.1 });
}

function removeDrone(id: number): void {
  const view = droneViews.get(id);
  if (view) {
    hitboxOwner.delete(view.userData.hitbox);
    dronePool.give(view);
  }
  droneViews.delete(id);
  drones = drones.filter((d) => d.id !== id);
}

function dropPickup(at: Vec3): void {
  const kind = rollDrop(rng, player, weapon);
  if (!kind) return;
  const pickup: Pickup = { id: nextId, kind, pos: { x: at.x, y: 0.9, z: at.z }, life: PICKUP_LIFETIME };
  nextId += 1;
  pickups = [...pickups, pickup];
  const view = pickupPools[kind].take();
  view.userData['kind'] = kind;
  view.position.set(pickup.pos.x, pickup.pos.y, pickup.pos.z);
  pickupViews.set(pickup.id, view);
  void pop(view, game.tweens, { scale: 1.4, duration: 0.4 });
}

function removePickup(id: number): void {
  const view = pickupViews.get(id);
  if (view) pickupPools[view.userData['kind'] as 'health' | 'ammo'].give(view);
  pickupViews.delete(id);
  pickups = pickups.filter((p) => p.id !== id);
}

// --- Shooting ------------------------------------------------------------------------------

function showTracer(from: THREE.Vector3, to: THREE.Vector3): void {
  const mesh = tracerPool.take();
  const length = from.distanceTo(to);
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.scale.set(1, 1, length);
  mesh.lookAt(to);
  tracers.push({ mesh, life: TRACER_LIFE });
}

function killDrone(drone: Drone): void {
  const at = drone.pos;
  sparks.burst([at.x, at.y, at.z], { count: 46, color: '#fb923c', speed: 7, lifetime: 0.8, size: 0.2 });
  sparks.burst([at.x, at.y, at.z], { count: 22, color: NEON_MAGENTA, speed: 5, lifetime: 0.6 });
  shockwave(game.engine, at, { color: NEON_MAGENTA, from: 0.3, to: 4, duration: 0.45, vertical: true });
  game.audio.play('explosion', { pitch: 1.4, vary: 0.1 });
  shake.add(0.03);
  run = registerKill(run, waves.wave);
  dropPickup(at);
  removeDrone(drone.id);
}

function hitDrone(id: number, point: THREE.Vector3): boolean {
  const drone = drones.find((d) => d.id === id);
  if (!drone) return false;
  const result = hurtDrone(drone, RIFLE_DAMAGE);
  sparks.burst(point, { count: 12, color: '#f5d0fe', speed: 5, lifetime: 0.35 });
  game.audio.play('hit', { vary: 0.12 });
  hitmarker = 0.12;
  const view = droneViews.get(id);
  if (view) flash(view, { color: '#ffffff', duration: 0.09, intensity: 1.4 });
  if (result.killed) killDrone(drone);
  else drones = drones.map((d) => (d.id === id ? result.drone : d));
  return true;
}

function fireRifle(): void {
  weapon = shoot(weapon);
  cooldown.use();
  game.camera.updateWorldMatrix(true, false);
  game.camera.getWorldPosition(eye);
  game.camera.getWorldDirection(forward);
  rifle.muzzle.getWorldPosition(muzzlePoint);

  const targets: THREE.Object3D[] = [...arena.solids];
  for (const view of droneViews.values()) targets.push(view.userData.hitbox);
  const hit = world.raycast(eye, forward, targets, MAX_TRACE);
  const end = hit ? hit.point.clone() : eye.clone().addScaledVector(forward, MAX_TRACE);
  showTracer(muzzlePoint, end);

  let hitAny = false;
  if (hit) {
    const id = hitboxOwner.get(hit.object);
    if (id !== undefined) hitAny = hitDrone(id, hit.point);
    else {
      const normal = hit.normal ?? forward.clone().negate();
      sparks.spray(hit.point, normal.clone().normalize(), { count: 8, color: NEON_CYAN, speed: 4, spread: 0.6, lifetime: 0.3 });
      game.audio.play('click', { pitch: 2, vary: 0.2 });
    }
  }
  run = registerShot(run, hitAny);

  flashLife = FLASH_LIFE;
  muzzleFlash.rotation.z = Math.random() * Math.PI;
  muzzleFlash.scale.setScalar(0.7 + Math.random() * 0.7);
  sparks.spray(muzzlePoint, forward, { count: 5, color: '#fde68a', speed: 10, spread: 0.22, lifetime: 0.14, size: 0.09 });
  recoil.impulse(9);
  shake.add(0.012);
  game.audio.play('pulse', { vary: 0.08 });
}

function handleWeapon(dt: number): void {
  cooldown.update(dt);
  const before = weapon.reloadLeft;
  weapon = tickWeapon(weapon, dt);
  if (before > 0 && weapon.reloadLeft <= 0) game.audio.play('select', { pitch: 1.3 });

  if (game.input.pressed('reload') && canReload(weapon)) {
    weapon = startReload(weapon);
    game.audio.play('whoosh', { pitch: 0.8 });
  }
  if (!game.input.down('fire')) return;
  if (canShoot(weapon) && cooldown.ready()) fireRifle();
  else if (weapon.mag === 0 && canReload(weapon)) {
    weapon = startReload(weapon);
    game.audio.play('whoosh', { pitch: 0.8 });
  } else if (isDry(weapon) && cooldown.ready()) {
    cooldown.use();
    game.audio.play('click', { pitch: 0.6 });
  }
}

// --- Enemies -------------------------------------------------------------------------------

function hurtPlayer(amount: number): void {
  const next = damagePlayer(player, amount);
  if (next === player) return;
  player = next;
  game.hud.flash('#ef4444', { duration: 320, opacity: 0.5 });
  shake.add(0.12);
  recoil.impulse(-6);
  game.audio.play('hurt', { vary: 0.05 });
  healthBar.set(player.health);
}

function updateDrones(dt: number): void {
  const cfg = waveConfig(waves.wave, difficulty.level);
  const target = playerEye();
  const positions = drones.map((d) => d.pos);
  const next: Drone[] = [];
  for (const drone of drones) {
    const others = positions.filter((p) => p !== drone.pos);
    const step = stepDrone(drone, target, others, dt, cfg, runTime, arena.covers);
    next.push(step.drone);
    if (step.fire) launchBolt(step.drone, cfg, target);
    syncDroneView(step.drone, target);
  }
  drones = next;
}

function syncDroneView(drone: Drone, target: Vec3): void {
  const view = droneViews.get(drone.id);
  if (!view) return;
  view.position.set(drone.pos.x, drone.pos.y, drone.pos.z);
  view.lookAt(target.x, target.y - 0.3, target.z);
  view.userData.ring.rotation.z += 0.09;
  const glow = drone.telegraph ? 3.4 + Math.sin(runTime * 40) * 1.2 : 1.2;
  view.userData.coreMaterial.emissiveIntensity = glow;
  view.userData.coreMaterial.emissive.set(drone.telegraph ? '#ffffff' : NEON_MAGENTA);
}

function launchBolt(drone: Drone, cfg: ReturnType<typeof waveConfig>, target: Vec3): void {
  const bolt = newBolt(nextId, drone.pos, target, cfg, rng);
  nextId += 1;
  bolts = [...bolts, bolt];
  const view = boltPool.take();
  boltViews.set(bolt.id, view);
  game.audio.play('droneShot', { vary: 0.1 });
}

function updateBolts(dt: number): void {
  const target = playerEye();
  const survivors: Bolt[] = [];
  const substeps = 3;
  for (const original of bolts) {
    let bolt = original;
    let alive = true;
    for (let i = 0; i < substeps && alive; i += 1) {
      bolt = stepBolt(bolt, dt / substeps);
      if (boltHitsPlayer(bolt, target)) {
        hurtPlayer(bolt.damage);
        alive = false;
      } else if (boltBlocked(bolt, arena.covers)) {
        sparks.burst([bolt.pos.x, bolt.pos.y, bolt.pos.z], { count: 10, color: '#fb7185', speed: 3, lifetime: 0.3 });
        alive = false;
      }
    }
    if (alive && !boltExpired(bolt)) {
      survivors.push(bolt);
      const view = boltViews.get(bolt.id);
      if (view) {
        view.position.set(bolt.pos.x, bolt.pos.y, bolt.pos.z);
        view.lookAt(bolt.pos.x + bolt.vel.x, bolt.pos.y + bolt.vel.y, bolt.pos.z + bolt.vel.z);
      }
    } else {
      const view = boltViews.get(bolt.id);
      if (view) boltPool.give(view);
      boltViews.delete(bolt.id);
    }
  }
  bolts = survivors;
}

function updatePickups(dt: number): void {
  const target = playerEye();
  for (const pickup of pickups) {
    const view = pickupViews.get(pickup.id);
    if (view) {
      view.rotation.y += dt * 2.2;
      view.position.y = pickup.pos.y + Math.sin(runTime * 3 + pickup.id) * 0.12;
      view.visible = pickup.life > 4 || Math.floor(pickup.life * 6) % 2 === 0;
    }
    if (pickupInReach(pickup, target)) {
      const applied = applyPickup(pickup.kind, player, weapon);
      player = applied.player;
      weapon = applied.weapon;
      game.audio.play(pickup.kind === 'health' ? 'powerup' : 'coin');
      game.hud.flash(pickup.kind === 'health' ? '#34d399' : '#fbbf24', { duration: 220, opacity: 0.25 });
      game.hud.toast(pickup.kind === 'health' ? 'Health +35' : 'Ammo +30');
      removePickup(pickup.id);
    }
  }
  pickups = pickups.map((p) => ({ ...p, life: p.life - dt })).filter((p) => {
    if (p.life > 0) return true;
    const view = pickupViews.get(p.id);
    if (view) pickupPools[p.kind].give(view);
    pickupViews.delete(p.id);
    return false;
  });
}

// --- State machine -------------------------------------------------------------------------

const machine = createStateMachine(
  {
    menu: {
      enter: () => {
        playing = false;
        resetRun();
        crosshair.hide();
        overlay = game.hud.overlay({
          title: 'Neon Siege 3D',
          body: `Hold the arena against waves of hovering drones.\nWASD move, mouse aim, click fire, R reload, Shift sprint.\nShoot from cover and grab the health and ammo drops.\nBest score: ${best.best}`,
          buttons: [{ label: 'Deploy', onClick: () => deploy() }],
        });
      },
      update: () => {
        if (game.input.pressed('jump') || game.input.pressed('restart')) {
          overlay?.close();
          deploy();
        }
      },
    },
    play: {
      enter: () => {
        resetRun();
        playing = true;
        crosshair.show();
        game.audio.music.start({ notes: [110, 131, 98, 147], tempo: 200, type: 'sawtooth', gain: 0.03 });
        updateHud();
      },
      update: (dt) => {
        runTime += dt;
        difficulty.update(dt);
        player = tickPlayer(player, dt);
        const tick = tickWaves(waves, dt, drones.length, difficulty.level);
        waves = tick.waves;
        if (tick.event === 'started') announceWave();
        if (tick.event === 'cleared') {
          game.hud.toast('Wave cleared');
          game.audio.play('win', { pitch: 1.2 });
        }
        if (tick.spawn > 0) addDrone();
        handleWeapon(dt);
        updateDrones(dt);
        updateBolts(dt);
        updatePickups(dt);
        heartbeat.update(dt);
        refresh.update(dt);
        if (isDead(player)) {
          updateHud();
          machine.go('over');
        }
      },
      exit: () => {
        playing = false;
        game.audio.music.stop();
      },
    },
    over: {
      enter: () => {
        lastWave = waves.wave;
        const record = run.score > best.best;
        best.set(Math.max(best.best, run.score));
        crosshair.hide();
        game.input.exitPointerLock();
        game.audio.play('lose');
        overlay = game.hud.overlay({
          title: `Overrun on wave ${lastWave}`,
          body: `Drones destroyed: ${run.kills}\nScore: ${run.score}\nAccuracy: ${accuracy(run)}%${record ? '\nNew best score!' : `\nBest score: ${best.best}`}`,
          buttons: [{ label: 'Redeploy', onClick: () => deploy() }],
        });
      },
      update: () => {
        if (machine.time > 0.8 && (game.input.pressed('reload') || game.input.pressed('jump'))) {
          overlay?.close();
          deploy();
        }
      },
    },
  },
  'menu',
  game,
);

/** Called from a click or a key: starts a run and, from a click, captures the mouse. */
function deploy(): void {
  if (!game.input.touch) game.input.requestPointerLock();
  machine.go('play');
}

function announceWave(): void {
  game.hud.banner(`Wave ${waves.wave}`);
  game.audio.play('alarm', { pitch: 1.4 });
  waveStat.set(waves.wave);
}

// --- Per-frame visuals ---------------------------------------------------------------------

game.onUpdate((dt) => {
  rig.position.set(0, 0, 0);
  shake.update(dt);
  const kick = recoil.update(dt);
  rig.rotation.x = kick * 0.03;
  const moving = Math.min(1, Math.hypot(body.velocity.x, body.velocity.z) / 7);
  rifle.group.position.set(RIFLE_HOME.x + Math.sin(runTime * 6) * 0.004 * moving, RIFLE_HOME.y + Math.abs(Math.sin(runTime * 6)) * 0.006 * moving, RIFLE_HOME.z + kick * 0.12);
  rifle.group.rotation.x = kick * 0.25;

  // Show the flash first and age it after, so a shot is always drawn at least once, even on a slow frame.
  muzzleFlash.visible = flashLife > 0;
  muzzleLight.intensity = flashLife > 0 ? 7 : 0;
  flashLife = Math.max(0, flashLife - dt);

  hitmarker = Math.max(0, hitmarker - dt);
  crosshair.element.style.transform = hitmarker > 0 ? 'translate(-50%, -50%) scale(1.7) rotate(45deg)' : 'translate(-50%, -50%)';
  crosshair.element.style.opacity = hitmarker > 0 ? '1' : '';

  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    if (!t) continue;
    t.life -= dt;
    if (t.life <= 0) {
      tracerPool.give(t.mesh);
      tracers.splice(i, 1);
    }
  }
  if (!playing) runTime += dt;
});

game.probe.register('neonSiege', () => ({
  state: machine.current,
  wave: waves.wave,
  phase: waves.phase,
  toSpawn: waves.toSpawn,
  health: player.health,
  ammo: { mag: weapon.mag, reserve: weapon.reserve, reloading: weapon.reloadLeft > 0 },
  kills: run.kills,
  score: run.score,
  shots: run.shots,
  hits: run.hits,
  best: best.best,
  locked: game.input.locked,
  postfx: post.enabled,
  player: {
    x: Number(fps.object.position.x.toFixed(2)),
    y: Number(fps.object.position.y.toFixed(2)),
    z: Number(fps.object.position.z.toFixed(2)),
    yaw: Number(fps.object.rotation.y.toFixed(4)),
    pitch: Number(game.camera.rotation.x.toFixed(4)),
    radius: PLAYER_RADIUS,
  },
  drones: drones.map((d) => ({ id: d.id, x: Number(d.pos.x.toFixed(2)), y: Number(d.pos.y.toFixed(2)), z: Number(d.pos.z.toFixed(2)), hp: d.hp, telegraph: d.telegraph })),
  bolts: bolts.length,
  pickups: pickups.map((p) => ({ kind: p.kind, x: Number(p.pos.x.toFixed(2)), z: Number(p.pos.z.toFixed(2)) })),
}));
