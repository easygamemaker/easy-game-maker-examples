import {
  Scene, RectShape, Text, type SceneParams, type App,
} from 'easy-game-maker';
import { MissionClient } from '../network/MissionClient';
import type { NetworkRoom } from 'easy-game-maker';

interface InitialPlayer {
  sessionId: string; playerName: string; color: string; ready: boolean;
}
interface InitialRoomState {
  players: Record<string, InitialPlayer>;
  status: string;
}

const W = 800, H = 600;

export class LobbyScene extends Scene {
  private _app!: App;
  private _client!: MissionClient;
  private _playerName = '';
  private _players: Map<string, { name: string; color: string; ready: boolean }> = new Map();
  private _isReady = false;
  private _playerList!: Text;
  private _statusText!: Text;
  private _readyBtn!: RectShape;
  private _readyBtnText!: Text;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app        = params?.['app'] as App;
    const room       = params?.['room'] as NetworkRoom;
    this._playerName = params?.['playerName'] as string ?? 'Soldier';

    this._client = new MissionClient(room);

    const initial = room.initialState as InitialRoomState | undefined;
    if (initial?.players) {
      Object.values(initial.players).forEach((p) => {
        this._players.set(p.sessionId, { name: p.playerName, color: p.color, ready: p.ready });
      });
    } else {
      this._players.set(this._client.sessionId, { name: this._playerName, color: '#4dff88', ready: false });
    }

