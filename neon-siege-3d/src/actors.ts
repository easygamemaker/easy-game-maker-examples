import * as THREE from 'three';
import { materials, models } from 'easy-game-maker/3d';
import type { PickupKind } from './logic';
import { NEON_CYAN, NEON_MAGENTA } from './arena';

export interface DroneModel extends THREE.Group {
  userData: {
    /** The mesh a shot can hit. */
    hitbox: THREE.Mesh;
    ring: THREE.Mesh;
    core: THREE.Mesh;
    coreMaterial: THREE.MeshStandardMaterial;
    droneId: number;
  };
}

/** A hovering combat drone: a dark shell, a spinning neon ring and a core that glows before it fires. */
export function buildDrone(): DroneModel {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), materials.standard({ color: '#5646c8', roughness: 0.4, metalness: 0.2 }));
  shell.castShadow = true;
  const coreMaterial = materials.glow(NEON_MAGENTA, { intensity: 1.6 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), coreMaterial);
  core.position.z = 0.36;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 40), materials.glow(NEON_CYAN, { intensity: 2.0 }));
  ring.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const fin = models.box([0.08, 0.5, 0.5], { color: '#2a2460' });
    fin.position.set(side * 0.5, 0.05, -0.1);
    shell.add(fin);
  }
  group.add(shell, core, ring);
  return Object.assign(group, { userData: { hitbox: shell, ring, core, coreMaterial, droneId: 0 } }) as DroneModel;
}

/** The rifle seen from the shooter's eye: dark body, a cyan energy strip and a barrel that ends at `muzzle`. */
export function buildRifle(): { group: THREE.Group; muzzle: THREE.Object3D } {
  const group = new THREE.Group();
  const dark = materials.standard({ color: '#2b2560', roughness: 0.45, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.5), dark);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 10), materials.standard({ color: '#7a6cf0', roughness: 0.35, metalness: 0.3 }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.42);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26), materials.standard({ color: '#4338a0', roughness: 0.5, metalness: 0.2 }));
  guard.position.set(0, -0.02, -0.28);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), dark);
  grip.position.set(0, -0.13, 0.12);
  grip.rotation.x = 0.25;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.09), dark);
  mag.position.set(0, -0.12, -0.02);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.012, 0.3), materials.glow(NEON_CYAN, { intensity: 1.6 }));
  strip.position.set(0, 0.075, -0.1);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.05), materials.glow(NEON_MAGENTA, { intensity: 1.6 }));
  sight.position.set(0, 0.095, -0.2);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.7);
  group.add(body, barrel, guard, grip, mag, strip, sight, muzzle);
  return { group, muzzle };
}

/** A glowing enemy bolt. */
export function buildBolt(): THREE.Mesh {
  const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), materials.glow('#fb7185', { intensity: 2.4 }));
  bolt.scale.set(1, 1, 1.9);
  return bolt;
}

/** A short-lived streak from the muzzle to whatever the shot hit. */
export function buildTracer(): THREE.Mesh {
  const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), materials.glow('#a5f3fc', { intensity: 2.2 }));
  tracer.frustumCulled = false;
  return tracer;
}

/** A soft additive quad at the muzzle for the flash itself. */
export function buildMuzzleFlash(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    map: materials.sparkTexture({ color: '#fde68a', softness: 0.6 }),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), material);
  flash.visible = false;
  return flash;
}

/** Health is a green cross, ammo an amber cell. Both glow so they read from across the arena. */
export function buildPickup(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();
  if (kind === 'health') {
    const glow = materials.glow('#34d399', { intensity: 1.8 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.2), glow);
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), glow);
    group.add(bar, upright);
  } else {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.34), materials.glow('#fbbf24', { intensity: 1.6 }));
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.38), materials.standard({ color: '#3a2f7a' }));
    cap.position.y = 0.2;
    group.add(cell, cap);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 28), materials.glow(kind === 'health' ? '#34d399' : '#fbbf24', { intensity: 1.2 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.45;
  group.add(halo);
  return group;
}
