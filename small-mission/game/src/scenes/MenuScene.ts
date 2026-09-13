import {
  Scene, RectShape, Text, type SceneParams, type App,
} from 'easy-game-maker';
import { SERVER_URL } from '../network/MissionClient';

const W = 800, H = 600;

/** Draw a bordered box using two rects (outer = border, inner = fill). */
function addBox(scene: Scene, cx: number, cy: number, w: number, h: number, fillHex: string, borderHex: string): void {
  const outer = new RectShape({ x: cx, y: cy, width: w + 4, height: h + 4, fill: borderHex });
  outer.anchorX = 0.5; outer.anchorY = 0.5;
  scene.add(outer);
  const inner = new RectShape({ x: cx, y: cy, width: w, height: h, fill: fillHex });
  inner.anchorX = 0.5; inner.anchorY = 0.5;
  scene.add(inner);
}

export class MenuScene extends Scene {
  private _app!: App;
  private _playerName = 'Soldier';
  private _connecting = false;
  private _statusText!: Text;
  private _nameDisplay!: Text;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    this._app.network.setServer(SERVER_URL);
    this._build();
  }

  override onResume(): void {
    this._connecting = false;
    if (this._statusText) {
      this._statusText.text  = `SERVER  ${SERVER_URL}`;
      this._statusText.color = '#4dff8844';
    }
    // Re-register input after returning from game (GameScene clears all listeners)
    this._app.input.removeAllListeners();
    this._app.input.on('keydown', (e: { key: string }) => {
      if (this._connecting) return;
      if (e.key === 'Enter') { this._connect(); return; }
      if (e.key === 'Backspace') {
        this._playerName = this._playerName.slice(0, -1);
      } else if (e.key.length === 1 && this._playerName.length < 12) {
        this._playerName += e.key;
      }
      this._nameDisplay.text = this._playerName + '_';
    });
    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      if (this._connecting) return;
      if (Math.abs(e.x - W / 2) < 142 && Math.abs(e.y - 360) < 28) this._connect();
    });
  }

  private _build(): void {
    // ── Background ────────────────────────────────────────────
    const bg = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#0a0f0a' });
    bg.anchorX = 0; bg.anchorY = 0;
    this.add(bg);

    // Grid lines (subtle tactical overlay)
    for (let i = 1; i < 10; i++) {
      const v = new RectShape({ x: i * 80, y: 0, width: 1, height: H, fill: '#4dff880a' });
      v.anchorX = 0; v.anchorY = 0;
      this.add(v);
    }
    for (let i = 1; i < 8; i++) {
      const h = new RectShape({ x: 0, y: i * 75, width: W, height: 1, fill: '#4dff880a' });
      h.anchorX = 0; h.anchorY = 0;
      this.add(h);
    }

    // Horizontal & vertical center cross (targeting reticle feel)
    const hLine = new RectShape({ x: W / 2, y: H / 2, width: W, height: 1, fill: '#4dff8818' });
    hLine.anchorX = 0.5; hLine.anchorY = 0.5;
    this.add(hLine);
    const vLine = new RectShape({ x: W / 2, y: H / 2, width: 1, height: H, fill: '#4dff8818' });
    vLine.anchorX = 0.5; vLine.anchorY = 0.5;
    this.add(vLine);

    // Corner brackets (4 corners)
    const BL = 22, BT = 2;
    const corners: [number, number, number, number][] = [
      [18, 18, 1, -1], [W - 18, 18, -1, -1],
      [18, H - 18, 1, 1], [W - 18, H - 18, -1, 1],
    ];
    corners.forEach(([cx, cy, sx, sy]) => {
      const bh = new RectShape({ x: cx, y: cy, width: BL * sx, height: BT * sy, fill: '#4dff8855' });
      bh.anchorX = 0; bh.anchorY = 0;
      this.add(bh);
      const bv = new RectShape({ x: cx, y: cy, width: BT * sx, height: BL * sy, fill: '#4dff8855' });
      bv.anchorX = 0; bv.anchorY = 0;
      this.add(bv);
    });

    // ── Top accent bar ────────────────────────────────────────
    const topBar = new RectShape({ x: 0, y: 0, width: W, height: 3, fill: '#4dff8855' });
    topBar.anchorX = 0; topBar.anchorY = 0;
    this.add(topBar);

    const classLabel = new Text({ text: '[ CLASSIFIED — LEVEL 4 CLEARANCE ]', x: W / 2, y: 18, fontSize: 10, color: '#4dff8855' });
    classLabel.anchorX = 0.5; classLabel.anchorY = 0.5;
    this.add(classLabel);

    // ── Title block ───────────────────────────────────────────
    // Accent line above title
    const titleLine = new RectShape({ x: W / 2, y: 68, width: 480, height: 2, fill: '#4dff8844' });
    titleLine.anchorX = 0.5; titleLine.anchorY = 0.5;
    this.add(titleLine);

    const title = new Text({ text: 'SMALL MISSION', x: W / 2, y: 105, fontSize: 56, color: '#4dff88' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    this.add(title);

    // Subtitle row: line + text + line
    const sub1 = new RectShape({ x: W / 2 - 200, y: 142, width: 80, height: 1, fill: '#4dff8855' });
    sub1.anchorX = 0.5; sub1.anchorY = 0.5;
    this.add(sub1);
    const sub = new Text({ text: 'MULTIPLAYER TACTICAL SHOOTER', x: W / 2, y: 142, fontSize: 13, color: '#4dff8888' });
    sub.anchorX = 0.5; sub.anchorY = 0.5;
    this.add(sub);
    const sub2 = new RectShape({ x: W / 2 + 200, y: 142, width: 80, height: 1, fill: '#4dff8855' });
    sub2.anchorX = 0.5; sub2.anchorY = 0.5;
    this.add(sub2);

    // Accent line below title
    const titleLine2 = new RectShape({ x: W / 2, y: 162, width: 480, height: 2, fill: '#4dff8844' });
    titleLine2.anchorX = 0.5; titleLine2.anchorY = 0.5;
    this.add(titleLine2);

    // ── Callsign input ────────────────────────────────────────
    const callLabel = new Text({ text: 'CALLSIGN', x: W / 2, y: 222, fontSize: 11, color: '#4dff8877' });
    callLabel.anchorX = 0.5; callLabel.anchorY = 0.5;
    this.add(callLabel);

    // Input box: outer border (#4dff8844 = semi-transparent green), inner fill (#0e1a0e = very dark)
    addBox(this, W / 2, 262, 320, 44, '#0e1a0e', '#4dff8855');

    // Cursor indicator left accent
    const inputLeft = new RectShape({ x: W / 2 - 162, y: 262, width: 3, height: 30, fill: '#4dff8888' });
    inputLeft.anchorX = 0.5; inputLeft.anchorY = 0.5;
    this.add(inputLeft);

    this._nameDisplay = new Text({ text: this._playerName + '_', x: W / 2 - 148, y: 262, fontSize: 20, color: '#4dff88' });
    this._nameDisplay.anchorX = 0; this._nameDisplay.anchorY = 0.5;
    this.add(this._nameDisplay);

    // ── Deploy button ──────────────────────────────────────────
    // Outer glow ring, dark inner, bright text
    const btnGlow = new RectShape({ x: W / 2, y: 360, width: 288, height: 60, fill: '#4dff8833' });
    btnGlow.anchorX = 0.5; btnGlow.anchorY = 0.5;
    this.add(btnGlow);

    addBox(this, W / 2, 360, 280, 52, '#0e2a1a', '#4dff88aa');

    // Button corner decorators
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const bx = new RectShape({ x: W / 2 + sx! * 130, y: 360 + sy! * 18, width: 10, height: 2, fill: '#4dff88' });
      bx.anchorX = 0.5; bx.anchorY = 0.5;
      this.add(bx);
      const by = new RectShape({ x: W / 2 + sx! * 130, y: 360 + sy! * 18, width: 2, height: 10, fill: '#4dff88' });
      by.anchorX = 0.5; by.anchorY = 0.5;
      this.add(by);
    });

    const btnText = new Text({ text: 'DEPLOY', x: W / 2, y: 360, fontSize: 26, color: '#4dff88' });
    btnText.anchorX = 0.5; btnText.anchorY = 0.5;
    this.add(btnText);

    // ── Bottom strip ───────────────────────────────────────────
    const bottomBar = new RectShape({ x: 0, y: H - 3, width: W, height: 3, fill: '#4dff8833' });
    bottomBar.anchorX = 0; bottomBar.anchorY = 0;
    this.add(bottomBar);

    this._statusText = new Text({ text: `SERVER  ${SERVER_URL}`, x: W / 2, y: 444, fontSize: 11, color: '#4dff8844' });
    this._statusText.anchorX = 0.5; this._statusText.anchorY = 0.5;
    this.add(this._statusText);

    const hint = new Text({ text: 'WASD  move   ·   Mouse  aim   ·   LMB / Space  shoot', x: W / 2, y: 476, fontSize: 11, color: '#ffffff22' });
    hint.anchorX = 0.5; hint.anchorY = 0.5;
    this.add(hint);

    // ── Input handling ─────────────────────────────────────────
    this._app.input.removeAllListeners();
    this._app.input.on('keydown', (e: { key: string }) => {
      if (this._connecting) return;
      if (e.key === 'Enter') { this._connect(); return; }
      if (e.key === 'Backspace') {
        this._playerName = this._playerName.slice(0, -1);
      } else if (e.key.length === 1 && this._playerName.length < 12) {
        this._playerName += e.key;
      }
      this._nameDisplay.text = this._playerName + '_';
    });

    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      if (this._connecting) return;
      if (Math.abs(e.x - W / 2) < 142 && Math.abs(e.y - 360) < 28) this._connect();
    });
  }

  private async _connect(): Promise<void> {
    if (this._connecting || !this._playerName.trim()) return;
    this._connecting = true;
    this._statusText.text  = '▸  CONNECTING…';
    this._statusText.color = '#ffaa00';

    try {
      const room = await this._app.network.joinRoom('mission', {
        playerName: this._playerName.trim(),
      });
      this._statusText.text  = '▸  DEPLOYING…';
      this._statusText.color = '#4dff88';
      await this._app.scenes.go('lobby', {
        params: { app: this._app, room, playerName: this._playerName.trim() },
      });
    } catch (err) {
      this._connecting = false;
      this._statusText.text  = `✕  ${(err as Error).message}`;
      this._statusText.color = '#ff4444';
    }
  }
}
