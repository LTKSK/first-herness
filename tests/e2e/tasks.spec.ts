import { expect, test } from "@playwright/test";

test("編集したタイトルを再読み込み後も表示する", async ({ page }) => {
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

test("空のタイトルを追加すると入力エラーを表示する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("alert")).toContainText("タイトルを入力");
});

async function addTask(page: import("@playwright/test").Page, title: string) {
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test("選択したステータスのタスクだけを表示する", async ({ page }) => {
  await page.goto("/");
  const first = `filter incomplete ${Date.now()}`;
  const second = `filter complete ${Date.now()}`;
  await addTask(page, first);
  await addTask(page, second);
  await page.getByRole("checkbox", { name: `${second}を完了`, exact: true }).click();
  await expect(page.getByText(second, { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "未完了", exact: true }).uncheck();
  await expect(page.getByText(first, { exact: true })).toHaveCount(0);
  await expect(page.getByText(second, { exact: true })).toBeVisible();
});

test("未完了のみのとき最後のステータスを解除できない", async ({ page }) => {
  await page.goto("/");
  const incomplete = page.getByRole("checkbox", { name: "未完了", exact: true });
  await incomplete.click();
  await expect(incomplete).toBeChecked();
});

test("再読み込みすると未完了のみを選択する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await page.getByRole("checkbox", { name: "未完了", exact: true }).uncheck();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "未完了", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "完了", exact: true })).not.toBeChecked();
});

test("完了タスクを未完了に戻すとフィルター表示が変わる", async ({ page }) => {
  await page.goto("/");
  const title = `return ${Date.now()}`;
  await addTask(page, title);
  await page.getByRole("checkbox", { name: `${title}を完了`, exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await page.getByRole("checkbox", { name: "未完了", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: `${title}を完了`, exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("完了のみのとき最後のステータスを解除できない", async ({ page }) => {
  await page.goto("/");
  const complete = page.getByRole("checkbox", { name: "完了", exact: true });
  const incomplete = page.getByRole("checkbox", { name: "未完了", exact: true });
  await complete.check();
  await incomplete.uncheck();
  await complete.click();
  await expect(complete).toBeChecked();
  await expect(incomplete).not.toBeChecked();
});

test("完了状態の保存で500が返るとエラーを表示し状態を維持する", async ({ page }) => {
  await page.goto("/");
  const title = `failed completion ${Date.now()}`;
  await addTask(page, title);
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 500, body: "failure" });
    } else {
      await route.continue();
    }
  });
  const completion = page.getByRole("checkbox", { name: `${title}を完了`, exact: true });
  await completion.click();
  await expect(page.getByRole("alert")).toContainText("保存に失敗しました");
  await expect(completion).not.toBeChecked();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: `${title}を完了`, exact: true }),
  ).not.toBeChecked();
});

test("タスク作成で500が返ると保存エラーを表示する", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 500, body: "failure" });
    else await route.continue();
  });
  await page.getByLabel("タイトル", { exact: true }).fill("failed create");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("alert")).toContainText("保存に失敗しました");
});

test("タイトル編集で500が返ると保存エラーを表示する", async ({ page }) => {
  await page.goto("/");
  const title = `failed edit ${Date.now()}`;
  await addTask(page, title);
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 500, body: "failure" });
    else await route.continue();
  });
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "編集" })
    .click();
  await page.getByLabel("タイトルを編集").fill("changed title");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("alert")).toContainText("保存に失敗しました");
});

test("存在しないタスクへの更新で404が返ると保存エラーを表示する", async ({ page }) => {
  await page.goto("/");
  const title = `missing task ${Date.now()}`;
  await addTask(page, title);
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({ status: 404, body: "not found" });
    else await route.continue();
  });
  const completion = page.getByRole("checkbox", { name: `${title}を完了`, exact: true });
  await completion.click();
  await expect(page.getByRole("alert")).toContainText("保存に失敗しました");
  await expect(completion).not.toBeChecked();
});
