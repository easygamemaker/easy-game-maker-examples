import { Group, RectShape, Text } from 'easy-game-maker';

const BODY_SIZE = 26;
const DIR_DIST  = 11;

function hexToColor(hex: string): [number, number, number, number] {
  const c = hex.replace('#', '');
  if (c.length >= 6) {
    return [
      parseInt(c.substring(0, 2), 16) / 255,
      parseInt(c.substring(2, 4), 16) / 255,
      parseInt(c.substring(4, 6), 16) / 255,
      c.length === 8 ? parseInt(c.substring(6, 8), 16) / 255 : 1,
    ];
  }
  return [1, 1, 1, 1];
}

export class Player extends Group {
  x = 0;
  y = 0;
  angle = 0;
  hp = 3;
  alive = true;

  readonly sessionId: string;
  readonly playerName: string;
  readonly color: string;
  readonly isLocal: boolean;

  private _body!: RectShape;
  private _localRingBg!: RectShape;
  private _dirDot!: RectShape;
  private _hpBar: RectShape[] = [];
  private _nameLabel!: Text;
  private _deadOverlay!: RectShape;
  private _respawnText!: Text;
  private _origColor!: [number, number, number, number];

  // Remote interpolation
  private _targetX = 0;
  private _targetY = 0;
  private _targetAngle = 0;

  constructor(opts: {
    sessionId: string; playerName: string; color: string;
    x: number; y: number; isLocal: boolean;
  }) {
    super();
    this.sessionId  = opts.sessionId;
    this.playerName = opts.playerName;
    this.color      = opts.color;
    this.isLocal    = opts.isLocal;
    this.x = this._targetX = opts.x;
    this.y = this._targetY = opts.y;
    this._origColor = hexToColor(opts.color);
    this._build();
  }

  private _build(): void {
    // Drop shadow (small dark rect behind)
    const shadow = new RectShape({ x: 3, y: 4, width: BODY_SIZE + 4, height: BODY_SIZE + 4, fill: '#00000055' });
    shadow.anchorX = 0.5; shadow.anchorY = 0.5;
    this.add(shadow);

    // Local player ring (bright ring behind body, only for local)
    this._localRingBg = new RectShape({
      x: 0, y: 0, width: BODY_SIZE + 10, height: BODY_SIZE + 10, fill: '#ffe04433',
    });
    this._localRingBg.anchorX = 0.5; this._localRingBg.anchorY = 0.5;
    this._localRingBg.visible = this.isLocal;
    this.add(this._localRingBg);

    // Body (main soldier square)
    this._body = new RectShape({
      x: 0, y: 0, width: BODY_SIZE, height: BODY_SIZE, fill: this.color,
    });
    this._body.anchorX = 0.5; this._body.anchorY = 0.5;
    this.add(this._body);

    // Direction indicator (small bright square at "front")
    this._dirDot = new RectShape({ x: DIR_DIST, y: 0, width: 7, height: 7, fill: '#ffffffdd' });
    this._dirDot.anchorX = 0.5; this._dirDot.anchorY = 0.5;
    this.add(this._dirDot);

    // Health bar (3 blocks above player)
    for (let i = 0; i < 3; i++) {
      const bar = new RectShape({ x: -17 + i * 13, y: -22, width: 10, height: 5, fill: '#44ff66' });
      bar.anchorX = 0; bar.anchorY = 0.5;
      this._hpBar.push(bar);
      this.add(bar);
    }

    // Name label
    this._nameLabel = new Text({
      text: this.playerName.substring(0, 8),
      x: 0, y: -32, fontSize: 10, color: '#ffffffcc',
    });
    this._nameLabel.anchorX = 0.5; this._nameLabel.anchorY = 0.5;
    this.add(this._nameLabel);

    // Dead overlay (dark square)
    this._deadOverlay = new RectShape({ x: 0, y: 0, width: BODY_SIZE, height: BODY_SIZE, fill: '#00000099' });
    this._deadOverlay.anchorX = 0.5; this._deadOverlay.anchorY = 0.5;
    this._deadOverlay.visible = false;
    this.add(this._deadOverlay);

    // Respawn countdown
    this._respawnText = new Text({ text: '', x: 0, y: 4, fontSize: 11, color: '#ff6644' });
    this._respawnText.anchorX = 0.5; this._respawnText.anchorY = 0.5;
    this.add(this._respawnText);
  }

  setHp(hp: number): void {
    this.hp = hp;
    this._hpBar.forEach((bar, i) => {
      bar.fillColor = i < hp
        ? [0.27, 1, 0.4, 1]
        : [0.2, 0.2, 0.26, 1];
    });
  }

  setDead(respawnSec?: number): void {
    this.alive = false;
    this._deadOverlay.visible = true;
    this._localRingBg.visible = false;
    if (respawnSec !== undefined) this._respawnText.text = `${Math.ceil(respawnSec)}s`;
  }

  setRespawn(x: number, y: number, hp: number): void {
    this.x = this._targetX = x;
    this.y = this._targetY = y;
    this.alive = true;
    this.setHp(hp);
    this._deadOverlay.visible = false;
    this._respawnText.text = '';
    this._localRingBg.visible = this.isLocal;
    this._body.fillColor = [...this._origColor];
  }

  updateRespawnText(secLeft: number): void {
    if (!this.alive) this._respawnText.text = `${Math.ceil(secLeft)}s`;
  }

  setRemoteTarget(x: number, y: number, angle: number): void {
    this._targetX = x;
    this._targetY = y;
    this._targetAngle = angle;
  }

  updateRemote(dt: number): void {
    const t = Math.min(1, dt * 14);
    this.x += (this._targetX - this.x) * t;
    this.y += (this._targetY - this.y) * t;
    let da = this._targetAngle - this.angle;
    while (da >  Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.angle += da * t;
    this._syncVisual();
  }

  syncLocal(): void {
    this._syncVisual();
  }

  private _syncVisual(): void {
    this._dirDot.x = Math.cos(this.angle) * DIR_DIST;
    this._dirDot.y = Math.sin(this.angle) * DIR_DIST;
  }

  flashHit(): void {
    const orig: [number, number, number, number] = [...this._body.fillColor] as [number, number, number, number];
    this._body.fillColor = [1, 1, 1, 1];
    setTimeout(() => { this._body.fillColor = orig; }, 100);
  }
}
