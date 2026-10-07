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
| Mute or unmute all sound | `M` | | |

On a touch screen (or with `?touch=1` in the address) P1 gets an on-screen d-pad and four buttons.

- Best of three rounds, 99 second timer. When time runs out the fighter with more health wins the round. A drawn round plays again (never more than five rounds).
- Health bars, a special meter (gained by hitting and being hit, 50 per special) and round banners: `ROUND 1`, `FIGHT!`, `KO!`, `TIME!`, `YOU WIN`.
- Normal moves: light punch, heavy kick, crouching punch (`down` + punch), low sweep (`down` + kick) and a jump kick (punch or kick in the air).
- Holding back blocks standing, holding down and back (or crouching with block) blocks low. Low sweeps and ground waves must be blocked crouching.
- Specials chip a little damage through a block. Combos lose damage with every hit (simple combo scaling).
- Press `Start` or `Esc` to pause: resume, restart, open the audio settings or leave the match.
- Sound: a Brazilian instrumental soundtrack (title, select, two fight tracks chosen by stage, victory and defeat jingles), an announcer that calls the round banners, sound effects for every hit, block, special and KO, and a voice for every fighter. Master, music and effects volumes and a mute switch live in `AUDIO SETTINGS` (title screen and pause menu) and are remembered in the browser. See the audio section below.

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
- Spacing (round 3 polish, all in the pure sim, with unit tests): grounded fighters stay at least 135 px apart (`PUSHBOX_WIDTH`, 70 px at first, 100 px after round 2), resolved every frame. The overlap is taken back by whoever walked, dashed or slid into the other one (`pushShare` in `src/sim/spacing.ts`), in proportion to how far each travelled towards the other; with both still it is split evenly and against a wall the other fighter takes all of it. A standing fighter is therefore no longer shoved along by a walker (this changed one test on purpose). Hits and blocks push the defender back, and the attacker too when the defender is against the wall or blocks a heavy move. Jumps may cross over (airborne fighters have no pushbox). The leaning hit, block and knocked down frames are drawn shifted backwards by `post.defaults.frames` offsets in `tools/characters.json` so they do not cover the opponent's head. A knocked down fighter at the wall is drawn nudged back into view, and the hit flash is a light red tint.
- Audio (`src/audio`, game layer only, the sim has no audio imports): `catalog.ts` lists the 62 sounds, `mapping.ts` turns every sim event into sound cues (a typed table says whether each event type makes a sound or is explicitly silent), `musicMixer.ts` is a pure crossfade and ducking state machine, `settings.ts` persists the volumes in `localStorage` (every access in try and catch) and `director.ts` plays all of it on three engine channels (music, sfx, voice). Music starts only after the first key or click (browser autoplay policy), crossfades between scenes, ducks while the announcer speaks, goes silent while paused or while the tab is hidden, and a file that fails to load is simply silent and listed in `window.__SBF__.audio.failed`.
- The canvas is 1300 x 700, exactly the 13:7 ratio of the stage art, and the page scales it to fit the window.

## Project structure

```
src/
├── data/
│   ├── characters.ts      fighters and per-move frame data
│   └── stages.ts          the nine stages
├── sim/                   pure fighting simulation and AI (no engine imports)
├── game/                  runner, camera, fx, HUD, controls, touch pad, audio menu, asset loading
├── audio/                 sound catalog, event to sound mapping, music mixer, settings, director
├── scenes/                Boot, Title, CharacterSelect, StageSelect, Fight, Result
├── __tests__/             unit tests and asset validation
└── main.ts
public/assets/             stages (WebP), fighter atlases (key poses and animation frames, PNG + JSON), music, announcer and sound effects (mp3)
tools/                     art and audio pipelines, consistency report, overlap analysis and the browser checks (not shipped)
art-src/prompts.json       every image prompt, model, parameter, seed and request id
art-src/audio-prompts.json every audio prompt, endpoint, model, voice id, parameter, date and estimated credits
art-src/atlas-base/        the atlases as process-sprites.mjs writes them, before tools/post-atlas.mjs (colour match, scale, offsets)
docs/audio-report.md       duration, peak, loudness and loop seam of every audio file (Portuguese)
docs/consistency/          before and after contact strips of the six fighters
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
npm test                # 258 unit tests: sim (spacing rules included), AI, animation clips, audio (settings, event mapping, mixer, director), data validation (atlases, post-processing settings, stages, sounds, size budget)
npm run typecheck
npm run test:browser    # builds, serves and drives the game with Playwright
node tools/playtest.mjs # scripted play-through with filmstrips and audio checks (see below)
npx vite-node tools/overlap.mts   # sprite overlap measured on the real sim and atlases
node tools/consistency.mjs        # frame consistency report
```

