import type { NetworkRoom } from 'easy-game-maker';

export const SERVER_URL = 'ws://localhost:2568';

export interface RemotePlayerData {
  x: number; y: number; angle: number; alive: boolean;
}

export interface PlayerFullData {
  sessionId: string; playerName: string; color: string;
  x: number; y: number; angle: number;
  hp: number; ammo: number; kills: number; deaths: number;
  ready: boolean; alive: boolean; spawnIndex: number;
}

export interface PickupData {
  id: string; x: number; y: number; active: boolean;
}

export interface MissionResult {
  sessionId: string; playerName: string; color: string;
  kills: number; deaths: number;
}

export class MissionClient {
  private _room: NetworkRoom;
  readonly sessionId: string;

  onPlayerJoinedCb:  ((d: { sessionId: string; playerName: string; color: string; x: number; y: number }) => void) | null = null;
  onPlayerLeftCb:    ((sessionId: string) => void) | null = null;
  onPlayerReadyCb:   ((sessionId: string) => void) | null = null;
  onStateSyncCb:     ((players: Record<string, RemotePlayerData>, timer: number) => void) | null = null;
  onBulletFiredCb:   ((d: { id: string; ownerId: string; x: number; y: number; angle: number }) => void) | null = null;
  onBulletDestroyedCb: ((d: { id: string; x?: number; y?: number }) => void) | null = null;
  onPlayerHitCb:     ((d: { sessionId: string; attackerId: string; hp: number; x: number; y: number }) => void) | null = null;
  onPlayerDeadCb:    ((d: { sessionId: string; killerId: string; killerName: string; respawnIn: number }) => void) | null = null;
  onPlayerRespawnCb: ((d: { sessionId: string; x: number; y: number; hp: number; ammo: number }) => void) | null = null;
  onAmmoUpdateCb:    ((ammo: number) => void) | null = null;
  onPickupTakenCb:   ((d: { pickupId: string; sessionId: string }) => void) | null = null;
  onPickupSpawnCb:   ((pickups: PickupData[]) => void) | null = null;
  onScoresUpdateCb:  ((scores: Record<string, { kills: number; deaths: number }>) => void) | null = null;
  onCountdownCb:     ((seconds: number) => void) | null = null;
  onGameStartCb:     ((duration: number) => void) | null = null;
  onGameEndCb:       ((results: MissionResult[]) => void) | null = null;
  onGameResetCb:     (() => void) | null = null;
  onErrorCb:         ((err: { code: number; message?: string }) => void) | null = null;

  constructor(room: NetworkRoom) {
    this._room = room;
    this.sessionId = room.sessionId;
  }

  get roomId(): string { return this._room.roomId; }

  get initialState(): { players: Record<string, PlayerFullData>; pickups: PickupData[]; status: string } | undefined {
    return this._room.initialState as { players: Record<string, PlayerFullData>; pickups: PickupData[]; status: string } | undefined;
  }

  bind(): void {
    this._room.onMessage<{ players: Record<string, RemotePlayerData>; timer: number }>(
      'state:sync', (d) => this.onStateSyncCb?.(d.players, d.timer),
    );
    this._room.onMessage<{ sessionId: string; playerName: string; color: string; x: number; y: number }>(
      'player:joined', (d) => this.onPlayerJoinedCb?.(d),
    );
    this._room.onMessage<{ sessionId: string }>(
      'player:left', (d) => this.onPlayerLeftCb?.(d.sessionId),
    );
    this._room.onMessage<{ sessionId: string }>(
      'player:ready', (d) => this.onPlayerReadyCb?.(d.sessionId),
    );
    this._room.onMessage<{ id: string; ownerId: string; x: number; y: number; angle: number }>(
      'bullet:fired', (d) => this.onBulletFiredCb?.(d),
    );
    this._room.onMessage<{ id: string; x?: number; y?: number }>(
      'bullet:destroyed', (d) => this.onBulletDestroyedCb?.(d),
    );
    this._room.onMessage<{ sessionId: string; attackerId: string; hp: number; x: number; y: number }>(
      'player:hit', (d) => this.onPlayerHitCb?.(d),
    );
    this._room.onMessage<{ sessionId: string; killerId: string; killerName: string; respawnIn: number }>(
      'player:dead', (d) => this.onPlayerDeadCb?.(d),
    );
    this._room.onMessage<{ sessionId: string; x: number; y: number; hp: number; ammo: number }>(
      'player:respawn', (d) => this.onPlayerRespawnCb?.(d),
    );
    this._room.onMessage<{ ammo: number }>(
      'ammo:update', (d) => this.onAmmoUpdateCb?.(d.ammo),
    );
    this._room.onMessage<{ pickupId: string; sessionId: string }>(
      'pickup:taken', (d) => this.onPickupTakenCb?.(d),
    );
    this._room.onMessage<{ pickups: PickupData[] }>(
      'pickup:spawn', (d) => this.onPickupSpawnCb?.(d.pickups),
    );
    this._room.onMessage<{ scores: Record<string, { kills: number; deaths: number }> }>(
      'scores:update', (d) => this.onScoresUpdateCb?.(d.scores),
    );
    this._room.onMessage<{ seconds: number }>(
      'game:countdown', (d) => this.onCountdownCb?.(d.seconds),
    );
    this._room.onMessage<{ duration: number }>(
      'game:start', (d) => this.onGameStartCb?.(d.duration),
    );
    this._room.onMessage<{ results: MissionResult[] }>(
      'game:end', (d) => this.onGameEndCb?.(d.results),
    );
    this._room.onMessage('game:reset', () => this.onGameResetCb?.());
    this._room.on('error', (err) => this.onErrorCb?.(err as { code: number; message?: string }));
  }

  sendReady(): void { this._room.send('ready'); }
  sendMove(x: number, y: number, angle: number): void { this._room.send('player:move', { x, y, angle }); }
  sendShoot(angle: number): void { this._room.send('player:shoot', { angle }); }
  sendPickup(pickupId: string): void { this._room.send('ammo:pickup', { pickupId }); }
  leave(): void { this._room.leave(); }
}
