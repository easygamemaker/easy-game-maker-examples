/**
 * Rope — N dynamic physics segments connected by Box2D distance joints
 * with frequencyHz=0 (hard inextensible constraint, exactly like the original).
 *
 * Chain:  hookBody —[d]— seg[0] —[d]— seg[1] —…— seg[N-1] —[d]— candyBody
 *
 * Cutting: removes ONLY the joint at cutIndex, segments fade out then dispose.
 */
import { Group, CircleShape, RectShape } from 'easy-game-maker';
import type { PhysicsWorld, PhysicsBody } from 'easy-game-maker';
import type planck from 'planck';
import { segmentsIntersect } from '../helpers/segmentsIntersect';

const SEG_VISUAL_RADIUS = 4;  // rendered radius (px)
const SEG_PHYS_DIAM = 10;     // physics circle diameter (px) → radius 5px / PPM
const SEG_DENSITY = 0.1;
const FADE_DURATION = 0.7;    // seconds before segments disappear

export class Rope extends Group {
  private readonly _segs: CircleShape[] = [];
  private readonly _segBodies: PhysicsBody[] = [];
  private readonly _joints: Array<planck.Joint | null> = [];
  private _hookJoint: planck.Joint | null = null;
  private _candyJoint: planck.Joint | null = null;
  private readonly _connectors: RectShape[] = [];
  private readonly _physics: PhysicsWorld;
  private _cut = false;
  private _fadeElapsed = 0;
  private _fading = false;
  private _disposed = false;

  constructor(
    physics: PhysicsWorld,
    parent: Group,
    hookX: number, hookY: number,
    candyX: number, candyY: number,
    n = 18,
  ) {
    super();
    this._physics = physics;
    parent.add(this);

    const totalDist = Math.hypot(candyX - hookX, candyY - hookY);
    const N1 = n + 1;  // total steps (hook=0, seg[i]=i, candy=N+1)

    // Create N segments at t = i/(N+1) for i=1..N (not at endpoints)
    for (let i = 1; i <= n; i++) {
      const t = i / N1;
      const sx = hookX + (candyX - hookX) * t;
      const sy = hookY + (candyY - hookY) * t;

      const seg = new CircleShape();
      seg.radius = SEG_VISUAL_RADIUS;
      seg.width = SEG_PHYS_DIAM;
      seg.height = SEG_PHYS_DIAM;
      seg.x = sx; seg.y = sy;
      seg.fillColor = [135/255, 89/255, 50/255, 1];

      const body = physics.addBody(seg, {
        type: 'dynamic', shape: 'circle',
        density: SEG_DENSITY, friction: 0, restitution: 0, isSensor: true,
      });
      body.linearDamping = 0.4;
      body.angularDamping = 0.4;
      body.fixedRotation = true;

      this._segs.push(seg);
      this._segBodies.push(body);
      this.add(seg);
    }

    // Distance joints between adjacent segments (frequencyHz=0 = HARD constraint)
    for (let i = 1; i < n; i++) {
      const j = physics.createDistanceJoint(
        this._segBodies[i - 1]!, this._segBodies[i]!, 0, 0,
      );
      this._joints.push(j);
    }

    // Visual connectors (N-1 strips between N segments)
    for (let i = 0; i < n - 1; i++) {
      const conn = new RectShape({ x: 0, y: 0, width: 1, height: 5, fill: '#7A4E28' });
      conn.anchorX = 0.5; conn.anchorY = 0.5;
      this.add(conn);
      this._connectors.push(conn);
    }
  }

  /** Connect rope start to the hook's static body. */
  attachToHook(hookBody: PhysicsBody): void {
    this._hookJoint = this._physics.createDistanceJoint(
      hookBody, this._segBodies[0]!, 0, 0,
    );
  }

  /** Connect rope end to the candy's dynamic body. */
  attachToCandy(candyBody: PhysicsBody): void {
    this._candyJoint = this._physics.createDistanceJoint(
      this._segBodies[this._segBodies.length - 1]!, candyBody, 0, 0,
    );
  }

  get cut(): boolean { return this._cut; }
  get disposed(): boolean { return this._disposed; }

  /**
   * Test if the swipe line (cx1,cy1)→(cx2,cy2) crosses any rope segment.
   * Removes ONLY the intersected joint (original behaviour).
   */
  checkCut(cx1: number, cy1: number, cx2: number, cy2: number): boolean {
    if (this._cut || this._disposed) return false;
    const n = this._segs.length;
    for (let i = 1; i < n; i++) {
      const a = this._segs[i - 1]!;
      const b = this._segs[i]!;
      if (segmentsIntersect(a.x, a.y, b.x, b.y, cx1, cy1, cx2, cy2)) {
        this._doCut(i - 1);  // joint index i-1 is between seg[i-1] and seg[i]
        return true;
      }
    }
    return false;
  }

  private _doCut(jointIndex: number): void {
    this._cut = true;
    // Remove ONLY the intersected joint — upper/lower halves stay connected internally
    const j = this._joints[jointIndex];
    if (j) {
      try { this._physics.removeJoint(j); } catch { /* already gone */ }
      this._joints[jointIndex] = null;
    }
    // Null hook/candy joints so we don't double-remove later
    // They'll be auto-destroyed by planck when their bodies are removed
    this._hookJoint = null;
    this._candyJoint = null;
    this._fading = true;
  }

  /** Called every frame from the scene. Returns true when fully disposed. */
  update(dt: number): boolean {
    if (this._disposed) return true;
    this.updateVisuals();
    if (!this._fading) return false;

    this._fadeElapsed += dt;
    const alpha = Math.max(0, 1 - this._fadeElapsed / FADE_DURATION);
    const brown: [number, number, number, number] = [135/255, 89/255, 50/255, alpha];
    for (const seg of this._segs) seg.fillColor = [...brown];
    for (const conn of this._connectors) conn.fillColor = [122/255, 78/255, 40/255, alpha];

    if (this._fadeElapsed >= FADE_DURATION) {
      this._disposeAll();
      return true;
    }
    return false;
  }

  updateVisuals(): void {
    const n = this._segs.length;
    for (let i = 0; i < n - 1; i++) {
      const a = this._segs[i]!;
      const b = this._segs[i + 1]!;
      const conn = this._connectors[i]!;
      conn.x = (a.x + b.x) / 2;
      conn.y = (a.y + b.y) / 2;
      conn.width = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) + 2);
      conn.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }

  dispose(): void {
    this._fading = true;
    this._cut = true;
    if (this._hookJoint) { try { this._physics.removeJoint(this._hookJoint); } catch { /* */ } this._hookJoint = null; }
    if (this._candyJoint) { try { this._physics.removeJoint(this._candyJoint); } catch { /* */ } this._candyJoint = null; }
    this._disposeAll();
  }

  private _disposeAll(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Null all joint refs — planck auto-destroys them when bodies are removed
    for (let i = 0; i < this._joints.length; i++) this._joints[i] = null;

    // Remove all segment physics bodies (auto-removes their planck joints too)
    for (const body of this._segBodies) {
      try { this._physics.removeBody(body); } catch { /* */ }
    }
  }
}
