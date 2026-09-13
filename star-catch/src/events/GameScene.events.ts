import type { SceneEvents, VisualScene, App } from 'easy-game-maker';
import { RectShape, Text } from 'easy-game-maker';
import { setBestScore } from './MenuScene.events';

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 360, H = 640;
const PLAYER_SPEED   = 280;
const SPAWN_RATE     = 1.1;
const MIN_SPAWN      = 0.35;
const STAR_SPEED     = 180;
const POOL_SIZE      = 20;
const CATCH_RADIUS   = 44;

// ── Types ─────────────────────────────────────────────────────────────────────

type ObjKind = 'star' | 'bomb';
interface FallObj { shape: RectShape; kind: ObjKind; active: boolean; vy: number; }

// ── Module-level state ────────────────────────────────────────────────────────

let player:      RectShape | null = null;
let playerGlow:  RectShape | null = null;
let scoreText:   Text | null = null;
let livesText:   Text | null = null;
let comboText:   Text | null = null;
let messageText: Text | null = null;
let messageSub:  Text | null = null;

let score = 0, lives = 3, combo = 0;
let phase: 'playing' | 'gameover' | 'waiting' = 'waiting';
let spawnTimer = 0, spawnRate = SPAWN_RATE, elapsed = 0, comboTimer = 0;
const pool: FallObj[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function syncLives(): void {
  if (livesText) livesText.text = '♥ '.repeat(Math.max(0, lives)).trim() || '—';
}

function spawnObject(scene: VisualScene): void {
  const slot = pool.find((o) => !o.active);
  if (!slot) return;

  const x = 24 + Math.random() * (W - 48);
  const isBomb = elapsed > 6 && Math.random() < Math.min(0.28, 0.08 + elapsed / 200);

  slot.active = true;
  slot.kind   = isBomb ? 'bomb' : 'star';
  slot.vy     = STAR_SPEED * (1 + elapsed / 80);
  slot.shape.x = x;
  slot.shape.y = -20;
  slot.shape.visible = true;

  if (isBomb) {
    slot.shape.width = slot.shape.height = 22;
    slot.shape.rotation = 0.785;
    slot.shape.fillColor = [0.9, 0.2, 0.15, 1];
  } else {
    slot.shape.width = slot.shape.height = 18;
    slot.shape.rotation = 0.785;
    slot.shape.fillColor = [1.0, 0.85, 0.05, 1];
  }
}

function showMessage(msg: string, sub: string, duration = 2): void {
  if (messageText) { messageText.text = msg; messageText.alpha = 1; }
  if (messageSub)  { messageSub.text  = sub; messageSub.alpha  = 1; }
  if (duration > 0) {
    setTimeout(() => {
      if (messageText) messageText.alpha = 0;
      if (messageSub)  messageSub.alpha  = 0;
    }, duration * 1000);
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

export default {
  onInit(scene: VisualScene, app: App) {
    // Grab view objects by ID (with null safety)
    player      = scene.getById<RectShape>('player');
    playerGlow  = scene.getById<RectShape>('playerGlow');
    scoreText   = scene.getById<Text>('scoreText');
    livesText   = scene.getById<Text>('livesText');
    comboText   = scene.getById<Text>('comboText');
    messageText = scene.getById<Text>('messageText');
    messageSub  = scene.getById<Text>('messageSub');

    // Reset state
    score = 0; lives = 3; combo = 0;
    phase = 'waiting'; elapsed = 0;
    spawnTimer = 0; spawnRate = SPAWN_RATE; comboTimer = 0;

    if (scoreText)   scoreText.text  = 'Score: 0';
    if (messageText) messageText.alpha = 0;
    if (messageSub)  messageSub.alpha  = 0;
    if (comboText)   comboText.alpha   = 0;
    syncLives();

    // Build falling-object pool (dynamic — NOT in view.json)
    pool.length = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
      const shape = new RectShape({ x: 0, y: -50, width: 18, height: 18,
        anchorX: 0.5, anchorY: 0.5, fill: '#ffd700' });
      shape.visible = false;
      scene.add(shape);
      pool.push({ shape, kind: 'star', active: false, vy: STAR_SPEED });
    }

    showMessage('GET READY', '', 0);
    app.timers.after(1.2, () => {
      if (messageText) messageText.alpha = 0;
      if (messageSub)  messageSub.alpha  = 0;
      phase = 'playing';
    });
  },

  onUpdate(scene: VisualScene, app: App, dt: number) {
    if (phase === 'gameover') {
      if (app.input.isKeyDown(' ') || app.input.isKeyDown('Enter') || app.input.pointer.isDown) {
        void app.goto('MenuScene', { params: { app } });
      }
      return;
    }
    if (phase === 'waiting') return;

    elapsed += dt;

    // ── Player movement ──
    const speed = PLAYER_SPEED * dt;
    if (player) {
      if (app.input.isKeyDown('ArrowLeft') || app.input.isKeyDown('a') || app.input.isKeyDown('A'))
        player.x = Math.max(player.width / 2, player.x - speed);
      if (app.input.isKeyDown('ArrowRight') || app.input.isKeyDown('d') || app.input.isKeyDown('D'))
        player.x = Math.min(W - player.width / 2, player.x + speed);
      if (app.input.pointer.isDown) {
        const tx = app.input.pointer.x;
        const dx = tx - player.x;
        player.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * 1.8);
        player.x  = Math.max(player.width / 2, Math.min(W - player.width / 2, player.x));
      }
      if (playerGlow) playerGlow.x = player.x;
    }

    // ── Spawn ──
    spawnTimer -= dt;
    spawnRate   = Math.max(MIN_SPAWN, SPAWN_RATE - elapsed / 40);
    if (spawnTimer <= 0) { spawnTimer = spawnRate; spawnObject(scene); }

    // ── Update falling objects ──
    for (const obj of pool) {
      if (!obj.active) continue;
      obj.shape.y += obj.vy * dt;
      obj.shape.rotation += dt * (obj.kind === 'bomb' ? 2.5 : 1.8);

      const px = player?.x ?? W / 2;
      const py = player?.y ?? H - 50;
      const dx = Math.abs(obj.shape.x - px);
      const dy = Math.abs(obj.shape.y - py);

      if (dx < CATCH_RADIUS && dy < 24) {
        obj.active = false; obj.shape.visible = false;

        if (obj.kind === 'star') {
          combo++;
          score += combo >= 3 ? 20 : 10;
          if (scoreText) scoreText.text = `Score: ${score}`;
          setBestScore(score);
          if (combo >= 3 && comboText) {
            comboText.text = `COMBO x${combo}!`;
            comboText.alpha = 1;
            comboTimer = 1.2;
          }
        } else {
          lives--; combo = 0; syncLives();
          if (player) { player.fillColor = [0.9, 0.2, 0.2, 1]; }
          if (playerGlow) { playerGlow.fillColor = [0.9, 0.2, 0.2, 1]; }
          app.timers.after(0.35, () => {
            if (player) player.fillColor = [0.3, 0.67, 0.97, 1];
            if (playerGlow) playerGlow.fillColor = [0.45, 0.75, 0.99, 1];
          });
          if (lives <= 0) {
            phase = 'gameover';
            setBestScore(score);
            showMessage('GAME OVER', `Score: ${score}  —  Space / Tap to menu`, 0);
            for (const o of pool) { o.active = false; o.shape.visible = false; }
          }
        }
        continue;
      }
      if (obj.shape.y > H + 30) {
        obj.active = false; obj.shape.visible = false;
        if (obj.kind === 'star') combo = 0;
      }
    }

    // ── Combo fade ──
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboText) comboText.alpha = Math.max(0, comboTimer / 1.2);
    }
  },

  onResume(_scene: VisualScene, _app: App) {},

  onDestroy(_scene: VisualScene, app: App) {
    app.timers.cancelAll();
  },
} satisfies SceneEvents;
