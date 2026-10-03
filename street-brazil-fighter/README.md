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
| Saci | Prankster of Brazilian folklore, red cap and pipe: small and mobile | Redemoinho, a mini whirlwind projectile |
| Curupira | Forest guardian with flaming hair: slow, heavy, strong | Pisao da Mata, a ground shockwave |
| Craque da Varzea | Street football player: balanced | Bola de Fogo, a fireball soccer kick |
| Passista Rosa | Carnival samba dancer: agile | Chuva de Plumas, a spinning feather burst |

**Honest notes on two fighters.** In the folklore the Saci has a single leg and the Curupira has feet turned backwards. The image model could not draw either: we tried the text to image prompt (twice) and then the edit endpoint with explicit instructions (three attempts per sheet, two regenerations each, 0.90 USD in total) and the Saci always came back with two legs and the Curupira with normal feet. After the allowed attempts the original sheets stay in the game and the two traits are not in the art. The Curupira keeps the folklore in play instead: while he walks he leaves glowing footprints that point the opposite way, and the select screen says so. The attempts are recorded in `art-src/prompts.json` (ids `redo-saci-a` and `redo-curupira-a`, marked as rejected).

On screen, every fighter is drawn at the same base body height, within 8 percent. Craque da Varzea is the exception by design: his sprite is drawn at 92 percent (`visualScale` in `src/data/characters.ts`) and his hurtboxes are smaller to match, because he is the bulkiest.

### Stages

Pelourinho (Salvador), Copacabana (Rio de Janeiro), Amazon River, Avenida Paulista (Sao Paulo), Sambodromo (Rio de Janeiro), Pantanal, Lencois Maranhenses, Cristo Redentor overlook (Rio de Janeiro) and Ouro Preto.

## Debug and automation switches

| Address | Effect |
|---|---|
| `?hitboxes=1` | Draws hurtboxes (green) and hitboxes (red) |
| `?autoplay=cpu` | CPU against CPU, starting straight in a fight |
| `?speed=8` | Runs 8 simulation steps per rendered frame (1 to 16); `?speed=0.1` is slow motion down to 0.1 (also settable at run time through `window.__SBF__.speed`) |
| `?meter=1` | Both fighters start with a full special meter |
| `?quick=1&p1=tiao&p2=rosa&stage=pantanal` | Skips the menus |
| `?p2mode=dummy` | P2 stands still (used by the automated hit test) |
| `?diff=easy\|normal\|hard`, `?seed=n` | CPU difficulty and the seed for random picks |

`window.__SBF__` always exposes the current scene and the full match state (`match`, `frame`, `done`, `winner`), which is how the headless check reads the game.

## How it works

The fight is a deterministic simulation, separated from rendering:

