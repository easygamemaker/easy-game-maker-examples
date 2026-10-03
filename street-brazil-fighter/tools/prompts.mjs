// All prompts for the art pipeline. The templates are the project owner's, verbatim, except for
// the documented adjustments (Midjourney-only flags dropped, precision suffix, fighting-game pose list).

export const STAGE_BASE = (location) =>
  `Cartoon rendering of a battle stage, Fortnite concept art style, cartoon game graphics , Cartoon design style of a ${location}. High contrast.`;

export const STAGE_PRECISION =
  ' Vibrant saturated stylized 3D-cartoon environment concept art with crisp painterly shapes, strong rim light and clouds, wide cinematic composition, camera at fighter eye level with a slight low angle, a clear open flat walkable ground strip across the lower third where two fighters will stand, the interesting landmarks framed on the left and right edges and in the background, NO characters, NO people in the foreground, NO text, NO logos, NO UI, NO watermark.';

export const STAGES = [
  { id: 'pelourinho', name: 'Pelourinho', location: 'colorful colonial cobblestone street in Pelourinho, Salvador, Brazil' },
  { id: 'copacabana', name: 'Copacabana', location: 'Copacabana beach promenade in Rio de Janeiro at sunset, with the wave-pattern pavement' },
  { id: 'amazonia', name: 'Amazon River', location: 'Amazon rainforest river clearing with giant trees, vines and water lilies' },
  { id: 'paulista', name: 'Avenida Paulista', location: 'graffiti alley near Avenida Paulista in Sao Paulo, Brazil, with colorful murals and skyscrapers behind' },
  { id: 'sambodromo', name: 'Sambodromo', location: 'Sambodromo carnival avenue at night with floats, lights, confetti and streamers' },
  { id: 'pantanal', name: 'Pantanal', location: 'Pantanal wetland wooden boardwalk with water, jabiru storks and capybaras in the distance' },
  { id: 'lencois', name: 'Lencois Maranhenses', location: 'Lencois Maranhenses white sand dunes with turquoise rainwater lagoons' },
  { id: 'corcovado', name: 'Cristo Redentor', location: 'Christ the Redeemer overlook in Rio de Janeiro with Sugarloaf mountain and Guanabara Bay below' },
  { id: 'ouropreto', name: 'Ouro Preto', location: 'baroque hillside colonial town of Ouro Preto, Minas Gerais, with stone streets and white churches' },
];

export const stagePrompt = (stage) => STAGE_BASE(stage.location) + STAGE_PRECISION;

const SHEET_HEAD = 'Create a square 1:1 character sprite sheet on a plain flat white background showing nine frames of a single consistent ';
const SHEET_MID = ' arranged in a tidy 3x3 grid, in a clean flat 2D game-art style. Show the same character in ';
const SHEET_TAIL = ', keeping the design, proportions, and palette identical across all frames. Every item sits in clean white negative space, fully separated, never overlapping, never touching, never bleeding off the canvas edge. Give each item a sharp, solid outer cut edge. No drop shadow, no halo, no glow, no soft fade or blur outside the cut line. Anti-aliasing inside each item is fine; outside the cut line it is not. Even frame sizing, high-resolution, ready to import.';

export const POSES_A = ['idle', 'walk', 'jump', 'crouch', 'punch', 'kick', 'block', 'hit', 'down'];
export const POSES_B = ['punch_windup', 'kick_windup', 'special_charge', 'special_release', 'crouch_block', 'crouch_punch', 'jump_kick', 'victory', 'fx'];

const LIST_A = 'these nine poses in this exact order, left to right then top to bottom: 1 idle fighting stance, 2 walk forward, 3 jump up, 4 crouch, 5 light punch (arm fully extended), 6 heavy kick (leg fully extended), 7 standing block (arms guarding), 8 getting hit (recoiling), 9 knocked down lying on the ground; all frames in strict side view facing RIGHT, full body visible, same scale, feet on the same imaginary ground line within each row';
const LIST_B = 'these nine poses in this exact order, left to right then top to bottom: 1 punch wind-up (arm pulled back), 2 kick wind-up (leg raised and bent), 3 special move charge, 4 special move release (attack at its full extension), 5 crouch block, 6 crouch punch, 7 jump kick (in the air), 8 victory pose, 9 the special move projectile or energy effect shown alone without the character; all character frames in strict side view facing RIGHT, full body visible, same scale, feet on the same imaginary ground line within each row';

