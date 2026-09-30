import * as THREE from 'three';
import { materials, models, math } from 'easy-game-maker/3d';
import { ISLAND_RADIUS, createRng } from './logic';

/** Everything that never changes during a round: sea, island, trees, rocks, clouds. */
export function buildScenery(): { group: THREE.Group; clouds: THREE.Object3D[] } {
  const group = new THREE.Group();
  const rng = createRng(2024);

  const sea = models.box([220, 1, 220], { color: '#1d6fa5', position: [0, -1.55, 0] });
  sea.castShadow = false;
  group.add(sea);

  const sand = models.cylinder(ISLAND_RADIUS + 0.9, 0.9, { segments: 56, color: '#f2d59b', position: [0, -0.6, 0] });
  const grass = models.cylinder(ISLAND_RADIUS, 1, {
    segments: 56,
    material: materials.standard({
      map: materials.checkerTexture({ light: '#5bd17c', dark: '#49bf6b', squares: 12 }),
      roughness: 0.9,
      metalness: 0,
    }),
    position: [0, -0.5, 0],
  });
  grass.castShadow = false;
  group.add(sand, grass);

  // Trees and rocks ring the rim, outside the walkable disc.
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * math.TAU + rng() * 0.3;
    const radius = ISLAND_RADIUS - 0.9 - rng() * 0.8;
    const tree = models.tree({ height: 2.6 + rng() * 1.4, tiers: rng() > 0.5 ? 3 : 2 });
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.rotation.y = rng() * math.TAU;
    group.add(tree);
  }
  for (let i = 0; i < 7; i += 1) {
    const angle = rng() * math.TAU;
    const radius = ISLAND_RADIUS - 2.4 - rng() * 0.6;
    const rock = models.rock({ radius: 0.5 + rng() * 0.5, color: '#a8a29e' });
    rock.position.set(Math.cos(angle) * radius, 0.15, Math.sin(angle) * radius);
    group.add(rock);
  }

  const clouds: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i += 1) {
    const cloud = models.cloud({ color: '#ffffff', puffs: 5, spread: 2.2 });
    cloud.position.set((rng() - 0.5) * 90, 16 + rng() * 6, (rng() - 0.5) * 70 - 20);
    group.add(cloud);
    clouds.push(cloud);
  }
  return { group, clouds };
}
