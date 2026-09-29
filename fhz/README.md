# Fruits Hate Zombies

An Angry Birds-style physics catapult game built with the **Easy Game Maker (EGM)** engine and **planck.js** physics. Launch fruits from a slingshot to take down zombie hordes.

## Gameplay

| Action | Input |
|---|---|
| Aim catapult | Drag back from the fruit |
| Launch | Release drag |
| Next fruit | Automatic after current fruit lands |

- Drag the fruit back to aim the catapult — the further you pull, the stronger the shot
- Destroy all zombies to complete the level
- **Dual catapult levels** — two lanes with separate catapults
- Collect stars based on remaining zombies and shots used
- Level select screen with progress tracking

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Physics | planck.js (Box2D) |
| Language | TypeScript |
| Canvas | 568 × 320 px — landscape (1136 × 640 on desktop) |

## Project Structure

```
src/
├── config/
│   └── levels.ts          — level definitions (zombies, fruits, positions)
├── game/                  — ZombieActor, FruitActor, CatapultActor, rope physics
├── helpers/               — physics utilities, segment intersection
├── scenes/
│   ├── MenuScene.ts       — main menu
│   ├── LevelSelectScene.ts — level picker with star progress
│   ├── LevelScene.ts      — single-catapult gameplay
│   ├── DualLevelScene.ts  — dual-catapult gameplay (two lanes)
│   └── FinalScene.ts      — win/lose summary, replay, next level
└── main.ts
```

## Running Locally

```bash
npm install
egm simulate
```

## Building

```bash
egm build desktop            # all desktop targets
egm build desktop macos  # 1136 × 640 desktop window
egm build desktop windows    # .msi + .exe
egm build desktop linux      # .AppImage + .deb
```

Only desktop builds are available for now. The web, iOS, Android and TV targets are coming soon.

## Tests

```bash
egm test               # unit: level configs, ZombieActor FSM, physics helpers
                       # integration: actor lifecycle
                       # smoke: MenuScene mounts without crash
egm e2e                # catapult drag-and-launch scenarios
```
