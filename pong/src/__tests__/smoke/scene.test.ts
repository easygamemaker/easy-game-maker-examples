import { describe, it, expect } from 'vitest';
import { createMockApp, runScene } from 'easy-game-maker/testing';
import { GameScene } from '../../scenes/GameScene';

describe('Pong — Smoke Tests', () => {
  it('GameScene runs 60 frames without throwing', async () => {
    const app = createMockApp();
    await expect(runScene(GameScene, app, 60)).resolves.toBeDefined();
  });
});
