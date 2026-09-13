# Cut the Rope

A physics-based puzzle game inspired by the Cut the Rope franchise, built with the **Easy Game Maker (EGM)** engine and **planck.js** (Box2D) physics. Cut ropes with your finger or mouse to feed the candy to the monster.

## Gameplay

| Action | Input |
|---|---|
| Cut rope | Drag across the rope with mouse or touch |
| Pan / inspect | Scroll to view level |

- Cut ropes strategically to swing the candy into the monster's mouth
- Collect all 3 stars before the candy reaches the monster for a perfect score
- Physics-driven rope simulation — rope segments respond to gravity and momentum
- Multiple levels with increasing complexity

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Physics | planck.js (Box2D port) |
| Language | TypeScript |
| Canvas | 360 × 640 px — portrait |

## Project Structure

```
src/
├── game/              — rope physics, candy actor, monster, stars
├── helpers/           — segment intersection, physics utilities
├── scenes/
│   ├── MenuScene.ts   — level select screen
│   └── GameScene.ts   — physics world, rope cutting, collision
└── main.ts
```

## Running Locally

```bash
npm install
egm simulate
```

## Building

```bash
egm build web
egm build ios
egm build android
egm build macos
egm build windows
```

## Tests

```bash
egm test               # unit tests for rope intersection logic, physics helpers
egm e2e                # drag-cut interaction scenarios
```
