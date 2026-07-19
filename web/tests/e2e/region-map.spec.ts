import { expect, test } from "@playwright/test";

test("keeps the economy water fixed while the terrain pans", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/category/eco");

  const stage = page.locator(".mapStage--regionAtlas");
  const viewport = page.locator(".mapStage__viewport");
  const camera = page.locator(".mapStage__camera");
  const fixedWater = page.locator(".mapStage__stageBackground .regionStageWater");
  const fixedWaterCanvas = fixedWater.locator("canvas");

  await expect(fixedWater).toHaveCount(1);
  await expect(camera.locator(".regionImageTerrain__water")).toHaveCount(0);
  await expect(camera.locator(".regionImageTerrain__base--transparent")).toHaveCount(1);
  await expect(fixedWaterCanvas).toBeVisible();

  const initialBounds = await Promise.all([
    stage.boundingBox(),
    fixedWater.boundingBox(),
    fixedWaterCanvas.boundingBox(),
    camera.boundingBox(),
  ]);
  expect(initialBounds[0]?.width).toBe(390);
  expect(initialBounds[1]?.width).toBe(390);
  expect(initialBounds[2]?.width).toBe(390);

  await viewport.focus();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("ArrowRight");
  }

  const pannedBounds = await Promise.all([fixedWater.boundingBox(), camera.boundingBox()]);
  expect(pannedBounds[0]?.x).toBe(0);
  expect(pannedBounds[0]?.width).toBe(390);
  expect(pannedBounds[1]?.x).toBeLessThan((initialBounds[3]?.x ?? 0) - 20);
});

test("keeps the technology water fixed and the mobile atlas full width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/category/tech");

  const stage = page.locator(".mapStage--regionAtlas");
  const viewport = page.locator(".mapStage__viewport");
  const camera = page.locator(".mapStage__camera");
  const fixedWater = page.locator(".mapStage__stageBackground .regionStageWater");
  const fixedWaterCanvas = fixedWater.locator("canvas");

  await expect(fixedWater).toHaveCount(1);
  await expect(page.locator(".mapStage__camera .regionImageTerrain__water")).toHaveCount(0);

  await expect(fixedWaterCanvas).toBeVisible();
  const initialBounds = await Promise.all([
    stage.boundingBox(),
    fixedWater.boundingBox(),
    fixedWaterCanvas.boundingBox(),
    camera.boundingBox(),
  ]);
  expect(initialBounds[0]?.width).toBe(390);
  expect(initialBounds[1]?.width).toBe(390);
  expect(initialBounds[2]?.width).toBe(390);

  await viewport.focus();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("ArrowRight");
  }

  const pannedBounds = await Promise.all([fixedWater.boundingBox(), camera.boundingBox()]);
  expect(pannedBounds[0]?.x).toBe(0);
  expect(pannedBounds[0]?.width).toBe(390);
  expect(pannedBounds[1]?.x).toBeLessThan((initialBounds[3]?.x ?? 0) - 20);
});
