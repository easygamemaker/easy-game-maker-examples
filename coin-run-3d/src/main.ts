import * as THREE from 'three';
import {
  createGame,
  createParticles,
  createPostFX,
  createScore,
  createStateMachine,
  createTicker,
  followCamera,
  hits,
  lights,
  materials,
  math,
  models,
  pop,
  thirdPerson,
} from 'easy-game-maker/3d';
import type { HudOverlay } from 'easy-game-maker/3d';
import {
  COIN_COUNT,
  LOW_TIME_SECONDS,
  WALK_RADIUS,
  clampToDisc,
  clock,
  collectCoin,
  createRng,
  newRound,
  pickCoinSpot,
  rankFor,
  startRound,
  tickRound,
} from './logic';
import { buildScenery } from './scenery';

const game = createGame({
  background: '#0b1d33',
  cameraPosition: [0, 9, 10],
  fog: { color: '#cfeaff', near: 45, far: 140 },
});

materials.skyGradient(game.scene, '#3d8fe0', '#cfeaff');
lights.daylight(game.scene, { area: 22, position: [10, 16, 8] });

const { group: scenery, clouds } = buildScenery();
game.add(scenery);

// Hero, blob shadow and the chase camera.
const hero = models.character({ shirt: '#ea580c', trousers: '#1e3a8a', height: 1.6 });
game.add(hero);
const blob = lights.blobShadow(game.scene, hero, { radius: 0.7, opacity: 0.4 });
followCamera(game, hero, { distance: 8, height: 7, stiffness: 5, lookHeight: 1, behind: false });

// The hero only listens to the keyboard while a round is being played.
const zero = new THREE.Vector2(0, 0);
let listening = false;
const gatedInput = {
  get move() {
    return listening ? game.input.move : zero;
  },
  down: (action: string) => listening && game.input.down(action),
  pressed: (action: string) => listening && game.input.pressed(action),
};
const walker = thirdPerson(game, gatedInput, hero, { speed: 7.5, turnRate: 14 });

// Coins: a fixed set that is moved to a new spot when picked up.
const rng = createRng(Date.now() & 0xffff);
const coins: THREE.Group[] = [];
for (let i = 0; i < COIN_COUNT; i += 1) {
  const holder = new THREE.Group();
  const coin = models.coin({ radius: 0.42 });
  holder.add(coin);
  holder.position.y = 0.95;
  game.add(holder);
  coins.push(holder);
}
function respawn(index: number): void {
  const avoid = coins.filter((_, i) => i !== index).map((c) => ({ x: c.position.x, z: c.position.z }));
  avoid.push({ x: hero.position.x, z: hero.position.z });
  const spot = pickCoinSpot(rng, avoid, 3.2);
  coins[index]?.position.set(spot.x, 0.95, spot.z);
}
coins.forEach((_, i) => respawn(i));

const sparks = createParticles(game.engine, { max: 600, size: 0.22 });
const fxQuality = new URLSearchParams(location.search).get('fx') === 'off' ? 'off' : 'auto';
const post = createPostFX(game.engine, { quality: fxQuality, bloom: { strength: 0.5, threshold: 0.88 } });

// HUD.
const scoreStat = game.hud.stat('Score', 0, { at: 'top-left' });
const timeText = game.hud.text('0:45', { at: 'top-center' });
const streakText = game.hud.text('', { at: 'bottom-center' });
game.hud.keys({ 'W A S D': 'run', '← ↑ ↓ →': 'run' }, { at: 'bottom-left' });
const best = createScore({ key: 'coin-run-3d.best' });

let round = newRound();
let overlay: HudOverlay | null = null;
let lastWhole = -1;

function resetHero(): void {
  hero.position.set(0, 0, 0);
  hero.rotation.y = 0;
  round = newRound();
  scoreStat.set(0);
  streakText.set('');
  timeText.set(clock(round.timeLeft));
  coins.forEach((_, i) => respawn(i));
}

