import { App } from 'easy-game-maker';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { FightScene } from './scenes/FightScene';
import { ResultScene } from './scenes/ResultScene';
import { DEFAULT_SESSION, hook, type GameContext } from './game/context';
import { ControlHub } from './game/controls';
import { GameAssets } from './game/assets';
import { parseQuery } from './game/query';
import { H, W } from './game/layout';
import type { AudioDirector } from './audio/director';

/** Feeds real time (not game speed) to the audio director: fades and queued announcer lines follow the wall clock. */
function startAudioClock(audio: AudioDirector): void {
  let last = performance.now();
  const tick = (now: number): void => {
    audio.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

export default function createApp(canvas?: HTMLCanvasElement): App {
  const app = new App({ width: W, height: H, backgroundColor: '#10131f' });
  app.init(canvas);

  const ctx: GameContext = {
    app,
    assets: new GameAssets(app),
    controls: new ControlHub(app),
    query: parseQuery(window.location.search),
    session: DEFAULT_SESSION,
    summary: null,
  };
  hook().speed = ctx.query.speed;
  hook().audio = ctx.assets.audio.debug;
  startAudioClock(ctx.assets.audio);

  app.scenes.add('boot', BootScene);
  app.scenes.add('title', TitleScene);
  app.scenes.add('select', CharacterSelectScene);
  app.scenes.add('stage', StageSelectScene);
  app.scenes.add('fight', FightScene);
  app.scenes.add('result', ResultScene);

  void app.scenes.go('boot', { params: { ctx } });
  app.run();
  return app;
}

if (!window.__EGM_SIMULATOR__) createApp();
