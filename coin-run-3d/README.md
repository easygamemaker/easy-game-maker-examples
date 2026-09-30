# Coin Run 3D

A small third-person game built with the **Easy Game Maker (EGM)** 3D engine. Run around a tiny island and grab as many coins as you can before the 45 second timer ends. Coins picked up in quick succession build a streak that pays more.

## Gameplay

| Action | Control |
|---|---|
| Run | `W` `A` `S` `D` or the arrow keys |
| Start / run again | `Space`, `Enter` or the on-screen button |

- Every coin is worth 10 points. Grabbing the next one within 2 seconds raises the streak, up to +20 per coin.
- A coin you pick up reappears somewhere else on the island, so there is always something to chase.
- Your best score is kept in `localStorage`.

## What it shows

- `createGame` with a sunlit rig (`lights.daylight`), a sky gradient and fog
- `thirdPerson` movement and a `followCamera` chase view
- `lights.blobShadow` under the character
- Pickups with `hits`, particle bursts and a bloom pass (`createPostFX`)
- Synthesised sound from `game.audio` (no asset files)
- A `createStateMachine` for menu, play and game over, plus `createScore` for the high score
- The game rules in `src/logic.ts`, free of three.js so they are unit tested in plain Node

Add `?fx=off` to the page address to turn post-processing off on a slow machine.

## Project structure

```
src/
├── logic.ts        rules: timer, score, streak, coin placement
├── scenery.ts      island, trees, rocks, clouds
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
