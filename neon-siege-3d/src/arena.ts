import * as THREE from 'three';
import { materials, models } from 'easy-game-maker/3d';
import { ARENA_SIZE, type Cover } from './logic';

export const NEON_CYAN = '#22d3ee';
export const NEON_MAGENTA = '#ff2d95';
const WALL_HEIGHT = 7;

interface CoverDef {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly accent: string;
}

/** Blocks the player can hide behind. Tall enough that drones bolts (and the player's shots) stop on them. */
const COVER_DEFS: readonly CoverDef[] = [
  { x: 0, z: 0, w: 4, d: 4, h: 3.4, accent: NEON_MAGENTA },
  { x: -11, z: -8, w: 5, d: 2, h: 3.2, accent: NEON_CYAN },
  { x: 11, z: -8, w: 5, d: 2, h: 3.2, accent: NEON_CYAN },
  { x: -12, z: 8, w: 2, d: 5, h: 3.2, accent: NEON_MAGENTA },
  { x: 12, z: 8, w: 2, d: 5, h: 3.2, accent: NEON_MAGENTA },
  { x: 0, z: -14, w: 6, d: 1.6, h: 3, accent: NEON_CYAN },
  { x: -6, z: 12, w: 3, d: 3, h: 2.6, accent: NEON_CYAN },
  { x: 6, z: 12, w: 3, d: 3, h: 2.6, accent: NEON_CYAN },
];

export interface Arena {
  readonly group: THREE.Group;
  readonly walls: THREE.Object3D;
  readonly floor: THREE.Mesh;
  /** Every mesh a shot can stop on. */
  readonly solids: THREE.Object3D[];
  /** The same blocks as plain numbers, for bolt collision in `logic.ts`. */
  readonly covers: Cover[];
  /** Cover meshes, for the physics world. */
  readonly coverMeshes: THREE.Mesh[];
}

function neonStrip(width: number, depth: number, y: number, color: string, thickness = 0.1): THREE.Mesh {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), materials.glow(color, { intensity: 1.9 }));
  strip.position.y = y;
  return strip;
}

function buildCover(def: CoverDef): { mesh: THREE.Mesh; cover: Cover } {
  const mesh = models.box([def.w, def.h, def.d], { material: materials.standard({ color: '#2a2358', roughness: 0.6, metalness: 0.2 }) });
  mesh.position.set(def.x, def.h / 2, def.z);
  const rim = neonStrip(def.w + 0.12, def.d + 0.12, def.h / 2 - 0.05, def.accent);
  const belt = neonStrip(def.w + 0.06, def.d + 0.06, -def.h * 0.18, def.accent, 0.06);
  mesh.add(rim, belt);
  const cover: Cover = {
    minX: def.x - def.w / 2,
    maxX: def.x + def.w / 2,
    minZ: def.z - def.d / 2,
    maxZ: def.z + def.d / 2,
    height: def.h,
  };
  return { mesh, cover };
}

/** Distant towers behind the walls, so the arena is a place and not a box in a void. */
function buildSkyline(): THREE.Object3D {
  const towers = models.instances(new THREE.BoxGeometry(1, 1, 1), materials.standard({ color: '#1a1540', emissive: '#3b2a8f', emissiveIntensity: 0.3, roughness: 0.8 }), 46);
  const glow = models.instances(new THREE.BoxGeometry(1, 1, 1), materials.glow('#ffffff', { intensity: 1.6 }), 46);
  const group = new THREE.Group();
  group.add(towers, glow);
  for (let i = 0; i < 46; i += 1) {
    const angle = (i / 46) * Math.PI * 2 + (i % 3) * 0.05;
    const radius = 46 + ((i * 37) % 23);
    const height = 14 + ((i * 53) % 34);
    const width = 4 + ((i * 29) % 6);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    towers.place(i, [x, height / 2 - 1, z], { scale: [width, height, width] });
    glow.place(i, [x, height - 1.2, z], { scale: [width + 0.15, 0.35, width + 0.15] });
    glow.tint(i, i % 2 === 0 ? NEON_MAGENTA : NEON_CYAN);
  }
  return group;
}

/** The floor, walls, cover and skyline of the arena. */
export function buildArena(): Arena {
  const group = new THREE.Group();

  const grid = materials.gridTexture({ background: '#08061a', line: '#6d28d9', divisions: 4, lineWidth: 3 });
  grid.repeat.set(ARENA_SIZE / 4, ARENA_SIZE / 4);
  const floorMaterial = materials.standard({ map: grid, emissiveMap: grid, emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.55, metalness: 0.3 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE + 2, ARENA_SIZE + 2), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const walls = models.arena(ARENA_SIZE, { height: WALL_HEIGHT, thickness: 1, material: materials.standard({ color: '#1e1946', roughness: 0.65, metalness: 0.2 }) });
  group.add(walls);
  const half = ARENA_SIZE / 2;
  for (const y of [0.25, WALL_HEIGHT - 0.4]) {
    const color = y < 1 ? NEON_CYAN : NEON_MAGENTA;
    for (const sign of [-1, 1]) {
      const alongX = neonStrip(ARENA_SIZE, 0.16, y, color, 0.16);
      alongX.position.z = sign * (half - 0.02);
      const alongZ = neonStrip(0.16, ARENA_SIZE, y, color, 0.16);
      alongZ.position.x = sign * (half - 0.02);
      group.add(alongX, alongZ);
    }
  }

  const covers: Cover[] = [];
  const coverMeshes: THREE.Mesh[] = [];
  for (const def of COVER_DEFS) {
    const built = buildCover(def);
    group.add(built.mesh);
    covers.push(built.cover);
    coverMeshes.push(built.mesh);
  }
  group.add(buildSkyline());

  return { group, walls, floor, solids: [floor, walls, ...coverMeshes], covers, coverMeshes };
}