const dust = createTicker(0.16, () => {
  if (walker.travel > 0.4) sparks.burst([hero.position.x, 0.1, hero.position.z], { count: 2, color: '#e9d8a6', speed: 1.2, lifetime: 0.4, size: 0.16, gravityScale: 0.2 });
});

const machine = createStateMachine(
  {
    menu: {
      enter: () => {
        listening = false;
        resetHero();
        overlay = game.hud.overlay({
          title: 'Coin Run 3D',
          body: `Grab as many coins as you can in 45 seconds. Quick pickups build a streak.\nBest score: ${best.best}`,
          buttons: [{ label: 'Start run', onClick: () => machine.go('play') }],
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
        resetHero();
        round = startRound(round);
        listening = true;
        lastWhole = -1;
        game.audio.play('select');
        game.audio.music.start({ notes: [262, 330, 392, 330], tempo: 220, gain: 0.05 });
        game.hud.banner('Go!');
      },
      update: (dt) => {
        round = tickRound(round, dt);
        dust.update(dt);
        for (let i = 0; i < coins.length; i += 1) {
          const holder = coins[i];
          if (holder && hits(hero, holder, 0.6, 0.7)) {
            const pickup = collectCoin(round);
            round = pickup.round;
            sparks.burst(holder.position, { count: 22, color: '#facc15', speed: 5, lifetime: 0.7 });
            game.audio.play('coin', { pitch: 1 + round.streak * 0.1, vary: 0.03 });
            void pop(hero, game.tweens, { scale: 1.12, duration: 0.2 });
            game.hud.toast(`+${pickup.points}`, { at: 'top-center', duration: 700 });
            respawn(i);
          }
        }
        scoreStat.set(round.score);
        streakText.set(round.streak > 1 ? `Streak x${round.streak}` : '');
        timeText.set(clock(round.timeLeft));
        const whole = Math.ceil(round.timeLeft);
        if (whole !== lastWhole && whole <= LOW_TIME_SECONDS && whole > 0) game.audio.play('blip', { pitch: 1.4 });
        lastWhole = whole;
        if (round.status === 'over') machine.go('over');
      },
      exit: () => {
        listening = false;
        game.audio.music.stop();
      },
    },
    over: {
      enter: () => {
        best.set(Math.max(best.best, round.score));
        const record = round.score >= best.best && round.score > 0;
        game.audio.play(round.score > 0 ? 'win' : 'lose');
        overlay = game.hud.overlay({
          title: `Time! ${round.score} points`,
          body: `Rank: ${rankFor(round.score)}\nCoins: ${round.collected}${record ? '\nNew best score!' : `\nBest: ${best.best}`}`,
          buttons: [{ label: 'Run again', onClick: () => machine.go('play') }],
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
  const speed = listening ? Math.min(walker.travel * 1.8, 1.8) : 0;
  hero.userData.animate?.(elapsed, speed);
  const pos = clampToDisc({ x: hero.position.x, z: hero.position.z }, WALK_RADIUS);
  hero.position.x = pos.x;
  hero.position.z = pos.z;
  for (const holder of coins) holder.children[0]?.userData.update?.(dt, elapsed);
  clouds.forEach((cloud, i) => {
    cloud.position.x = math.wrap(cloud.position.x + dt * (0.6 + i * 0.15), -50, 50);
  });
  blob.update();
});

game.probe.register('coinRun', () => ({
  state: machine.current,
  score: round.score,
  streak: round.streak,
  collected: round.collected,
  timeLeft: Number(round.timeLeft.toFixed(2)),
  player: { x: Number(hero.position.x.toFixed(2)), z: Number(hero.position.z.toFixed(2)) },
  coins: coins.map((c) => ({ x: Number(c.position.x.toFixed(2)), z: Number(c.position.z.toFixed(2)) })),
  postfx: post.enabled,
}));
