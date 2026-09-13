import { WebSocket } from 'ws';
import { MissionRoom } from './MissionRoom';
import { randomUUID } from 'crypto';

interface ClientMeta { sessionId: string; roomId: string | null; }

export class RoomManager {
  private _rooms = new Map<string, MissionRoom>();
  private _clients = new Map<WebSocket, ClientMeta>();

  handleMessage(ws: WebSocket, msg: { type: string; data?: Record<string, unknown> }): void {
    const { type, data = {} } = msg;

    if (type === 'join_room') {
      this._joinRoom(ws, data as { roomType?: string; playerName?: string });
    } else {
      const meta = this._clients.get(ws);
      if (!meta?.roomId) return;
      const room = this._rooms.get(meta.roomId);
      room?.handleMessage(meta.sessionId, type, data);
    }
  }

  handleDisconnect(ws: WebSocket): void {
    const meta = this._clients.get(ws);
    if (!meta) return;
    this._clients.delete(ws);
    if (meta.roomId) {
      const room = this._rooms.get(meta.roomId);
      room?.removeClient(meta.sessionId);
      if (room && room.clientCount === 0) {
        room.dispose();
        this._rooms.delete(meta.roomId);
        console.log(`[RoomManager] room ${meta.roomId} disposed`);
      }
    }
  }

  private _joinRoom(ws: WebSocket, opts: { playerName?: string }): void {
    const sessionId = randomUUID();
    const playerName = opts.playerName ?? `Soldier${sessionId.substring(0, 4)}`;

    let room: MissionRoom | undefined;
    for (const r of this._rooms.values()) {
      if (r.clientCount < 6 && r.status === 'waiting') { room = r; break; }
    }
    if (!room) {
      const roomId = randomUUID().substring(0, 8);
      room = new MissionRoom(roomId);
      this._rooms.set(roomId, room);
      console.log(`[RoomManager] new room ${roomId}`);
    }

    this._clients.set(ws, { sessionId, roomId: room.id });
    room.addClient(ws, sessionId, playerName);
  }
}
