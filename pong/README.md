# Pong

A classic Pong game built with the **Easy Game Maker (EGM)** engine. Two paddles, one ball — first to 5 points wins.

## Gameplay

| Action | Control |
|---|---|
| Player 1 — Up | `W` |
| Player 1 — Down | `S` |
| Player 2 — Up | `↑` |
| Player 2 — Down | `↓` |

- Ball speed increases with each rally
- First player to **5 points** wins the match
- New game starts automatically after a winner is declared

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Language | TypeScript |
| Canvas | 800 × 500 px — landscape |

## Project Structure

```
src/
├── scenes/
│   └── GameScene.ts       — paddles, ball, score, collision
└── main.ts
```

## Running Locally

```bash
npm install
egm simulate          # open simulator at http://localhost:5173
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
egm test               # unit + integration + smoke
egm e2e                # end-to-end browser runner
```
