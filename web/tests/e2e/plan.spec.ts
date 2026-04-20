import { expect, test } from "@playwright/test";

test("plan page makes APR estimate explicit", async ({ page }) => {
  await page.goto("/plan");

  await expect(page.getByRole("heading", { name: "План дохода" })).toBeVisible();
  await expect(page.getByText("Прогноз по прибыли/день")).toBeVisible();
  await expect(page.getByText("Факт по наблюдению")).toBeVisible();
  await expect(page.getByText("Главный KPI выше считается по прибыли в день", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Вклад ботов в текущий план" })).toBeVisible();
});