`npm run test:browser` opens Chromium at 1300 x 700, walks the real menus with the keyboard, takes the screenshots in `docs/screenshots`, asserts zero console errors, lets `?autoplay=cpu` play a full match to the end and checks that a keyboard punch from P1 hurts a standing P2. Playwright is not a dependency of this example: the script looks for it in `PLAYWRIGHT_DIR`, then `EGM_SDK_DIR/node_modules`, then in a sibling `easy-game-maker` checkout.

### Play-through with filmstrips

`node tools/playtest.mjs [--no-build] [--suite menus,fighters,ko,chaos,cpu,autoplay] [--only tiao,saci]` drives the built game with real keyboard events, like a person: the menus to a 1P fight and the pause screen (`menus`), then for each fighter walking forward and back, jump, crouch, block, light punch, heavy kick, a hit on a dummy and the special (`fighters`), a KO route through the round banners to the result screen (`ko`), a scripted random player against a hard CPU (`chaos`), two CPU matches with periodic screenshots (`cpu`) and every pair of fighters (21 pairs) playing a full match with a watchdog for stuck states (`autoplay`). Actions are filmed in slow motion (`window.__SBF__.speed = 0.1`) and the frames are sampled about every two simulation steps into one labelled contact sheet per action, with the atlas frame name and the sim frame on every tile. Output goes to `art-src/playtest` (not committed); `docs/playtest` holds a curated subset converted to WebP: the roster grid, filmstrips of Tiao (kick), Dalva (walk), Rosa (special) and Curupira (walk with the footprints), a hit moment, a special moment, the KO banner and the result screen. All 21 pairs of fighters played a full match without a stuck state (round 3 run: 21 of 21).

Round 3 added two suites. `overlap` films close range punches, kicks, specials and jump-ins for three pair types (`docs/playtest/overlap-*.webp`). `audio` drives the real game with `window.__SBF__.audio` instrumentation (autoplay allowed, headless cannot be heard): silence before the first key, every file loaded, title and select themes with crossfade, name reading, fight track by stage, round and FIGHT banner voices, attack, jump, hit, KO and result lines, ducking, pause, hidden tab, mute and volume menu, persistence after a reload and a missing file. 27 checks pass and the run has zero console errors; the log of a KO route is in `docs/playtest/audio-log.json`. The menus read key edges once per frame, so the scripts hold keys for a few rendered frames.

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
- **Processing** (`tools/process-sprites.mjs`): background removal by flood fill from the border plus soft edge matting that un-mixes the white (no halo), frames located by their content (not by a fixed grid) with detached effects kept in the frame, scale normalised by the idle body height, a feet anchor per frame (tunable in `tools/characters.json`) and one packed key pose atlas per fighter and, from sheets C and D, an animation atlas (`<id>-anim.png` and `.json`) normalised on its own reference frame (the neutral idle for sheet C, the punch recovery for sheet D). A missing raw sheet leaves the committed atlas untouched, so the animation sheets can be reprocessed without the key pose sheets. `process-sprites.mjs` writes the **base** atlases to `art-src/atlas-base`.
- **Post-processing, round 3** (`tools/post-atlas.mjs`, no image model): base atlases in, shipped atlases (`public/assets/fighters`) out, driven by `post` in `tools/characters.json`. It matches the colour of every frame to the fighter's `idle_0` (the palette of `idle_0` is clustered in CIE Lab, skin is a hue mask, and every region of a frame is moved towards the reference mean with a strength of 0.8, protecting outlines, white clothing and highlights), scales single frames about their feet (`scale`), reuses a good frame for a bad one (`copyOf`) and shifts the draw anchor of the hit, block and knocked down frames backwards (`dx`) so they do not cover the opponent. It is idempotent: the base atlas is never modified.

`art-src/prompts.json` records every prompt, model id, parameters, seed, request id and date. Raw outputs are kept locally in `art-src/raw` (not committed).

