import { Group, RectShape, Scene, Sprite, type SceneParams } from 'easy-game-maker';
import { CHARACTERS } from '../data/characters';
import { STAGES } from '../data/stages';
import { EffectViews } from '../game/effectViews';
import { FighterView, ProjectileViews } from '../game/fighterView';
import { Hud } from '../game/hud';
import { MenuList, type MenuEvent } from '../game/menu';
import { FightRunner, type Controller } from '../game/runner';
import { TOUCH_BUTTONS, TouchPad, isTouchDevice } from '../game/touch';
import { ctxOf, goto, hook, type GameContext } from '../game/context';
import { COLORS, GROUND_SCREEN_Y, H, STAGE_WORLD_H, STAGE_WORLD_W, W } from '../game/layout';
import { Label, rect } from '../game/ui';
import { activeHitbox, hurtboxes, projectileBox } from '../sim/geometry';
import { createRng, nextInt, type MatchState, type SimEvent, type WorldBox } from '../sim';

const RESULT_DELAY_FRAMES = 200;

const SFX_BY_MOVE: Record<string, 'punch' | 'kick'> = {
  lightPunch: 'punch', crouchPunch: 'punch', heavyKick: 'kick', crouchKick: 'kick', jumpKick: 'kick',
};

const outline = (box: WorldBox, color: string): RectShape => {
  const r = new RectShape({ width: box.w, height: box.h, fill: '#00000000', stroke: color, strokeWidth: 2 });
  r.anchorX = 0;
  r.anchorY = 0;
  r.x = box.left;
  r.y = GROUND_SCREEN_Y - box.bottom - box.h;
  return r;
};

export class FightScene extends Scene {
  private ctx!: GameContext;
  private runner!: FightRunner;
  private world = new Group();
  private views!: readonly [FighterView, FighterView];
  private projectiles!: ProjectileViews;
  private effects = new EffectViews();
  private hud!: Hud;
  private debug = new Group();
  private pauseLayer = new Group();
  private pauseMenu!: MenuList;
  private touch = new TouchPad();
  private paused = false;
  private resultTimer = 0;
  private leaving = false;
  private autoplay = false;

  override async onCreate(params?: SceneParams): Promise<void> {
    this.ctx = ctxOf(params);
    const { assets, query } = this.ctx;
    let { session } = this.ctx;
    this.autoplay = query.autoplay;

    // Quick start and autoplay skip the menus: fill the session from the address.
    if (query.quick || query.autoplay) {
      const rng0 = createRng(query.seed);
      const ids = CHARACTERS.filter((c) => assets.hasFighter(c.id)).map((c) => c.id);
      const [a, rng1] = nextInt(rng0, ids.length);
      const [b] = nextInt(rng1, ids.length);
      const stages = STAGES.filter((s) => assets.hasStage(s.id));
      session = {
        ...session,
        mode: query.p2mode === 'human' ? '2p' : '1p',
        p1: query.p1 && assets.hasFighter(query.p1) ? query.p1 : (ids[a] as string),
        p2: query.p2 && assets.hasFighter(query.p2) ? query.p2 : (ids[b] as string),
        stageId: query.stage && assets.hasStage(query.stage) ? query.stage : (stages[query.seed % stages.length]?.id ?? session.stageId),
        difficulty: query.difficulty,
      };
      this.ctx.session = session;
    }

    const controllers: readonly [Controller, Controller] = this.autoplay
      ? ['cpu', 'cpu']
      : ['human', query.p2mode === 'dummy' ? 'dummy' : session.mode === '2p' ? 'human' : 'cpu'];
    this.runner = new FightRunner({
      p1: session.p1, p2: session.p2, stageId: session.stageId, controllers,
      difficulty: session.difficulty, seed: query.seed ^ (Date.now() & 0xffff),
    });

    const stageTex = await assets.stageImage(session.stageId);
    const stage = new Sprite({ texture: stageTex, x: 0, y: H - STAGE_WORLD_H, width: STAGE_WORLD_W, height: STAGE_WORLD_H });
    stage.anchorX = 0;
    stage.anchorY = 0;
    this.world.add(stage);
    const same = session.p1 === session.p2;
    this.views = [
      new FighterView(assets.fighter(session.p1), false),
      new FighterView(assets.fighter(session.p2), same),
    ];
    this.views.forEach((v, i) => {
      v.zIndex = 10 + i;
      this.world.add(v);
    });
    this.projectiles = new ProjectileViews(new Map(CHARACTERS.filter((c) => assets.hasFighter(c.id)).map((c) => [c.id, assets.fighter(c.id)])));
    this.projectiles.zIndex = 40;
    this.debug.zIndex = 60;
    this.world.add(this.projectiles, this.effects, this.debug);
    this.add(this.world);
    this.hud = new Hud(session.p1, session.p2, session.mode);
    this.add(this.hud);
    this.buildTouch();
    this.buildPause();
    this.ctx.app.input.on('pointerdown', this.onPointerDown);
    this.ctx.app.input.on('pointermove', this.onPointerMove);
    this.ctx.app.input.on('pointerup', this.onPointerUp);
    this.render(this.runner.match);
  }