export const sheetPromptA = (desc) => SHEET_HEAD + desc + SHEET_MID + LIST_A + SHEET_TAIL;
export const sheetPromptB = (desc, special) =>
  'Using the attached character sheet as the exact design reference (identical character, proportions, outfit and palette). ' +
  SHEET_HEAD + desc + SHEET_MID + LIST_B.replace('the special move projectile or energy effect', `the special move projectile or energy effect (${special})`) + SHEET_TAIL;

export const CHARACTERS = [
  {
    id: 'tiao', name: 'Mestre Tiao',
    desc: 'Brazilian capoeira master named Mestre Tiao: athletic dark-skinned man with short braids, bare chest, barefoot, wearing white abada capoeira pants with a green and yellow cord belt, cartoon fighting-game character, big expressive head, chunky heroic proportions',
    special: 'a green and yellow spinning half-moon kick swoosh arc',
  },
  {
    id: 'dalva', name: 'Cangaceira Dalva',
    desc: 'Brazilian cangaceira warrior woman named Dalva: leather hat with a turned-up brim, brown leather vest, crossed bandolier of bullets, small machete in hand, sandals, northeastern sertao outfit, cartoon fighting-game character, big expressive head, chunky heroic proportions',
    special: 'a curved crescent slash wave of white and orange energy',
  },
  {
    id: 'saci', name: 'Saci',
    desc: 'Brazilian folklore Saci Perere: a mischievous dark-skinned boy with exactly ONE leg. Below his hips there is a single leg ending in a single bare foot, he hops on that one foot, and a second leg is never drawn anywhere (the other side of his hips is simply empty, like a one-legged pirate). He wears a red cap, smokes a small pipe, has a bare chest and RED shorts in every frame, smooth clean vector cartoon fighting-game character (not pixel art), no ground shadow and no floor ellipse, big expressive head, chunky proportions',
    special: 'a small spinning red-and-gray whirlwind tornado',
  },
  {
    id: 'curupira', name: 'Curupira',
    desc: 'Brazilian folklore Curupira forest guardian: a strong stocky figure with flaming red hair that burns like fire, feet turned BACKWARDS (heels pointing forward), green and brown leaf and bark clothing, cartoon fighting-game character, big expressive head, heavy brawler build',
    special: 'a low ground shockwave of brown rock and green leaves',
  },
  {
    id: 'craque', name: 'Craque da Varzea',
    desc: 'Brazilian street soccer player named Craque da Varzea: wearing a plain yellow jersey and green shorts with NO logos or numbers, socks and cleats, a soccer ball at his feet, short hair, no ground line, no floor line and no shadow under the feet, cartoon fighting-game character, big expressive head, chunky heroic proportions',
    special: 'a flaming soccer ball fireball with an orange fire trail',
  },
  {
    id: 'rosa', name: 'Passista Rosa',
    desc: 'Brazilian carnival samba dancer named Passista Rosa: a big feathered headdress in pink, blue and yellow, sparkling sequin bikini-style samba costume with a short skirt and feathers on the back, high heels, cartoon fighting-game character, big expressive head, chunky heroic proportions',
    special: 'a burst of spinning pink and blue feathers with sparkles',
  },
];

// ---- round 2: edit jobs (character redesigns and animation sheets), all run through /edit ----

/** Animation sheets copy the shipped art, so these two descriptions drop the leg and foot claims the art never delivered. */
export const ANIM_DESC = {
  dalva: 'Brazilian cangaceira warrior woman named Dalva: leather hat with a turned-up brim, brown leather vest, crossed bandolier of bullets, sandals, northeastern sertao outfit, cartoon fighting-game character, big expressive head, chunky heroic proportions; in EVERY frame her lower hand keeps holding the small machete exactly as in the reference (the machete never disappears, and she never raises that hand into a fist; in the three idle frames she stands exactly like the idle reference: machete held low in the lower hand pointing forward and down, the other fist raised, arms never crossed, machete never raised)',
  saci: 'Brazilian folklore Saci Perere: a mischievous dark-skinned boy wearing a red cap, smoking a small pipe, with a bare chest and RED shorts in every frame, smooth clean vector cartoon fighting-game character (not pixel art), no ground shadow and no floor ellipse, big expressive head, chunky proportions, drawn exactly like the reference',
  curupira: 'Brazilian folklore Curupira forest guardian: a strong stocky figure with flaming red hair that burns like fire, green and brown leaf and bark clothing, cartoon fighting-game character, big expressive head, heavy brawler build, drawn exactly like the reference',
};

