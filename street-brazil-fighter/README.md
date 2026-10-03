# Street Brazil Fighter

A Street Fighter style 2D fighting game with a Brazilian folklore and culture roster, built with the **Easy Game Maker (EGM)** engine. Pick one of six fighters, pick one of nine Brazilian stages and win a best of three match against the CPU (three difficulty levels) or a friend on the same keyboard.

All characters are original: folklore figures and cultural archetypes, no real people, no copyrighted characters and no logos.

## Gameplay

| Action | P1 keyboard | P2 keyboard | Gamepad |
|---|---|---|---|
| Move, jump, crouch | `W A S D` | Arrow keys | D-pad or left stick (pad 0 for P1, pad 1 for P2) |
| Light punch | `J` | Numpad `1` | `X` |
| Heavy kick | `K` | Numpad `2` | `A` |
| Special move | `L` | Numpad `3` | `Y` |
| Block | `U` (or hold back) | Numpad `0` (or hold back) | `B`, `LB` or `RB` |
| Pause | `Esc`, `P` or `Enter` | | `Start` |

On a touch screen (or with `?touch=1` in the address) P1 gets an on-screen d-pad and four buttons.

- Best of three rounds, 99 second timer. When time runs out the fighter with more health wins the round. A drawn round plays again (never more than five rounds).
- Health bars, a special meter (gained by hitting and being hit, 50 per special) and round banners: `ROUND 1`, `FIGHT!`, `KO!`, `TIME!`, `YOU WIN`.
- Normal moves: light punch, heavy kick, crouching punch (`down` + punch), low sweep (`down` + kick) and a jump kick (punch or kick in the air).
- Holding back blocks standing, holding down and back (or crouching with block) blocks low. Low sweeps and ground waves must be blocked crouching.
- Specials chip a little damage through a block. Combos lose damage with every hit (simple combo scaling).
- Press `Start` or `Esc` to pause: resume, restart or leave the match.

### Roster

| Fighter | Inspiration | Special |
|---|---|---|
| Mestre Tiao | Capoeira master: fast, long low kicks | Meia-Lua Tornado, a spinning half-moon dash |
| Cangaceira Dalva | Northeastern cangaco warrior: mid range machete | Peixeira Wave, a slash wave projectile |
| Saci | One-legged prankster of Brazilian folklore: small and mobile | Redemoinho, a mini whirlwind projectile |
| Curupira | Forest guardian with backwards feet: slow, heavy, strong | Pisao da Mata, a ground shockwave |
| Craque da Varzea | Street football player: balanced | Bola de Fogo, a fireball soccer kick |
| Passista Rosa | Carnival samba dancer: agile | Chuva de Plumas, a spinning feather burst |

### Stages

Pelourinho (Salvador), Copacabana (Rio de Janeiro), Amazon River, Avenida Paulista (Sao Paulo), Sambodromo (Rio de Janeiro), Pantanal, Lencois Maranhenses, Cristo Redentor overlook (Rio de Janeiro) and Ouro Preto.

## Debug and automation switches

| Address | Effect |
|---|---|
| `?hitboxes=1` | Draws hurtboxes (green) and hitboxes (red) |
| `?autoplay=cpu` | CPU against CPU, starting straight in a fight |
| `?speed=8` | Runs 8 simulation steps per rendered frame (1 to 16) |
| `?quick=1&p1=tiao&p2=rosa&stage=pantanal` | Skips the menus |
| `?p2mode=dummy` | P2 stands still (used by the automated hit test) |
| `?diff=easy\|normal\|hard`, `?seed=n` | CPU difficulty and the seed for random picks |

`window.__SBF__` always exposes the current scene and the full match state (`match`, `frame`, `done`, `winner`), which is how the headless check reads the game.

## How it works

The fight is a deterministic simulation, separated from rendering:

- `src/sim` is pure TypeScript with no engine imports. It runs at a fixed 60 Hz step: fighter state machine, pushboxes, hitboxes and hurtboxes authored as frame data per move (`src/data/characters.ts`), hit stop, hitstun and blockstun accounting, projectiles, special meter, rounds, timer and a seeded AI with three difficulty levels. The same inputs always give the same match.
- `src/game/runner.ts` feeds real time into that fixed step. The scenes in `src/scenes` only draw what the simulation says: the stage is a wide image scrolled by a camera that follows the midpoint of the fighters, fighters are drawn from their sprite frames with a small tween layer (squash and stretch, bob, hit flash) and a shadow, and the HUD is built from engine shapes and text.
- The canvas is 1300 x 700, exactly the 13:7 ratio of the stage art, and the page scales it to fit the window.

## Project structure

```
src/
├── data/
│   ├── characters.ts      fighters and per-move frame data
│   └── stages.ts          the nine stages
├── sim/                   pure fighting simulation and AI (no engine imports)
├── game/                  runner, camera, fx, HUD, controls, touch pad, asset loading
├── scenes/                Boot, Title, CharacterSelect, StageSelect, Fight, Result
├── __tests__/             unit tests and asset validation
└── main.ts
public/assets/             stages (WebP), fighter atlases (PNG + JSON), sound effects (WAV)
tools/                     art pipeline, sound synth and the browser check (not shipped)
art-src/prompts.json       every prompt, model, parameter, seed and request id
docs/screenshots/          screenshots taken by the browser check
```