  override onDestroy(): void {
    const input = this.ctx.app.input;
    input.off('pointerdown', this.onPointerDown);
    input.off('pointermove', this.onPointerMove);
    input.off('pointerup', this.onPointerUp);
  }

  override onResume(): void {
    this.leaving = false;
    const h = hook();
    h.scene = 'fight';
    h.mode = this.autoplay ? 'autoplay' : this.ctx.session.mode;
    h.speed = this.ctx.query.speed;
    h.done = false;
    h.winner = null;
    h.match = this.runner.match;
  }

  // ---- touch controls -------------------------------------------------------

  private buildTouch(): void {
    if (!isTouchDevice()) return;
    const layer = new Group();
    layer.zIndex = 120;
    for (const b of TOUCH_BUTTONS) {
      const r = rect(b.x, b.y, b.w, b.h, '#ffffff', 0.22);
      layer.add(r, new Label(b.label, b.x + b.w / 2, b.y + b.h / 2, { size: 34, shadow: null }));
    }
    this.add(layer);
  }

  private readonly onPointerDown = (e: unknown): void => {
    const p = e as { x: number; y: number; pointerId: number };
    if (this.paused) {
      this.handlePause(this.pauseMenu.pointerPress(p.x, p.y));
      return;
    }
    this.touch.press(p.pointerId, p.x, p.y);
    this.ctx.controls.setTouch(this.touch.read());
  };
  private readonly onPointerMove = (e: unknown): void => {
    const p = e as { x: number; y: number; pointerId: number };
    if (this.paused) {
      this.pauseMenu.pointerHover(p.x, p.y);
      return;
    }
    this.touch.move(p.pointerId, p.x, p.y);
    this.ctx.controls.setTouch(this.touch.read());
  };
  private readonly onPointerUp = (e: unknown): void => {
    this.touch.release((e as { pointerId: number }).pointerId);
    this.ctx.controls.setTouch(this.touch.read());
  };

  // ---- pause ----------------------------------------------------------------

  private buildPause(): void {
    this.pauseLayer.zIndex = 200;
    this.pauseLayer.visible = false;
    this.pauseLayer.add(rect(0, 0, W, H, '#000000', 0.62));
    this.pauseLayer.add(new Label('PAUSED', W / 2, 190, { size: 90, color: COLORS.gold }));
    this.pauseMenu = new MenuList(
      [{ id: 'resume', text: 'RESUME' }, { id: 'restart', text: 'RESTART MATCH' }, { id: 'quit', text: 'QUIT TO MENU' }],
      W / 2, 330, 70, 34,
    );
    this.pauseLayer.add(this.pauseMenu);
    this.add(this.pauseLayer);
  }

  private setPaused(value: boolean): void {
    this.paused = value;
    this.pauseLayer.visible = value;
    hook().paused = value;
  }