**Spend and budget.** Round 1 (stages, key pose sheets A and B, the regenerations): 27 images, 4.05 USD. Round 2 (this polish): 21 images, 3.15 USD, made of 6 rejected redesign attempts (Saci and Curupira, 0.90 USD) and 15 animation sheets (12 sheets plus 3 regenerations, 2.25 USD): Tiao sheet C twice (the first walk cycle swung its arms), Dalva sheet C three times (the machete vanished in the walk and idle frames). Round 3 (consistency polish) spent **0.00 USD** on images: the price was re-checked on 2026-10-05 (0.15 USD per image at 1K and 2K, 0.30 USD at 4K, same as before) and a 5 USD budget was set, but post-processing (colour match, per-frame scale, reusing a good frame for a bad one) fixed the frames it could and nothing was regenerated. Total of the whole project: **7.20 USD**, 48 images at 0.15 USD each. Round 2 ran with a 9 USD guard.

### Round 3 results

**Frame consistency** (`node tools/consistency.mjs`, summary by `tools/consistency-summary.mjs`, strips in `docs/consistency/<id>-before.webp` and `-after.webp`). For every frame it measures body height, head width, skin colour and the colour of the main palette regions in CIE Lab against the fighter's animated `idle_0`. Skin difference (mean, then worst frame) before and after: Tiao 3.0 to 1.5 (worst 12.5 to 4.3), Saci worst 6.8 to 2.7, Curupira colour worst 10.0 to 3.4, Craque worst 9.1 to 3.3, Rosa colour worst 11.9 to 4.4, Dalva about the same (worst skin 4.9 to 5.0, colour 17.5 to 15.7). Fixes: Tiao `kick_2`, `special_2` and `idle_2` (the lighter, wider, older drawing the owner saw) reuse `idle_0` or `idle_1`; Craque `kick_2` and Curupira `special_2` the same; Saci `walk_3`, `walk_5` and `kick_0` and Dalva `special_2` and `kick_0` scaled down 5 to 10 percent; every other frame colour matched. **Not fixed:** Dalva `special_2` is still a bit taller and its face slightly different, Craque `special_2` and Rosa `special_0` (aura) are still slightly off-model, Curupira's `idle_0` (the reference) has an odd face with an arm over the mouth, walk cycles are not perfect and some frames are still aliases. The metrics are noisy proxies (torso width and head width are not reliable for crouched or leaning poses), so the strips were also checked by eye. No image was regenerated: the 5 USD cap was not needed.

**Hit overlap.** `npx vite-node tools/overlap.mts` rasterises both drawn sprites on 8 px cells for 216 scripted runs (punch, kick, sweep, special, jump-in, in the open and with the defender in the corner, standing or blocking). Mean overlap of grounded fighters fell from 8.5 percent (separation 100 px) to 3.4 percent; the worst punch case at the hit moment fell from 41 to 24 percent (what is left is walking sprites touching, not hits) and blocked punches from 42 to 10 percent. In the owner's case (Dalva against Saci) the hit pose now leans back clear of Dalva's arm. Left as is: jump crossings (up to about 80 percent while a jumper passes through the other fighter, as in most fighting games, and the pushbox resolves it on landing) and the big effect frames of Tiao's dash and Saci's whirlwind special (up to about 50 percent). With 135 px as the minimum separation every move can still reach a standing opponent at that distance (checked on all six fighters).

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

## How the audio was made

All sound comes from **ElevenLabs** through `tools/generate-audio.mjs` (jobs in `tools/audio-jobs.mjs`, client in `tools/lib/eleven.mjs`), then `tools/process-audio.mjs` (ffmpeg) trims, normalises and encodes it. 62 files, 3.9 MB, all mp3 (mono 80 kbps for effects and voices, stereo 96 kbps for music; every browser that runs the game plays mp3, and the headless Chromium check decodes every file).

| Part | Endpoint and model (checked in the official docs on 2026-10-05) | Files |
|---|---|---|
| Sound effects | `POST /v1/sound-generation`, `eleven_text_to_sound_v2`, `duration_seconds` 0.5 to 1.5, `prompt_influence` 0.5 to 0.7 | 21: two punches, two kicks, two hits, block, one special per fighter (dash spin, slash wave, whirlwind, ground stomp, fireball kick, feather burst), jump, land, knockdown, KO impact, round gong, UI move, UI select, pause |
| Fighter voices | same endpoint, short prompts with no words | 18: attack shout, hurt grunt and KO cry for each of the six fighters |
| Announcer | `POST /v1/text-to-speech/{voice_id}`, `eleven_multilingual_v2`, stability 0.3, similarity 0.8, style 0.7, speaker boost | 17: Round one, Round two, Final round, Fight, K.O., Time, Perfect, Player one wins, Player two wins, You win, You lose and the six fighter names read on the select screen |
| Music | `POST /v1/music`, `music_v2_5`, `force_instrumental: true`, `music_length_ms` | 6: title theme (72 s), select theme (59 s), two fight tracks (80 s and 78 s), victory jingle (12 s) and defeat sting (9 s) |

