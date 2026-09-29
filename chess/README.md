# Chess

A fully playable Chess game built with the **Easy Game Maker (EGM)** engine. Includes all standard rules: castling, en passant, pawn promotion, and checkmate detection.

## Gameplay

- Click/tap a piece to select it — valid moves are highlighted
- Click/tap a highlighted square to move
- All standard chess rules enforced (castling, en passant, pawn promotion)
- Check and checkmate detection with visual indicator
- Two-player local mode (pass and play)

| Action | Input |
|---|---|
| Select piece | Click / Tap |
| Move piece | Click highlighted square |
| Deselect | Click the selected piece again |

## Tech Stack

| Layer | Technology |
|---|---|
| Engine | Easy Game Maker (EGM) — WebGL2 |
| Language | TypeScript |
| Canvas | 560 × 620 px — portrait |

## Project Structure

```
src/
├── chess/             — chess engine (rules, move generation, board state)
├── helpers/           — utilities
├── scenes/
│   ├── MenuScene.ts   — start screen
│   └── GameScene.ts   — board rendering, piece interaction, game logic
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
egm test               # unit tests for the chess engine (move validation, checkmate)
egm e2e
```