  private handlePause(ev: MenuEvent | null): void {
    if (!ev) return;
    const { assets } = this.ctx;
    if (ev.type === 'move') assets.play('ui_move');
    if (ev.type !== 'confirm') return;
    assets.play('ui_select');
    if (ev.id === 'resume') this.setPaused(false);
    else if (ev.id === 'restart') {
      this.setPaused(false);
      this.restart();
    } else if (ev.id === 'quit') {
      this.leaving = true;
      this.setPaused(false);
      void goto(this.ctx, 'title');
    }
  }

  private restart(): void {
    const o = this.runner.options;
    this.runner = new FightRunner({ ...o, seed: o.seed + 1 });
    this.resultTimer = 0;
    this.render(this.runner.match);
  }

  // ---- frame loop -----------------------------------------------------------

  override onUpdate(dt: number): void {
    if (this.leaving) return;
    const edges = this.ctx.controls.edges(0, true);
    if (this.paused) {
      this.handlePause(this.pauseMenu.navigate(edges));
      if (edges.start || edges.back) this.setPaused(false);
      return;
    }
    if (edges.start && !this.autoplay && !this.runner.over) {
      this.setPaused(true);
      return;
    }
    const controls = this.ctx.controls;
    const events = this.runner.advance(dt, this.ctx.query.speed, (side) => controls.held(side));
    controls.endFrame();
    this.playSounds(events);
    this.render(this.runner.match);
    this.afterMatchCheck(edges.confirm);
  }

  private playSounds(events: readonly SimEvent[]): void {
    if (this.ctx.query.speed > 1) return;
    const { assets } = this.ctx;
    for (const e of events) {
      if (e.type === 'attackStart') assets.play(SFX_BY_MOVE[e.moveId] ?? 'punch', 0.7);
      else if (e.type === 'specialStart') assets.play('special');
      else if (e.type === 'hit') assets.play('hit');
      else if (e.type === 'block') assets.play('block');
      else if (e.type === 'ko') assets.play('ko');
      else if (e.type === 'roundStart') assets.play('round_start');
    }
  }

  private render(m: MatchState): void {
    const r = this.runner;
    this.views[0].update(m.fighters[0], r.visuals[0], m.frame);
    this.views[1].update(m.fighters[1], r.visuals[1], m.frame);
    this.projectiles.update(m.projectiles);
    this.effects.update(r.effects);
    this.hud.update(m);
    const sx = r.shake > 0 ? (Math.random() - 0.5) * r.shake : 0;
    const sy = r.shake > 0 ? (Math.random() - 0.5) * r.shake : 0;
    this.world.x = -r.camX + sx;
    this.world.y = sy;
    if (this.ctx.query.hitboxes) this.drawDebug(m);
    const h = hook();
    h.match = m;
    h.frame = m.frame;
  }

  private drawDebug(m: MatchState): void {
    this.debug.removeAll();
    for (const f of m.fighters) {
      for (const b of hurtboxes(f)) this.debug.add(outline(b, '#3cff7a'));
      const hit = activeHitbox(f);
      if (hit) this.debug.add(outline(hit, '#ff3355'));
    }
    for (const p of m.projectiles) this.debug.add(outline(projectileBox(p), '#ff3355'));
  }

  private afterMatchCheck(confirm: boolean): void {
    const m = this.runner.match;
    if (m.phase !== 'matchEnd') return;
    const h = hook();
    h.done = true;
    h.winner = m.winner ?? null;
    if (this.autoplay) return;
    this.resultTimer += 1;
    if (this.resultTimer > RESULT_DELAY_FRAMES || (this.resultTimer > 60 && confirm)) {
      this.leaving = true;
      this.ctx.summary = {
        winner: m.winner ?? null,
        wins: m.wins,
        rounds: m.round,
        healthLeft: [m.fighters[0].health, m.fighters[1].health],
      };
      void goto(this.ctx, 'result', 400);
    }
  }
}