- **Music API on this plan.** The Music API works on the Starter plan (a 10 second test and then the six tracks). No prompt names an artist, a song or a lyric, every prompt says instrumental with no vocals and gives a tempo, and the lengths of the loops are whole bars at that tempo (30 bars at 100 BPM, 22 at 90, 40 at 120, 42 at 130) so a loop point lands on a downbeat. The fight tracks are mapped to the nine stages in `src/audio/catalog.ts`.
- **Loops.** The loop file is the middle of the track followed by the tail crossfaded (2.5 s, constant power) into the head, so the end flows into the sample after the head. `docs/audio-report.md` compares the first and last 50 ms of every loop. This proves level continuity and no click, not that the rhythm lines up: that needs listening. The mp3 encoder leaves about 5 ms of low level at the start of each file, so a loop has a 5 ms dip at every wrap; an Ogg Opus version would avoid it but Safari support is recent, so mp3 stayed.
- **Loudness.** Effects and the announcer at about -16 LUFS (Loudness Units relative to Full Scale), music at about -20 LUFS so it sits under them, sample peak limited to -1.5 dBFS and true peak under -1 dBTP in every file (`docs/audio-report.md`).
- **The announcer voice.** The API key of this account has no `voices_read` permission, so the voice list could not be fetched. Seven premade voices (Adam, Josh, Arnold, Clyde, Brian, Harry, Callum) were tried on "Round one. Fight!" and compared by pace and loudness (Arnold and Adam were the fastest, Arnold the loudest). **Arnold** (`VR6AewLTigWG4xSOukaG`) was kept. This was a measured guess, not a listening test.
- **Cost.** The account counter went from 39,539 to 44,068 credits used (of 90,000 for the cycle): **4,529 credits** for the whole round, including a smoke test of 255 credits and 140 credits of voice trials, against a 20,000 credit cap. A sound effect costs about 10 credits per second, music about 12.5 credits per second, speech about one credit per character. The counter lags the calls by several seconds, so the ledger (`tools/.cache/eleven/ledger.json`, not committed) keeps the estimates and `reconcile()` reads the real total once it settles. `art-src/audio-prompts.json` lists every request.

### Regenerating the audio

```bash
export ELEVENLABS_API_KEY=...             # never commit it, never print it
export ELEVEN_BUDGET_CREDITS=20000        # the guard refuses calls that would pass this total
node tools/generate-audio.mjs --dry-run              # every job with its estimated credits, spends nothing
node tools/generate-audio.mjs --only punch,ann_fight # specific jobs
node tools/generate-audio.mjs --kind music           # sfx, tts or music
node tools/process-audio.mjs                         # needs ffmpeg and ffprobe; rewrites public/assets/audio, the report and durations.ts
```

A content cache keyed by endpoint, parameters and text (in `tools/.cache/eleven`, not committed) means an unchanged job never pays twice. Raw outputs go to `art-src/audio-raw` (not committed). The whole set costs about 4,400 credits (4,100 for the music).

### Legal note

Images generated by Google's Nano Banana Pro carry an invisible **SynthID** watermark. Before using this art commercially, check the current terms of fal.ai and of Google for generated content.

**Audio licensing, honestly.** The audio was generated on the ElevenLabs **Starter** plan. Read on 2026-10-05: the Eleven Music model terms say Starter allows "all online and offline commercial use except film, TV, radio and Studio Games" (a Studio Game is a commercialised game available on more than one platform) and no attribution; the public API pricing page, on the other hand, lists the commercial license from the Creator plan up. Those two pages do not agree, and the terms of voices and sound effects were not separately confirmed. This example is a free, open demo. Before selling a game that ships this audio, confirm the terms for your plan with ElevenLabs in writing (or regenerate the files on a plan that clearly includes commercial use). Generated audio can also resemble existing works by accident, and nobody has listened to all of it with a lawyer's ears: **review the audio by ear before any commercial use**.

## Credits

Game design, code and tools: Easy Game Maker team. Art: generated with Nano Banana Pro through fal.ai and post-processed by the scripts in `tools/`. Music, announcer, voices and sound effects: generated with ElevenLabs and processed by `tools/process-audio.mjs`.
