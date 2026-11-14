import { expect, test } from "@playwright/test";

test("create, edit and reload a task", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("タイトル", { exact: true }).fill("最初のタスク");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByText("最初のタスク")).toBeVisible();
  await page.getByRole("button", { name: "編集" }).click();
  await page.getByLabel("タイトルを編集").fill("更新したタスク");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("更新したタスク")).toBeVisible();
  await page.reload();
  await expect(page.getByText("更新したタスク")).toBeVisible();
});

test("shows a validation error for an empty title", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("alert")).toContainText("タイトルを入力");
});
