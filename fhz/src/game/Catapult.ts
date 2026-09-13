import { Group, Sprite, RectShape, type Texture, type App, type PointerEvent2D } from 'easy-game-maker';
import type { PhysicsWorld } from 'easy-game-maker';
import type { FruitActor } from './FruitActor';
import type { GameCamera } from './GameCamera';
import { CATAPULT_X, CATAPULT_Y } from '../config/levels';

const FRUIT_DRAG_RADIUS = 80;
const MAX_PULL = 80;
const LAUNCH_SCALE = 0.14;

export class Catapult extends Group {
  private readonly _forkLeft: Sprite;
  private readonly _forkRight: Sprite;
  private _elasticL: RectShape | null = null;
  private _elasticR: RectShape | null = null;
  private _fruit: FruitActor | null = null;
  private readonly _physics: PhysicsWorld;
  private readonly _camera: GameCamera;
  private _isDraggingFruit = false;
  private _isDraggingCamera = false;
  private _prevDragX = 0;
  private readonly _app: App;
  private _started = false;
  // Position of catapult base and fruit rest in lane-local coordinates
  private readonly _catX: number;
  private readonly _catY: number;
  private readonly _restX: number;
  private readonly _restY: number;

  constructor(
    app: App,
    physics: PhysicsWorld,
    camera: GameCamera,
    texLeft: Texture,
    texRight: Texture,
    catX = CATAPULT_X,
    catY = CATAPULT_Y,
  ) {
    super();
    this._app = app;
    this._physics = physics;
    this._camera = camera;
    this._catX = catX;
    this._catY = catY;
    this._restX = catX;
    this._restY = catY - 65;

    this._forkLeft = new Sprite({ texture: texLeft, x: catX + 20, y: catY - 50, width: 30, height: 74 });
    this._forkLeft.anchorX = 0.5; this._forkLeft.anchorY = 0.5;

    this._forkRight = new Sprite({ texture: texRight, x: catX, y: catY - 25, width: 85, height: 105 });
    this._forkRight.anchorX = 0.5; this._forkRight.anchorY = 0.5;

    this.add(this._forkLeft);
    this.add(this._forkRight);

    this._setupInput();
  }

  get fruit(): FruitActor | null { return this._fruit; }
  get restX(): number { return this._restX; }
  get restY(): number { return this._restY; }

  loadFruit(fruit: FruitActor): void {
    this._fruit = fruit;
    this._fruit.x = this._restX;
    this._fruit.y = this._restY;
    this._fruit.alpha = 1;
    this._fruit.launched = false;
    this._fruit.inAir = false;
    this._fruit.specialUsed = false;
    this._fruit.playNormal();
    this._isDraggingFruit = false;
    this._isDraggingCamera = false;
    this._removeElastic();
  }

  markStarted(): void {
    this._started = true;
  }

  private _toWorld(canvasX: number): number {
    return canvasX - this._camera.group.x;
  }

  private _setupInput(): void {
    const inp = this._app.input;

    inp.on<PointerEvent2D>('pointerdown', (e) => {
      if (!this._started) return;
      if (!this._fruit || this._fruit.launched) return;
      const wx = this._toWorld(e.x);
      // For dual-lane levels the lane group has a y offset; convert canvas y to lane y
      const wy = e.y - this._camera.group.y;
      const distToFruit = Math.hypot(wx - this._fruit.x, wy - this._fruit.y);
      if (distToFruit < FRUIT_DRAG_RADIUS) {
        this._isDraggingFruit = true;
        this._isDraggingCamera = false;
        this._updateElastic(this._fruit.x, this._fruit.y);
      } else {
        this._isDraggingCamera = true;
        this._isDraggingFruit = false;
        this._prevDragX = e.x;
      }
    });

    inp.on<PointerEvent2D>('pointermove', (e) => {
      if (this._isDraggingFruit && this._fruit && !this._fruit.launched) {
        const wx = this._toWorld(e.x);
        const wy = e.y - this._camera.group.y;
        let dx = wx - this._restX;
        let dy = wy - this._restY;
        const dist = Math.hypot(dx, dy);
        if (dist > MAX_PULL) { dx = (dx / dist) * MAX_PULL; dy = (dy / dist) * MAX_PULL; }
        if (dy < -MAX_PULL * 0.5) dy = -MAX_PULL * 0.5;
        this._fruit.x = this._restX + dx;
        this._fruit.y = this._restY + dy;
        this._updateElastic(this._fruit.x, this._fruit.y);
      }
      if (this._isDraggingCamera) {
        const dx = e.x - this._prevDragX;
        this._prevDragX = e.x;
        this._camera.panByDelta(-dx);
      }
    });

    inp.on('pointerup', () => {
      if (this._isDraggingFruit && this._fruit && !this._fruit.launched) {
        const dx = this._fruit.x - this._restX;
        const dy = this._fruit.y - this._restY;
        if (Math.hypot(dx, dy) > 8) {
          this._launch();
        } else {
          this._fruit.x = this._restX;
          this._fruit.y = this._restY;
          this._removeElastic();
        }
      }
      this._isDraggingFruit = false;
      this._isDraggingCamera = false;
    });
  }

  private _launch(): void {
    if (!this._fruit) return;
    const fruit = this._fruit;
    const dx = this._restX - fruit.x;
    const dy = this._restY - fruit.y;
    const body = this._physics.addBody(fruit, {
      type: 'dynamic', shape: 'circle', density: 1, friction: 0.3, restitution: 0.4,
    });
    fruit.physicsBody = body;
    body.setPosition(fruit.x, fruit.y);
    body.linearDamping = 0.1; body.angularDamping = 0.3;
    body.isBullet = true; body.fixedRotation = false;
    body.setVelocity(dx * LAUNCH_SCALE, dy * LAUNCH_SCALE);
    fruit.launched = true; fruit.inAir = true;
    this._removeElastic();
  }

  private _updateElastic(fx: number, fy: number): void {
    this._drawBand('L', this._restX - 20, this._restY, fx, fy);
    this._drawBand('R', this._restX + 25, this._restY, fx, fy);
  }

  private _drawBand(side: 'L' | 'R', x1: number, y1: number, x2: number, y2: number): void {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
    const angle = Math.atan2(y2 - y1, x2 - x1);
    let band = side === 'L' ? this._elasticL : this._elasticR;
    if (!band) {
      band = new RectShape({ x: mx, y: my, width: len, height: 5, fill: '#cc6644' });
      band.anchorX = 0.5; band.anchorY = 0.5; band.rotation = angle;
      this.add(band);
      if (side === 'L') this._elasticL = band; else this._elasticR = band;
    } else {
      band.x = mx; band.y = my; band.width = len; band.rotation = angle;
    }
  }

  private _removeElastic(): void {
    if (this._elasticL) { this.remove(this._elasticL); this._elasticL = null; }
    if (this._elasticR) { this.remove(this._elasticR); this._elasticR = null; }
  }
}
