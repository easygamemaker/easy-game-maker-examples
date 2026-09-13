import { describe, it, expect } from 'vitest';
import { createMockApp, runScene } from 'easy-game-maker/testing';
import { MenuScene } from '../../scenes/MenuScene';

describe('Cut The Rope — Smoke Tests', () => {
  it('MenuScene runs 60 frames without throwing', async () => {
    const app = createMockApp();
    await expect(runScene(MenuScene, app, 60)).resolves.toBeDefined();
  });
});
