import { expect, test } from "@playwright/test";

test("structured synthesis only lists sources referenced by a facet", async ({ page }) => {
  await page.goto("/collection/da2e1ad3/synthesis");

  const point = page.locator(".kp").filter({ hasText: "杠杆收购的财富与代价" });
  await expect(point.locator(".kp-ref")).toHaveText(["1", "2", "4"]);
  await expect(point.locator(".src-no")).toHaveText(["1", "2", "4"]);
});

test("all collection synthesis source lists match their visible facet references", async ({ page }) => {
  const collectionIds = [
    "07ae1f5b", "832cf0f1", "b9702449", "da2e1ad3", "misc-eco",
    "misc-his", "misc-tech", "tc-097c55ac", "tc-25dff437", "tc-305aa55b",
    "c1", "c3", "c4",
  ];

  for (const collectionId of collectionIds) {
    await page.goto(`/collection/${collectionId}/synthesis`);
    const points = page.locator(".kp").filter({ has: page.locator(".spine") });
    for (let i = 0; i < await points.count(); i += 1) {
      const point = points.nth(i);
      const references = [...new Set(await point.locator(".kp-ref").allTextContents())]
        .sort((a, b) => Number(a) - Number(b));
      const sources = (await point.locator(".src-no").allTextContents())
        .sort((a, b) => Number(a) - Number(b));
      expect(sources, `${collectionId} point ${i + 1}`).toEqual(references);
    }
  }
});
