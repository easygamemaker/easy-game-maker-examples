import { describe, it, expect, vi } from 'vitest';
import { createMockApp, runScene } from 'easy-game-maker/testing';
import { MenuScene } from '../../scenes/MenuScene';
import { GameScene } from '../../scenes/GameScene';

describe('Chess — Smoke Tests', () => {
  it('MenuScene runs 60 frames without throwing', async () => {
    const app = createMockApp();
    await expect(runScene(MenuScene, app, 60)).resolves.toBeDefined();
  });

  it('GameScene runs 60 frames without throwing', async () => {
    const app = createMockApp();
    await expect(runScene(GameScene, app, 60)).resolves.toBeDefined();
  });
});
