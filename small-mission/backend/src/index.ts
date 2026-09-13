import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './rooms/RoomManager';

const PORT = Number(process.env.PORT ?? 2568);

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (_req, res) => res.json({ name: 'Small Mission EGM Server', version: '1.0.0' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const rooms = new RoomManager();

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      rooms.handleMessage(ws, msg);
    } catch (e) {
      console.error('[Server] bad message:', e);
    }
  });
  ws.on('close', () => rooms.handleDisconnect(ws));
  ws.on('error', (e) => console.error('[Server] ws error:', e));
});

httpServer.listen(PORT, () => {
  console.log(`\n🔫  Small Mission EGM Server on ws://localhost:${PORT}\n`);
});
