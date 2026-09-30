# Neon Siege 3D

A first-person wave shooter built with the **Easy Game Maker (EGM)** 3D engine. You hold a neon arena with a pulse rifle while waves of hovering drones close in, circle you and fire back. Shoot from cover, reload at the right moment and see how many waves you can survive.

The game is original: a first-person shooter in the spirit of the genre, with its own arena, drones and sounds.

## Gameplay

| Action | Control |
|---|---|
| Move | `W` `A` `S` `D` |
| Aim | Mouse (click the screen once to capture it) |
| Fire | Left click (hold for automatic fire) or `Enter` |
| Reload | `R` |
| Sprint / Jump | `Shift` / `Space` |
| Deploy / Redeploy | The on-screen button, `Space` or `R` on the game over screen |

- The rifle holds 30 rounds and reloads in about a second and a half from a reserve. It reloads by itself when the magazine runs dry.
- Drones drift to shooting range, circle-strafe, glow white for half a second and then fire a bolt. Step aside or break line of sight: bolts stop on cover.
- Each wave has more drones, tougher shells and faster fire than the last. A slow-burn difficulty curve makes a wave that drags on meaner.
- Destroyed drones sometimes drop health (green cross) or ammo (amber cell), more often when you need them.
- The game is over when your health reaches zero. It shows the wave you reached, your score and your accuracy, and the best score is kept in `localStorage`.
- On a touch screen the on-screen Fire, Reload and Jump buttons appear.

## What it shows

- `createGame`, a `lights.night` plus `lights.moody` rig, fog, and a skyline of instanced towers (`models.instances`)
- `firstPerson` with a physics body from `createPhysics`, so jumping and walls work
- A hitscan rifle: `physics.raycast` from the camera against the drone hit boxes and the cover, so cover really blocks shots
- `createCooldown` for the fire rate and `createDifficulty` for the difficulty curve; `createTicker` for the low-health heartbeat and the HUD refresh
- Drones and bolts from `models.createPool`, so nothing is allocated while playing
- A `Spring` for weapon recoil, `createShake` for hits, `flash` on struck drones and `pop` on drops
- Muzzle flash, sparks and explosions with `createParticles` (`spray` and `burst`), plus `shockwave`
- Bloom and a vignette through `createPostFX`, on emissive neon materials
- Synthesised sound from `game.audio`, with two custom sounds added through `audio.define`
- HUD: crosshair with a hit marker, health bar, wave, score, ammo, `hud.overlay` for the start and game over screens and `hud.touchButtons`
- A `createStateMachine` for menu, play and game over
- The weapon, health, wave director, drone steering and bolt rules in `src/logic.ts`, free of three.js so they are unit tested in plain Node

Add `?fx=off` to the page address to turn post-processing off on a slow machine.

`window.__EGM_GAME__.probe().neonSiege` reports the state, wave, health, ammo, drones and player aim, which is how the automated playtest drives the game.

## Project structure

```
src/
├── logic.ts        rules: weapon, health, wave director, drone steering, bolts, pickups
├── arena.ts        floor, walls, cover and skyline
├── actors.ts       drone, rifle, bolt, tracer and pickup models
├── sounds.ts       the two custom sounds
├── main.ts         game setup, combat, HUD and state machine
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

The engine is the published `easy-game-maker@0.2.2` package (`easy-game-maker/3d`), with `three` 0.185.1 as its peer dependency.
