import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();
  await expect(page.locator(".worldMapLabel")).toHaveCount(3);
});

test("uses home-fit zoom, pans the camera, focuses, enters, and resets on return", async ({ page }) => {
  const stage = page.locator(".worldMapStage");
  const zoom = page.locator(".worldMapControls output");
  await expect(zoom).toHaveText("93%");

  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await expect(zoom).not.toHaveText("93%");

  const economy = page.locator('[data-region-id="region-eco"]');
  await economy.click();
  await expect(page.locator(".worldMapInfo")).toBeVisible();
  await expect(zoom).toHaveText("134%");

  await economy.click();
  await expect(page).toHaveURL(/\/category\/eco$/);
  await page.goBack();
  // Every entry into the world map resets to the home view, even a fresh visit
  // that had previously panned/zoomed/selected a region in the same session.
  await expect(page.locator(".worldMapInfo")).toHaveCount(0);
  await expect(zoom).toHaveText("93%");
});

test("shows the complete world on mobile without scaling labels with the camera", async ({ page }) => {
  const stage = page.locator(".worldMapStage");
  await expect(stage).toBeVisible();
  await expect(page.locator(".worldMapControls output")).toHaveText("93%");

  const labels = page.locator(".worldMapLabel");
  const before = await labels.first().boundingBox();
  await page.locator('.worldMapControls button[aria-label="放大地图"]').click();
  const after = await labels.first().boundingBox();
  expect(before?.width).toBeCloseTo(after?.width ?? 0, 0);
  expect(before?.height).toBeCloseTo(after?.height ?? 0, 0);

  await page.locator('[data-region-id="region-eco"]').click();
  await expect(page.locator(".worldMapInfo")).toBeVisible();
  await expect(page.locator('.worldMapLabel:not(.is-selected)').first()).toHaveCSS("opacity", "0.72");
});
