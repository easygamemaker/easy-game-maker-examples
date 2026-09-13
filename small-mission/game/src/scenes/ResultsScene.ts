import {
  Scene, RectShape, Text, type SceneParams, type App,
} from 'easy-game-maker';
import { MissionClient, type MissionResult } from '../network/MissionClient';

const W = 800, H = 600;

export class ResultsScene extends Scene {
  private _app!: App;
  private _client!: MissionClient;
  private _results: MissionResult[] = [];

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app    = params?.['app'] as App;
    this._client = params?.['client'] as MissionClient;
    this._results = (params?.['results'] as MissionResult[]) ?? [];
    this._build();
  }

  private _build(): void {
    const bg = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#0f1410' });
    bg.anchorX = 0; bg.anchorY = 0;
    this.add(bg);

    // Grid overlay
    for (let i = 0; i < 10; i++) {
      const v = new RectShape({ x: i * 80, y: 0, width: 1, height: H, fill: '#ffffff08' });
      v.anchorX = 0; v.anchorY = 0;
      this.add(v);
    }

    const title = new Text({ text: 'MISSION DEBRIEF', x: W / 2, y: 65, fontSize: 38, color: '#4dff88' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    this.add(title);

    const divider = new RectShape({ x: W / 2, y: 88, width: 400, height: 1, fill: '#4dff8844' });
    divider.anchorX = 0.5; divider.anchorY = 0.5;
    this.add(divider);

    // Column headers
    const headers = [
      { text: 'RANK', x: W / 2 - 230 },
      { text: 'SOLDIER', x: W / 2 - 160 },
      { text: 'KILLS', x: W / 2 + 120 },
      { text: 'DEATHS', x: W / 2 + 210 },
    ];
    headers.forEach(h => {
      const t = new Text({ text: h.text, x: h.x, y: 118, fontSize: 11, color: '#4dff8888' });
      t.anchorX = 0; t.anchorY = 0.5;
      this.add(t);
    });

    // Results rows
    this._results.forEach((r, i) => {
      const y      = 158 + i * 58;
      const isSelf = r.sessionId === this._client.sessionId;
      const medals = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
      const isWinner = i === 0;

      const rowBg = new RectShape({
        x: W / 2, y,
        width: 580, height: 46,
        fill: isSelf ? '#142814' : (isWinner ? '#1e2e1e' : '#0d140d'),
      });
      rowBg.anchorX = 0.5; rowBg.anchorY = 0.5;
      this.add(rowBg);

      if (isSelf || isWinner) {
        const borderColor = isSelf ? '#4dff8888' : '#4dff8844';
        const border = new RectShape({ x: W / 2, y, width: 584, height: 50, fill: borderColor });
        border.anchorX = 0.5; border.anchorY = 0.5;
        this.add(border);
        // redraw rowBg on top of border
        const rowFg = new RectShape({ x: W / 2, y, width: 580, height: 46, fill: isSelf ? '#142814' : '#1e2e1e' });
        rowFg.anchorX = 0.5; rowFg.anchorY = 0.5;
        this.add(rowFg);
      }

      // Rank
      const rankText = new Text({
        text: medals[i] ?? `${i + 1}`,
        x: W / 2 - 230, y,
        fontSize: 14,
        color: isWinner ? '#ffd700' : '#ffffffaa',
      });
      rankText.anchorX = 0; rankText.anchorY = 0.5;
      this.add(rankText);

      // Color dot
      const dot = new RectShape({ x: W / 2 - 162, y, width: 10, height: 10, fill: r.color });
      dot.anchorX = 0.5; dot.anchorY = 0.5;
      this.add(dot);

      // Name
      const name = new Text({
        text: `${r.playerName}${isSelf ? '  (you)' : ''}`,
        x: W / 2 - 148, y, fontSize: 16,
        color: isSelf ? '#4dff88' : '#ffffff',
      });
      name.anchorX = 0; name.anchorY = 0.5;
      this.add(name);

      // Kills
      const kills = new Text({
        text: String(r.kills), x: W / 2 + 134, y, fontSize: 18,
        color: r.kills > 0 ? '#ff6644' : '#ffffffaa',
      });
      kills.anchorX = 0; kills.anchorY = 0.5;
      this.add(kills);

      // Deaths
      const deaths = new Text({
        text: String(r.deaths), x: W / 2 + 222, y, fontSize: 18, color: '#ffffffaa',
      });
      deaths.anchorX = 0; deaths.anchorY = 0.5;
      this.add(deaths);
    });

    // Play Again
    const btnBorder = new RectShape({ x: W / 2, y: 530, width: 284, height: 58, fill: '#4dff8866' });
    btnBorder.anchorX = 0.5; btnBorder.anchorY = 0.5;
    this.add(btnBorder);
    const btnBg = new RectShape({ x: W / 2, y: 530, width: 280, height: 54, fill: '#1a4a1a' });
    btnBg.anchorX = 0.5; btnBg.anchorY = 0.5;
    this.add(btnBg);
    const btnText = new Text({ text: 'REDEPLOY', x: W / 2, y: 530, fontSize: 24, color: '#4dff88' });
    btnText.anchorX = 0.5; btnText.anchorY = 0.5;
    this.add(btnText);

    this._app.input.removeAllListeners();
    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      if (Math.abs(e.x - W / 2) < 140 && Math.abs(e.y - 530) < 27) {
        this._client.leave();
        // Destroy stale scene instances so they are recreated fresh next game
        this._app.scenes.destroyScene('lobby');
        this._app.scenes.destroyScene('game');
        this._app.scenes.destroyScene('results');
        void this._app.scenes.go('menu', { params: { app: this._app } });
      }
    });
  }
}