export const POSES_C = ['walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'idle_0', 'idle_1', 'idle_2'];
export const POSES_D = ['punch_0', 'punch_1', 'punch_2', 'kick_0', 'kick_1', 'kick_2', 'special_0', 'special_1', 'special_2'];

const EDIT_REF = 'Using the attached character sheet as the exact design reference (identical character, proportions, outfit, colors and palette). ';

const LIST_C = 'these nine animation frames in this exact order, left to right then top to bottom: frames 1 to 6 are ONE smooth forward WALK CYCLE in a fighting-stance walk where in EVERY one of the six frames both fists stay raised in guard in front of the chest and face, exactly like the idle fighting stance, the arms never swing and never hang down, only the legs, hips and a slight body bob change: 1 contact (front foot touching the ground, back foot behind), 2 down (weight sinking, body at its lowest), 3 passing (rear leg swinging past the standing leg), 4 up (body at its highest, pushing off), 5 contact (the opposite foot forward), 6 passing (the opposite leg swinging past); frames 7 to 9 are three IDLE breathing frames in the fighting stance with a slight bob: 7 neutral, 8 slightly lowered with shoulders down, 9 slightly raised with the chest up; all frames in strict side view facing RIGHT, full body visible, same scale, feet on the same imaginary ground line within each row';
const listD = (special) => `these nine animation frames in this exact order, left to right then top to bottom: frames 1 to 3 are a LIGHT PUNCH: 1 wind-up (fist pulled back), 2 extended hit frame (arm fully extended), 3 recovery (arm coming back); frames 4 to 6 are a HEAVY KICK: 4 chamber (knee raised and bent), 5 extended hit frame (leg fully extended), 6 recovery (leg coming back down); frames 7 to 9 are the SPECIAL MOVE (${special}): 7 charge, 8 release (the attack at its full extension), 9 follow-through; draw only the character's own body in the special move frames, never a detached projectile or energy effect; all frames in strict side view facing RIGHT, full body visible, same scale, feet on the same imaginary ground line within each row`;

export const sheetPromptC = (desc) => EDIT_REF + SHEET_HEAD + desc + SHEET_MID + LIST_C + SHEET_TAIL;
export const sheetPromptD = (desc, special) =>
  EDIT_REF + 'The second attached image shows the special move poses. ' + SHEET_HEAD + desc + SHEET_MID + listD(special) + SHEET_TAIL;
export const sheetPromptDOne = (desc, special) => EDIT_REF + SHEET_HEAD + desc + SHEET_MID + listD(special) + SHEET_TAIL;

/** Saci redraw: the same nine key poses of sheet A, but with ONE leg only. */
export const SACI_ONE_LEG =
  'CRITICAL CHANGE TO EVERY FRAME: draw the character with exactly ONE LEG, like a one-legged pirate without a crutch. Count the legs: ONE. He has only a LEFT leg and one single bare foot. On the right side of his hips there is NO leg at all: his red shorts end at the hip and below the shorts on that side there is only empty white background, no stump, no peg leg, no crutch, no second foot. In the fighting poses he balances and hops on that single leg (this holds for ALL nine frames including 2 walk and 4 crouch: in the walk frame he takes a hop on his single leg, in the crouch he crouches on his single leg; in the kick pose the one leg is the kicking leg and he floats; in the knocked down pose one leg only). Keep his face, red cap, small pipe, bare chest, red shorts and palette identical. ';
export const CURUPIRA_BACK_FEET =
  'CRITICAL CHANGE TO EVERY FRAME: the character\'s FEET ARE REVERSED (Curupira of Brazilian folklore). Each foot is rotated 180 degrees: the HEEL is at the FRONT (toward the right, the direction he faces) and the TOES and toenails point BACKWARDS to the LEFT, so his footprints would point the wrong way. Like a person whose knees bend to the right while both feet point to the LEFT: the toes are on the left side of each leg, the heel on the right, in every standing frame (idle, walk, punch, kick, block, crouch). The foot shape must clearly extend backwards behind the heel, never forward. His body, face and fists still face RIGHT. Keep his flaming red hair, leaf and bark clothing and palette identical. ';

export const redoPromptA = (change, desc) =>
  EDIT_REF + change + SHEET_HEAD + desc + SHEET_MID + LIST_A + SHEET_TAIL;
export const redoPromptB = (change, desc, special) =>
  EDIT_REF + change + SHEET_HEAD + desc + SHEET_MID + LIST_B.replace('the special move projectile or energy effect', `the special move projectile or energy effect (${special})`) + SHEET_TAIL;
