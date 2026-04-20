import { expect, test } from "@playwright/test";

test("dashboard shows active bots with runtime-based daily column", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Пульт ботов" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Активные боты" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "По runtime/день" })).toBeVisible();
  await expect(page.getByText("Сейчас", { exact: false }).first()).toBeVisible();
});

test("dashboard visual baseline", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Пульт ботов" })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-page.png", {
    fullPage: true,
    animations: "disabled",
  });
});