## Running locally

```bash
npm install
egm simulate      # dev server with the simulator
npm run build:web # plain web build in dist/ (relative base)
```

## Tests

```bash
npm test                # unit tests, data validation (atlases, stages, sounds, size budget)
npm run typecheck
npm run test:browser    # builds, serves and drives the game with Playwright
```

`npm run test:browser` opens Chromium at 1300 x 700, walks the real menus with the keyboard, takes the screenshots in `docs/screenshots`, asserts zero console errors, lets `?autoplay=cpu` play a full match to the end and checks that a keyboard punch from P1 hurts a standing P2. Playwright is not a dependency of this example: the script looks for it in `PLAYWRIGHT_DIR`, then `EGM_SDK_DIR/node_modules`, then in a sibling `easy-game-maker` checkout.

## How the art was made

The stage backgrounds and the fighter sprite sheets were generated with **Nano Banana Pro** (Google's image model) through [fal.ai](https://fal.ai), then processed by scripts in `tools/`.

| Item | Value (checked on the official fal docs on 2026-10-03) |
|---|---|
| Text to image | `fal-ai/nano-banana-pro` |
| Edit (reference images) | `fal-ai/nano-banana-pro/edit`, takes `image_urls` |
| Inputs used | `prompt`, `num_images: 1`, `aspect_ratio`, `resolution`, `output_format: png`, `seed` |
| Aspect ratios offered | auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16 |
| Resolutions offered | 1K, 2K, 4K |
| Output | `{ images: [{ url, file_name, content_type, ... }], description }` |
| Price | 0.15 USD per image at 1K and 2K, double (0.30 USD) at 4K. fal notes that prices may change |

- **Stages**: the prompt is the project owner's template, `Cartoon rendering of a battle stage, Fortnite concept art style, cartoon game graphics , Cartoon design style of a [location]. High contrast.`, followed by a precision suffix (wide cinematic composition, open ground strip in the lower third, no characters, no text, no logos). 13:7 is not a standard ratio, so the images are requested at 16:9 and 2K, centre-cropped to exactly 13:7 and resized to 2600 x 1400 (twice the game resolution, so the camera can scroll and the picture stays sharp), saved as WebP with a 650 x 350 thumbnail.
- **Sprites**: each fighter has two 3x3 sheets with a fixed pose list, always in side view facing right. Sheet A (idle, walk, jump, crouch, punch, kick, block, hit, knocked down) comes from text to image. Sheet B (punch and kick wind-ups, special charge and release, crouch block, crouch punch, jump kick, victory, projectile) comes from the edit endpoint with sheet A as the reference, to keep the character consistent.
- **Processing** (`tools/process-sprites.mjs`): background removal by flood fill from the border plus soft edge matting that un-mixes the white (no halo), frames located by their content (not by a fixed grid) with detached effects kept in the frame, scale normalised by the idle body height, a feet anchor per frame (tunable in `tools/characters.json`) and one packed atlas per fighter.
- **Sound**: `tools/make-sfx.mjs` synthesizes the effects in plain JavaScript. The WAV files are committed.

`art-src/prompts.json` records every prompt, model id, parameters, seed, request id and date. Raw outputs are kept locally in `art-src/raw` (not committed).

**Spend and budget.** 30 images were first generated and 4 were regenerated (Saci sheets A and B twice, Craque sheets A and B once), 34 images in total: 34 x 0.15 = 5.10 USD requested... see the ledger note below.

### Regenerating the art

```bash
npm install
export FAL_KEY=...                      # never commit it, never print it
export FAL_BUDGET_USD=15                # the guard refuses jobs that would pass this total
node tools/generate-stages.mjs --dry-run         # prompts, params and estimated cost, spends nothing
node tools/generate-stages.mjs --only copacabana # one stage
node tools/generate-sprites.mjs --only tiao      # both sheets of one fighter
node tools/process-stages.mjs && node tools/process-sprites.mjs
node tools/qa.mjs                                # contact sheets in art-src/qa and a pass/fail table
```

Flags: `--dry-run`, `--only <id,id>`, `--force` (regenerate with a new seed), `--seed <n>`, `--style-ref <image>` (stages only: passes a style reference through the edit endpoint). A persistent ledger (`tools/.cache/ledger.json`) and a content cache keyed by model, prompt and parameters make sure a re-run never pays twice. The key is read from the environment only and is never written to a file or a log.

### Legal note

Images generated by Google's Nano Banana Pro carry an invisible **SynthID** watermark. Before using this art commercially, check the current terms of fal.ai and of Google for generated content.

## Credits

Game design, code and tools: Easy Game Maker team. Art: generated with Nano Banana Pro through fal.ai and post-processed by the scripts in `tools/`. Sound effects: synthesized by `tools/make-sfx.mjs`.
