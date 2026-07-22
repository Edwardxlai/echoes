import { expect, test } from "@playwright/test";

test("structured synthesis only lists sources referenced by a facet", async ({ page }) => {
  await page.goto("/collection/da2e1ad3/synthesis");

  const row = page.locator("table.matrix tbody tr").filter({ hasText: "杠杆收购的财富与代价" });
  await row.click();

  const drawer = page.locator(".focusDrawer");
  await expect(drawer.locator(".kp-ref")).toHaveText(["1", "2", "4"]);
  await expect(drawer.locator(".src-no")).toHaveText(["1", "2", "4"]);
});

test("all collection synthesis source lists match their visible facet references", async ({ page }) => {
  const collectionIds = [
    "07ae1f5b", "832cf0f1", "b9702449", "da2e1ad3", "misc-eco",
    "misc-his", "misc-tech", "tc-097c55ac", "tc-25dff437", "tc-305aa55b",
    "c1", "c3", "c4",
  ];

  for (const collectionId of collectionIds) {
    await page.goto(`/collection/${collectionId}/synthesis`);
    const rows = page.locator("table.matrix tbody tr");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i += 1) {
      await rows.nth(i).click();
      const drawer = page.locator(".focusDrawer");
      if ((await drawer.locator(".spine").count()) === 0) continue; // 无 facets 的点走 note 兜底，没有 ref 可核对

      const references = [...new Set(await drawer.locator(".kp-ref").allTextContents())]
        .sort((a, b) => Number(a) - Number(b));
      const sources = (await drawer.locator(".src-no").allTextContents())
        .sort((a, b) => Number(a) - Number(b));
      expect(sources, `${collectionId} point ${i + 1}`).toEqual(references);
    }
  }
});
