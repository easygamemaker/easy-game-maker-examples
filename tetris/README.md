# Tetris

A full-featured Tetris clone built with the **Easy Game Maker (EGM)** engine. Classic piece-dropping gameplay with score, level progression, and next-piece preview.

## Gameplay

| Action | Key |
|---|---|
| Move left | `←` or `A` |
| Move right | `→` or `D` |
| Rotate | `↑` or `W` |
| Soft drop | `↓` or `S` |
| Hard drop | `Space` |
| Pause | `P` |

- Clearing **4 lines** at once (Tetris) scores the highest points
- Speed increases every 10 lines cleared (levels 1–15)
- Game ends when pieces reach the top of the board

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Language | TypeScript |
| Canvas | 500 × 660 px — portrait |

## Project Structure

```
src/
├── scenes/
│   ├── MenuScene.ts       — start screen, high score display
│   └── GameScene.ts       — board, pieces, collision, scoring
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