    this._build();
    this._bindNetwork();
  }

  private _bindNetwork(): void {
    this._client.bind();

    this._client.onPlayerJoinedCb = (info) => {
      this._players.set(info.sessionId, { name: info.playerName, color: info.color, ready: false });
      this._refreshList();
    };
    this._client.onPlayerLeftCb = (sid) => {
      this._players.delete(sid);
      this._refreshList();
    };
    this._client.onPlayerReadyCb = (sid) => {
      const p = this._players.get(sid);
      if (p) { p.ready = true; this._refreshList(); }
    };
    this._client.onCountdownCb = (sec) => {
      this._statusText.text  = sec > 0 ? `MISSION BEGINS IN ${sec}…` : 'DEPLOY!';
      this._statusText.color = sec <= 1 ? '#ff4444' : '#ffaa00';
    };
    this._client.onGameStartCb = () => {
      // Pass the current players map so GameScene can create remotes for all
      // players who joined after us (their player:joined event was consumed here)
      const lobbyPlayers = new Map(this._players);
      void this._app.scenes.go('game', {
        params: { app: this._app, client: this._client, playerName: this._playerName, lobbyPlayers },
      });
    };
    this._client.onErrorCb = (err) => {
      this._statusText.text  = `Error ${err.code}: ${err.message ?? ''}`;
      this._statusText.color = '#ff4444';
    };

    this._refreshList();
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

    const title = new Text({ text: 'MISSION BRIEFING', x: W / 2, y: 55, fontSize: 30, color: '#4dff88' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    this.add(title);

    const sub = new Text({ text: 'AWAITING TEAM', x: W / 2, y: 88, fontSize: 13, color: '#4dff8866' });
    sub.anchorX = 0.5; sub.anchorY = 0.5;
    this.add(sub);

    // Rules panel
    const rulesBg = new RectShape({ x: W / 2 + 150, y: 300, width: 240, height: 240, fill: '#0d1a0d' });
    rulesBg.anchorX = 0.5; rulesBg.anchorY = 0.5;
    this.add(rulesBg);
    const rulesBorder = new RectShape({ x: W / 2 + 150, y: 300, width: 244, height: 244, fill: '#4dff8822' });
    rulesBorder.anchorX = 0.5; rulesBorder.anchorY = 0.5;
    this.add(rulesBorder);
    const rulesBg2 = new RectShape({ x: W / 2 + 150, y: 300, width: 240, height: 240, fill: '#0d1a0d' });
    rulesBg2.anchorX = 0.5; rulesBg2.anchorY = 0.5;
    this.add(rulesBg2);

    const rulesTitle = new Text({ text: 'RULES', x: W / 2 + 150, y: 195, fontSize: 13, color: '#4dff8899' });
    rulesTitle.anchorX = 0.5; rulesTitle.anchorY = 0.5;
    this.add(rulesTitle);

    const rules = [
      '3 HP per player',
      'Limited ammo (8 bullets)',
      'Pick up AMMO crates',
      'Most kills in 90s wins',
      'Respawn in 3 seconds',
    ];
    rules.forEach((rule, i) => {
      const rt = new Text({ text: `• ${rule}`, x: W / 2 + 40, y: 220 + i * 26, fontSize: 12, color: '#ffffffaa' });
      rt.anchorX = 0; rt.anchorY = 0.5;
      this.add(rt);
    });

    // Player list area
    const listBg = new RectShape({ x: 220, y: 300, width: 380, height: 240, fill: '#0d1a0d' });
    listBg.anchorX = 0.5; listBg.anchorY = 0.5;
    this.add(listBg);
    const listBorder = new RectShape({ x: 220, y: 300, width: 384, height: 244, fill: '#4dff8822' });
    listBorder.anchorX = 0.5; listBorder.anchorY = 0.5;
    this.add(listBorder);
    const listBg2 = new RectShape({ x: 220, y: 300, width: 380, height: 240, fill: '#0d1a0d' });
    listBg2.anchorX = 0.5; listBg2.anchorY = 0.5;
    this.add(listBg2);

    const listTitle = new Text({ text: 'SQUAD', x: 220, y: 184, fontSize: 13, color: '#4dff8899' });
    listTitle.anchorX = 0.5; listTitle.anchorY = 0.5;
    this.add(listTitle);

    this._playerList = new Text({ text: '', x: 46, y: 200, fontSize: 15, color: '#fff' });
    this._playerList.anchorX = 0; this._playerList.anchorY = 0;
    this.add(this._playerList);

    // READY button
    const readyBorder = new RectShape({ x: W / 2, y: 490, width: 264, height: 58, fill: '#4dff8866' });
    readyBorder.anchorX = 0.5; readyBorder.anchorY = 0.5;
    this.add(readyBorder);
    this._readyBtn = new RectShape({ x: W / 2, y: 490, width: 260, height: 54, fill: '#1a4a1a' });
    this._readyBtn.anchorX = 0.5; this._readyBtn.anchorY = 0.5;
    this.add(this._readyBtn);

    this._readyBtnText = new Text({ text: 'READY', x: W / 2, y: 490, fontSize: 26, color: '#4dff88' });
    this._readyBtnText.anchorX = 0.5; this._readyBtnText.anchorY = 0.5;
    this.add(this._readyBtnText);

    // Leave button
    const leaveBg = new RectShape({ x: 60, y: 548, width: 100, height: 34, fill: '#2a1a1a' });
    leaveBg.anchorX = 0.5; leaveBg.anchorY = 0.5;
    this.add(leaveBg);
    const leaveText = new Text({ text: '← ABORT', x: 60, y: 548, fontSize: 12, color: '#ff4444aa' });
    leaveText.anchorX = 0.5; leaveText.anchorY = 0.5;
    this.add(leaveText);

    this._statusText = new Text({ text: 'Waiting for all soldiers to be ready…', x: W / 2, y: 562, fontSize: 13, color: '#4dff8888' });
    this._statusText.anchorX = 0.5; this._statusText.anchorY = 0.5;
    this.add(this._statusText);

    // Input
    this._app.input.removeAllListeners();
    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      if (Math.abs(e.x - W / 2) < 130 && Math.abs(e.y - 490) < 27 && !this._isReady) {
        this._setReady();
      }
      if (Math.abs(e.x - 60) < 50 && Math.abs(e.y - 548) < 17) {
        this._client.leave();
        void this._app.scenes.go('menu', { params: { app: this._app } });
      }
    });
  }

  private _setReady(): void {
    this._isReady = true;
    this._client.sendReady();
    const me = this._players.get(this._client.sessionId);
    if (me) { me.ready = true; this._refreshList(); }
    this._readyBtn.fillColor  = [0.05, 0.23, 0.05, 1];
    this._readyBtnText.text  = '✓ READY';
    this._statusText.text    = 'Waiting for other soldiers…';
  }

  private _refreshList(): void {
    const lines: string[] = [];
    this._players.forEach((p, sid) => {
      const isSelf  = sid === this._client.sessionId;
      const marker  = isSelf ? '► ' : '  ';
      const status  = p.ready ? ' [READY]' : '  [WAIT]';
      lines.push(`${marker}${p.name}${status}`);
    });
    this._playerList.text = lines.join('\n') || '(no soldiers)';
  }
}
