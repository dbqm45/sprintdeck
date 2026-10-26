import { expect, test } from "@playwright/test";

test("the simulator reads votes on both decks", async ({ page }) => {
  await page.goto("/simulator");
  await expect(page.getByText("Worth checking the differences in assumptions")).toBeVisible();
  await page.getByRole("tab", { name: /Questions/ }).click();
  await expect(page.getByText("What does Eve (21) see that the rest of us don't?")).toBeVisible();

  await page.getByRole("radio", { name: "Risk" }).click();
  await page.getByRole("tab", { name: /Questions/ }).click();
  await expect(page.getByText("What does Eve (Very high) know about this that the rest of us don't?")).toBeVisible();
});
