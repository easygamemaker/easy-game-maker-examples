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
egm build web          # static web bundle
egm build ios          # Xcode project
egm build android      # Android Studio project
egm build macos        # macOS desktop app
egm build windows      # Windows installer
```

## Tests

```bash
egm test               # unit + integration + smoke
egm e2e                # end-to-end browser runner
```
