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
