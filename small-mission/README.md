# Small Mission

A **multiplayer top-down tactical shooter** built with the **Easy Game Maker (EGM)** engine and a raw WebSocket backend. Up to 6 players join the same map, pick up ammo, and compete for the most kills in 90 seconds.

## Gameplay

| Action | Input |
|---|---|
| Move | `W A S D` or arrow keys |
| Aim | Mouse (player rotates to face cursor) |
| Shoot | Left click or `Space` |
| Reload | Walk over a golden AMMO crate |

### Rules
- Each player has **3 HP** — takes 3 hits to eliminate
- **8 bullets** per magazine — replenished by picking up AMMO crates on the map
- When all crates are collected, new ones spawn at random locations
- Eliminated players respawn after **3 seconds**
- **90-second** round — player with most kills wins

## Architecture

```
small-mission/
├── backend/           — Node.js WebSocket server (raw ws, no SDK)
│   └── src/
│       ├── rooms/
│       │   ├── RoomManager.ts     — room lifecycle, player assignment
│       │   └── MissionRoom.ts     — server-authoritative game: bullets, hits, pickups
│       └── game/
│           └── ServerMap.ts       — server-side wall collision for bullets
│
└── game/              — EGM TypeScript frontend
    └── src/
        ├── scenes/
        │   ├── MenuScene.ts       — callsign input, connect
        │   ├── LobbyScene.ts      — waiting room, ready-up
        │   ├── GameScene.ts       — top-down gameplay (WASD + mouse aim)
        │   └── ResultsScene.ts    — final scoreboard
        ├── game/
        │   ├── Player.ts          — soldier sprite + health bar
        │   ├── Bullet.ts          — projectile with trail
        │   ├── MapRenderer.ts     — tile-based map (walls, floor)
        │   └── AmmoPickup.ts      — animated rotating crate
        ├── network/
        │   └── MissionClient.ts   — typed WebSocket wrapper
        └── config/
            └── maps.ts            — 20×15 grid map, spawn points, ammo positions
```

## Network Protocol

| Client → Server | Description |
|---|---|
| `player:move` | Position + angle (20 Hz) |
| `player:shoot` | Fire bullet at current angle |
| `ammo:pickup` | Collect nearby ammo crate |

| Server → Client | Description |
|---|---|
| `state:sync` | All player positions (20 Hz) |
| `bullet:fired` | New bullet spawned |
| `player:hit` | Hit registered, HP updated |
| `player:dead` | Elimination + respawn timer |
| `pickup:taken` | Crate collected |
| `pickup:spawn` | New crates spawned |
| `game:end` | Final scores |

## Running Locally

```bash
# Terminal 1 — backend (port 2568)
cd backend && npm install && npm run dev

# Terminal 2 — frontend (port 5173)
cd game && npm install && egm simulate

# Open 2–6 browser tabs → each tab is a separate player
```

## Map

20 columns × 15 rows of 40 px tiles = 800 × 600 canvas.

```
████████████████████
█ . . . █ . . . . █
█ . ██ . . ██ . . █
█ . . . . . . . . █
...
```

`█` wall — `.` path — `⊕` spawn point — `◆` ammo spawn

## Building

```bash
cd game
egm build desktop            # all desktop targets
egm build desktop macos      # .app + .dmg
egm build desktop windows    # .msi + .exe
egm build desktop linux      # .AppImage + .deb
```

Only desktop builds are available for now. The web, iOS, Android and TV targets are coming soon.
