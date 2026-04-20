import { expect, test } from "@playwright/test";

test("bot page separates current grid profit from per-day metrics", async ({ page }) => {
  await page.goto("/bots/612367354935931891");

  await expect(page.getByRole("heading", { name: "История бота" })).toBeVisible();
  await expect(page.getByText("Прибыль сетки сейчас")).toBeVisible();
  await expect(page.getByText("Сетка по runtime/день")).toBeVisible();
  await expect(page.getByText("APR-оценка/день")).toBeVisible();
});
