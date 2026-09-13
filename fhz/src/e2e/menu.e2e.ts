import { test } from 'easy-game-maker/e2e';

test('Menu opens and navigates to level', async ({ game }) => {
  // Wait for menu animations to complete and Play button to appear (~2200ms)
  await game.wait(3000);

  await game.screenshot('menu-ready');

  // Tap the Play button (canvas center-bottom: 284, 240)
  await game.tap(284, 240);

  // Assert scene changed — retries every 200ms up to 6s (waits for 2s fade + texture load)
  await game.expect.scene('level');

  await game.screenshot('level-loaded');
});

test('Catapult drag launches fruit', async ({ game }) => {
  // Navigate to the level first
  await game.wait(3000);
  await game.tap(284, 240);

  // Wait for level to load and GO! counter to appear
  await game.expect.scene('level');
  await game.wait(2000);

  // Drag catapult — pulls slingshot down-left
  await game.drag(185, 192, 24, 231, { duration: 1683 });
  await game.wait(4946);

  // Second fruit launch
  await game.drag(177, 205, 71, 224, { duration: 1261 });
  await game.wait(616);
});