- `src/sim` is pure TypeScript with no engine imports. It runs at a fixed 60 Hz step: fighter state machine, pushboxes, hitboxes and hurtboxes authored as frame data per move (`src/data/characters.ts`), hit stop, hitstun and blockstun accounting, projectiles, special meter, rounds, timer and a seeded AI with three difficulty levels. The same inputs always give the same match.
- `src/game/animation.ts` is the animation system, also pure: a clip is a list of atlas frames with a duration in simulation steps for each, and the selector picks the clip and the frame from state the sim already keeps (`state`, `stateFrame`, `moveFrame`). Idle breathes at 6 frames per second, walking plays a six frame cycle at 12 frames per second (backwards walks play it in reverse), and the light punch, heavy kick and special are three frame clips whose durations are the move's own startup, active and recovery counts, so the extended pose shows exactly during the active frames (the heavy kick also pulls the leg back through the chamber frame during its recovery). Jump, crouch, block, hit and knock down keep the key poses, which is also the fallback when an animation atlas is missing. The old tween layer (squash and stretch, hit flash) stays on top. The sim never reads any of this.
- `src/game/runner.ts` feeds real time into that fixed step. The scenes in `src/scenes` only draw what the simulation says: the stage is a wide image scrolled by a camera that follows the midpoint of the fighters, fighters are drawn from their sprite frames with a small tween layer (squash and stretch, bob, hit flash) and a shadow, and the HUD is built from engine shapes and text.
- Two fighters can stand no closer than 100 px (the pushbox width, 70 px before the polish round), so their sprites no longer overlap like a hug. A knocked down fighter at the wall is drawn nudged back into view, and the hit flash is a light red tint.
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
public/assets/             stages (WebP), fighter atlases (key poses and animation frames, PNG + JSON), sound effects (WAV)
tools/                     art pipeline, sound synth and the browser check (not shipped)
art-src/prompts.json       every prompt, model, parameter, seed and request id
docs/screenshots/          screenshots taken by the browser check
docs/playtest/             curated stills and filmstrips from the scripted play-through (tools/playtest.mjs)
```

## Running locally

```bash
npm install
egm simulate      # dev server with the simulator
npm run build:web # plain web build in dist/ (relative base)
```

## Tests

```bash
npm test                # 210 unit tests: sim, AI, animation clips (sync with every fighter's move data), data validation (atlases, animation atlases, stages, sounds, size budget)
npm run typecheck
npm run test:browser    # builds, serves and drives the game with Playwright
node tools/playtest.mjs # scripted play-through with filmstrips (see below)
```

`npm run test:browser` opens Chromium at 1300 x 700, walks the real menus with the keyboard, takes the screenshots in `docs/screenshots`, asserts zero console errors, lets `?autoplay=cpu` play a full match to the end and checks that a keyboard punch from P1 hurts a standing P2. Playwright is not a dependency of this example: the script looks for it in `PLAYWRIGHT_DIR`, then `EGM_SDK_DIR/node_modules`, then in a sibling `easy-game-maker` checkout.

### Play-through with filmstrips

`node tools/playtest.mjs [--no-build] [--suite menus,fighters,ko,chaos,cpu,autoplay] [--only tiao,saci]` drives the built game with real keyboard events, like a person: the menus to a 1P fight and the pause screen (`menus`), then for each fighter walking forward and back, jump, crouch, block, light punch, heavy kick, a hit on a dummy and the special (`fighters`), a KO route through the round banners to the result screen (`ko`), a scripted random player against a hard CPU (`chaos`), two CPU matches with periodic screenshots (`cpu`) and every pair of fighters (21 pairs) playing a full match with a watchdog for stuck states (`autoplay`). Actions are filmed in slow motion (`window.__SBF__.speed = 0.1`) and the frames are sampled about every two simulation steps into one labelled contact sheet per action, with the atlas frame name and the sim frame on every tile. Output goes to `art-src/playtest` (not committed); `docs/playtest` holds a curated subset converted to WebP: the roster grid, filmstrips of Tiao (kick), Dalva (walk), Rosa (special) and Curupira (walk with the footprints), a hit moment, a special moment, the KO banner and the result screen. All 21 pairs of fighters played a full match without a stuck state.

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
- **Sprites**: each fighter has two 3x3 key pose sheets with a fixed pose list, always in side view facing right. Sheet A (idle, walk, jump, crouch, punch, kick, block, hit, knocked down) comes from text to image. Sheet B (punch and kick wind-ups, special charge and release, crouch block, crouch punch, jump kick, victory, projectile) comes from the edit endpoint with sheet A as the reference, to keep the character consistent.
- **Animation sheets**: two more 3x3 sheets per fighter, both from the edit endpoint with the fighter's own key poses as the reference (`tools/lib/refsheet.mjs` rebuilds that reference from the committed atlas, because the raw sheets are not kept). Sheet C is a six frame walk cycle plus three idle breathing frames; sheet D is the light punch, the heavy kick and the special in three frames each (wind-up or chamber, extended hit frame, recovery or follow-through). `tools/generate-edit.mjs` runs one job at a time (`--job anim-tiao-c`) and always supports `--dry-run`. Frames the model drew off-model are fixed in `tools/characters.json` (a per-frame `scale`, or `copyOf` to reuse another frame): Tiao walk_5, Saci walk_4, Curupira walk_5 and Dalva idle_2 are copies, and the special frame of Dalva and Craque is scaled up.
- **Processing** (`tools/process-sprites.mjs`): background removal by flood fill from the border plus soft edge matting that un-mixes the white (no halo), frames located by their content (not by a fixed grid) with detached effects kept in the frame, scale normalised by the idle body height, a feet anchor per frame (tunable in `tools/characters.json`) and one packed key pose atlas per fighter and, from sheets C and D, an animation atlas (`<id>-anim.png` and `.json`) normalised on its own reference frame (the neutral idle for sheet C, the punch recovery for sheet D). A missing raw sheet leaves the committed atlas untouched, so the animation sheets can be reprocessed without the key pose sheets.
- **Sound**: `tools/make-sfx.mjs` synthesizes the effects in plain JavaScript. The WAV files are committed.

`art-src/prompts.json` records every prompt, model id, parameters, seed, request id and date. Raw outputs are kept locally in `art-src/raw` (not committed).

**Spend and budget.** Round 1 (stages, key pose sheets A and B, the regenerations): 27 images, 4.05 USD. Round 2 (this polish): 21 images, 3.15 USD, made of 6 rejected redesign attempts (Saci and Curupira, 0.90 USD) and 15 animation sheets (12 sheets plus 3 regenerations, 2.25 USD): Tiao sheet C twice (the first walk cycle swung its arms), Dalva sheet C three times (the machete vanished in the walk and idle frames). Total of the whole project: **7.20 USD**, 48 images at 0.15 USD each. Round 2 ran with a 9 USD guard.

### Regenerating the art

```bash
npm install
export FAL_KEY=...                      # never commit it, never print it
export FAL_BUDGET_USD=15                # the guard refuses jobs that would pass this total
node tools/generate-stages.mjs --dry-run         # prompts, params and estimated cost, spends nothing
node tools/generate-stages.mjs --only copacabana # one stage
node tools/generate-sprites.mjs --only tiao      # both key pose sheets of one fighter
node tools/generate-edit.mjs --job anim-tiao-c --dry-run   # animation sheets: one job at a time
node tools/generate-edit.mjs --job anim-tiao-c
node tools/process-stages.mjs && node tools/process-sprites.mjs
node tools/qa.mjs                                # contact sheets in art-src/qa and a pass/fail table
```

Flags: `--dry-run`, `--only <id,id>`, `--force` (regenerate with a new seed), `--seed <n>`, `--style-ref <image>` (stages only: passes a style reference through the edit endpoint). A persistent ledger (`tools/.cache/ledger.json`) and a content cache keyed by model, prompt and parameters make sure a re-run never pays twice. The key is read from the environment only and is never written to a file or a log.

### Legal note

Images generated by Google's Nano Banana Pro carry an invisible **SynthID** watermark. Before using this art commercially, check the current terms of fal.ai and of Google for generated content.

## Credits

Game design, code and tools: Easy Game Maker team. Art: generated with Nano Banana Pro through fal.ai and post-processed by the scripts in `tools/`. Sound effects: synthesized by `tools/make-sfx.mjs`.
