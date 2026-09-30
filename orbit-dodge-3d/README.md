# Orbit Dodge 3D

A lane-runner space dodger built with the **Easy Game Maker (EGM)** 3D engine. Your ship races down a glowing runway while rows of asteroids rush toward you. Find the gap, keep your hull intact and see how far you get.

## Gameplay

| Action | Control |
|---|---|
| Steer left / right | `A` `D` or `←` `→` |
| Start / launch again | `Space`, `Enter` or the on-screen button |

- You have 3 hull points. A hit costs one and the ship flashes for a moment while it is safe.
- Every row of asteroids you slip past scores 10 points, and the distance you cover scores too.
- The ship speeds up for about 70 seconds and rows get denser, but there is always a reachable gap.
- Your best score is kept in `localStorage`.

## What it shows

- `createGame`, a `lights.night` rig, fog and an attached point light on the ship
- A scrolling grid runway and instanced edge pylons (`models.instances`)
- Asteroids from a `models.createPool`, so nothing is allocated while playing
- `followCamera` with a small screen shake, and a field of view that widens with speed
- Particles for the engine (`stream`) and for crashes (`burst`), plus `shockwave`, `flash` and `pop`
- Bloom through `createPostFX` on glowing materials
- Synthesised sound from `game.audio` (no asset files)
- A `createStateMachine` for menu, play and game over, and `createScore` for the high score
- The lane, row, speed and life rules in `src/logic.ts`, free of three.js so they are unit tested in plain Node

Add `?fx=off` to the page address to turn post-processing off on a slow machine.

## Project structure

```
src/
├── logic.ts        rules: lanes, rows, speed curve, hits, lives, score
├── track.ts        runway, pylons, ship and asteroid models
├── main.ts         game setup, HUD and state machine
└── __tests__/
    └── logic.test.ts
```

## Running locally

```bash
npm install
egm simulate          # open the simulator with live reload
```

## Building

```bash
egm build desktop            # all desktop targets
egm build desktop macos      # .app + .dmg
egm build desktop windows    # .msi + .exe
egm build desktop linux      # .AppImage + .deb
```

Only desktop builds are available for now. The web, iOS, Android and TV targets are not available yet.

## Tests

```bash
npm test               # unit tests for the game rules (Vitest)
npm run typecheck      # tsc --noEmit, strict
```

The engine is the published `easy-game-maker@0.2.0` package (`easy-game-maker/3d`), with `three` 0.185.1 as its peer dependency.
