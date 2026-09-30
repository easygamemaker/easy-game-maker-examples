import * as THREE from 'three';
import { materials, math, models } from 'easy-game-maker/3d';
import { SHIP_LIMIT, SPAWN_Z } from './logic';

const TRACK_WIDTH = SHIP_LIMIT * 2 + 4;
const TRACK_LENGTH = 260;
const TILE = 6;
const PYLON_SPACING = 10;
const PYLON_ROWS = 14;

export interface Track {
  readonly group: THREE.Group;
  /** Scrolls the floor and the edge pylons toward the camera. */
  scroll(distance: number): void;
}

/** A glowing grid runway with a row of pylons down each edge. */
export function buildTrack(): Track {
  const group = new THREE.Group();

  const grid = materials.gridTexture({ background: '#070b1f', line: '#22d3ee', divisions: 4, lineWidth: 3 });
  grid.repeat.set(TRACK_WIDTH / TILE, TRACK_LENGTH / TILE);
  const floorMaterial = materials.standard({ map: grid, emissiveMap: grid, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.9, SPAWN_Z + TRACK_LENGTH / 2 - 60);
  floor.receiveShadow = true;
  group.add(floor);

  const pylons = models.instances(new THREE.BoxGeometry(0.35, 2.2, 0.35), materials.glow('#f97316', { intensity: 1.3 }), PYLON_ROWS * 2);
  group.add(pylons);
  const edge = SHIP_LIMIT + 1.2;
  let travelled = 0;

  const placePylons = (): void => {
    for (let row = 0; row < PYLON_ROWS; row += 1) {
      const z = math.wrap(SPAWN_Z + 20 + row * PYLON_SPACING + travelled, SPAWN_Z + 20, SPAWN_Z + 20 + PYLON_ROWS * PYLON_SPACING);
      pylons.place(row * 2, [-edge, 0.2, z]);
      pylons.place(row * 2 + 1, [edge, 0.2, z]);
    }
  };
  placePylons();

  return {
    group,
    scroll(distance: number): void {
      travelled += distance;
      grid.offset.y += distance / TILE / (TRACK_LENGTH / TILE);
      placePylons();
    },
  };
}

/** Sets the ship's look: a blue hull with an orange accent and a small engine glow. */
export function buildShip(): THREE.Group {
  const ship = models.vehicle({ color: '#38bdf8', accent: '#f97316', length: 2.4, width: 1.5 });
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), materials.glow('#fb923c', { intensity: 1.4 }));
  engine.position.set(0, 0.25, 1.15);
  ship.add(engine);
  const wings = models.box([3.4, 0.07, 1], { color: '#e0f2fe', position: [0, 0.32, 0.35] });
  const fin = models.box([0.08, 0.5, 0.7], { color: '#f97316', position: [0, 0.7, 0.9] });
  ship.add(wings, fin);
  return ship;
}

/** One asteroid: a faceted rock that reads as a hazard, with a hot red glow in its cracks. */
export function buildAsteroid(): THREE.Mesh {
  const rock = models.rock({ radius: 1.05, color: '#64748b', jitter: 0.28 });
  rock.material = materials.standard({ color: '#64748b', emissive: '#b91c1c', emissiveIntensity: 0.55, roughness: 0.85, flatShading: true });
  return rock;
}
