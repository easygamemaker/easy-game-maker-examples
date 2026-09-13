import { test } from 'easy-game-maker/e2e';

// Canvas: 360×640
// Menu PLAY button center: (W/2=180, H/2+150=470) — tap (171,464) is within hit area
// Level 1: hooks at (180,80), (305,240), (180,355) · candy starts at (280,110)

test('Menu navigates to game', async ({ game }) => {
  // Wait for logo fade-in (~600ms) and PLAY button to appear
  await game.wait(1000);

  await game.screenshot('menu-ready');

  // Tap PLAY button
  await game.tap(171, 464);

  // Assert scene changed — retries until game scene assets load
  await game.expect.scene('game');

  await game.screenshot('game-started');
});

test('Cut ropes and feed candy to Om Nom', async ({ game }) => {
  // Navigate to game first
  await game.wait(1000);
  await game.tap(171, 464);
  await game.expect.scene('game');

  // Wait for level physics and all ropes to fully initialize
  await game.wait(7563);

  await game.screenshot('before-first-cut');

  // Cut first rope — horizontal slash near top hooks (y ≈ 140)
  await game.drag(122, 148, 231, 133, { duration: 295 });

  // Wait for candy to swing on remaining ropes
  await game.wait(10263);

  await game.screenshot('before-second-cut');

  // Cut second rope — horizontal slash near mid hook (y ≈ 340)
  await game.drag(258, 324, 358, 355, { duration: 254 });

  // Assert outcome: candy reached Om Nom ('eating') or fell off screen ('lost')
  await game.expect.state(
    (win: Window & { __EGM_APP__?: { scenes: { current: { _state?: string } | null } } }) => {
      const state = win.__EGM_APP__?.scenes?.current?._state;
      return state === 'eating' || state === 'lost';
    },
    'Candy should reach Om Nom or fall off screen after ropes are cut',
    { timeout: 8000 },
  );

  await game.screenshot('after-second-cut');
});
