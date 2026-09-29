# 1945 Air Force

A vertical scrolling shoot-em-up inspired by classic 1945 arcade games, built with the **Easy Game Maker (EGM)** engine. Dodge enemy waves, collect power-ups, and destroy the boss.

## Gameplay

| Action | Key / Input |
|---|---|
| Move | `W A S D` or arrow keys |
| Shoot | `Space` or tap/click |
| Pause | `P` or `Escape` |

- Destroy enemies to score points
- Dodge enemy bullets and formations
- Power-up drops increase fire rate and bullet count
- Boss encounter at the end of each wave
- Lives system — 3 lives per run

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Language | TypeScript |
| Canvas | 420 × 680 px — portrait |

## Project Structure

```
src/
├── game/              — player, enemies, bullets, power-ups, boss logic
├── helpers/           — spawn patterns, collision utilities
├── scenes/
│   ├── MenuScene.ts   — start screen, high score
│   └── GameScene.ts   — main gameplay loop
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
egm build desktop macos      # .app + .dmg
egm build desktop windows    # .msi + .exe
egm build desktop linux      # .AppImage + .deb
```

Only desktop builds are available for now. The web, iOS, Android and TV targets are coming soon.

## Tests

```bash
egm test
egm e2e
```
