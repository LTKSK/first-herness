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

test("タイトル検索に入力すると大小文字を区別せず部分一致するタスクだけを表示し、消去すると一覧に戻る", async ({
  page,
}) => {
  await page.goto("/");
  const first = `Search Alpha ${Date.now()}`;
  const second = `Search Beta ${Date.now()}`;
  await addTask(page, first);
  await addTask(page, second);
  const search = page.getByLabel("タイトルを検索");
  await search.fill("  ALpHa  ");
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toHaveCount(0);
  await search.fill("no such matching task");
  await expect(page.getByText("表示するタスクはありません。")).toBeVisible();
  await search.fill("");
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toBeVisible();
});

test("検索中にステータスを選択するとタイトルとステータスの両方に一致するタスクを表示する", async ({
  page,
}) => {
  await page.goto("/");
  const first = `Combined active ${Date.now()}`;
  const second = `Combined done ${Date.now()}`;
  await addTask(page, first);
  await addTask(page, second);
  await page.getByRole("checkbox", { name: `${second}を完了`, exact: true }).click();
  await page.getByLabel("タイトルを検索").fill("combined");
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.getByText(second, { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "未完了", exact: true }).uncheck();
  await expect(page.getByText(first, { exact: true })).toHaveCount(0);
  await expect(page.getByText(second, { exact: true })).toBeVisible();
});

test("検索中にタスクのタイトルを編集すると保存結果が現在の検索条件に反映される", async ({
  page,
}) => {
  await page.goto("/");
  const title = `Editable search ${Date.now()}`;
  await addTask(page, title);
  await page.getByLabel("タイトルを検索").fill("editable");
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "編集" })
    .click();
  await page.getByLabel("タイトルを編集").fill("Updated task");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("Updated task", { exact: true })).toHaveCount(0);
  await page.getByLabel("タイトルを検索").fill("updated");
  await expect(page.getByText("Updated task", { exact: true })).toBeVisible();
});

test("検索中に再読み込みすると検索語が空になり保存済みタスクを一覧に表示する", async ({ page }) => {
  await page.goto("/");
  const title = `Reload search ${Date.now()}`;
  await addTask(page, title);
  await page.getByLabel("タイトルを検索").fill("no such matching task");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("タイトルを検索")).toHaveValue("");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("検索中にタスクを追加し完了すると現在の検索とステータスの条件が一覧に反映される", async ({
  page,
}) => {
  await page.goto("/");
  const title = `Search create ${Date.now()}`;
  await page.getByLabel("タイトルを検索").fill("search create");
  await addTask(page, title);
  await page.getByRole("checkbox", { name: `${title}を完了`, exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("確認を了承すると対象タスクだけ削除され再読み込み後も残らない", async ({ page }) => {
  await page.goto("/");
  const title = `削除対象 ${Date.now()}`;
  const other = `残す対象 ${Date.now()}`;
  await addTask(page, title);
  await addTask(page, other);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "削除" })
    .click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(page.getByText(other, { exact: true })).toBeVisible();
});

test("削除確認をキャンセルすると対象タスクが一覧に残る", async ({ page }) => {
  await page.goto("/");
  const title = `キャンセル対象 ${Date.now()}`;
  await addTask(page, title);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "削除" })
    .click();
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("削除APIが失敗するとエラーを表示し対象タスクを維持する", async ({ page }) => {
  await page.goto("/");
  const title = `削除失敗 ${Date.now()}`;
  await addTask(page, title);
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() === "DELETE") await route.fulfill({ status: 500 });
    else await route.continue();
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "削除" })
    .click();
  await expect(page.getByRole("alert")).toContainText("削除に失敗しました");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("完了タスクを一覧から削除すると再読み込み後も表示されない", async ({ page }) => {
  await page.goto("/");
  const title = `完了後に削除 ${Date.now()}`;
  await addTask(page, title);
  await page.getByRole("checkbox", { name: `${title}を完了`, exact: true }).click();
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const deleteButton = page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "削除" });
  await expect(deleteButton).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("期限を設定して作成し、編集・解除した結果を再読み込み後も一覧に表示する", async ({ page }) => {
  await page.goto("/");
  const title = `期限 ${Date.now()}`;
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  await page.getByLabel("期限（任意）").fill("2030-01-02");
  await page.getByRole("button", { name: "追加" }).click();
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("2030-01-02");
  await row.getByRole("button", { name: "編集" }).click();
  await page.getByLabel("期限を編集").fill("2031-02-03");
  await page.getByRole("button", { name: "保存" }).click();
  await page.reload();
  await expect(row).toContainText("2031-02-03");
  await row.getByRole("button", { name: "編集" }).click();
  await page.getByLabel("期限を編集").fill("");
  await page.getByRole("button", { name: "保存" }).click();
  await page.reload();
  await expect(row).toContainText("期限: なし");
});

test("タスクが1件もない一覧を開くと追加方法を案内する", async ({ page, request }) => {
  const response = await request.get("/api/tasks");
  const existing = (await response.json()) as { id: number }[];
  for (const task of existing) await request.delete(`/api/tasks/${task.id}`);
  await page.goto("/");
  await expect(page.getByText("上のフォームからタスクを追加しましょう。")).toBeVisible();
});

test("検索条件に合うタスクがないと一覧に条件の変更を案内する", async ({ page }) => {
  await page.goto("/");
  await addTask(page, `確認項目 ${Date.now()}`);
  await page.getByLabel("タイトルを検索").fill("一致しない検索語");
  await expect(page.getByText("検索語やステータスを変更してください。")).toBeVisible();
});

test("ステータスの選択欄を表示すると1つ以上の選択が必要と分かる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ステータスを1つ以上選択してください。")).toBeVisible();
  await expect(page.getByRole("group", { name: "ステータス" })).toHaveAccessibleDescription(
    "ステータスを1つ以上選択してください。",
  );
});

test("狭い画面で長いタイトルのタスクを表示すると編集と削除を画面内で操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const title = `長いタイトル${"長".repeat(100)}${Date.now()}`;
  await addTask(page, title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await row.getByRole("button", { name: "編集" }).scrollIntoViewIfNeeded();
  await expect(row.getByRole("button", { name: "編集" })).toBeInViewport();
  await expect(row.getByRole("button", { name: "削除" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await row.getByRole("button", { name: "編集" }).click();
  await expect(page.getByLabel("タイトルを編集")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("キーボードで編集を開始してキャンセルすると元のタイトルが残る", async ({ page }) => {
  await page.goto("/");
  const title = `キーボード ${Date.now()}`;
  await addTask(page, title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await row.getByRole("button", { name: "編集" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("タイトルを編集")).toBeFocused();
  const cancel = page.getByRole("button", { name: "キャンセル" });
  for (
    let i = 0;
    i < 10 && !(await cancel.evaluate((button) => button === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row.getByText(title, { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "編集" })).toBeFocused();
});

test("一覧の読み込みが失敗した後にタスクを追加すると追加したタスクを表示する", async ({ page }) => {
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "GET") await route.fulfill({ status: 500 });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("読み込みに失敗");
  const title = `読み込み後 ${Date.now()}`;
  await addTask(page, title);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

async function tabTo(
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator,
) {
  for (
    let i = 0;
    i < 80 && !(await locator.evaluate((element) => element === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(locator).toBeFocused();
}

test("キーボードで検索語を入力すると一致するタスクだけを一覧に表示する", async ({ page }) => {
  await page.goto("/");
  const title = `keysearch${Date.now()}`;
  await addTask(page, title);
  const search = page.getByLabel("タイトルを検索");
  await tabTo(page, search);
  await page.keyboard.type(title);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText("1 件", { exact: true })).toBeVisible();
});

test("キーボードで完了ステータスを選ぶと完了タスクが一覧に表示される", async ({ page }) => {
  await page.goto("/");
  const title = `keyfilter${Date.now()}`;
  await addTask(page, title);
  const toggle = page.getByRole("checkbox", { name: `${title}を完了`, exact: true });
  await tabTo(page, toggle);
  await page.keyboard.press("Space");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  const complete = page.getByRole("checkbox", { name: "完了", exact: true });
  await tabTo(page, complete);
  await page.keyboard.press("Space");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("キーボードでタイトルを編集して保存すると一覧に変更後のタイトルを表示する", async ({
  page,
}) => {
  await page.goto("/");
  const title = `keyedit${Date.now()}`;
  await addTask(page, title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await tabTo(page, row.getByRole("button", { name: "編集" }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("keyboard saved");
  await tabTo(page, page.getByRole("button", { name: "保存" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("keyboard saved", { exact: true })).toBeVisible();
});

test("キーボードで削除を選び確認をキャンセルするとタスクが一覧に残る", async ({ page }) => {
  await page.goto("/");
  const title = `keydelete${Date.now()}`;
  await addTask(page, title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await tabTo(page, row.getByRole("button", { name: "削除" }));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Enter");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("キーボードで未完了タスクを完了にして一覧から消すと検索欄にフォーカスを移す", async ({
  page,
}) => {
  await page.goto("/");
  const title = `focuscomplete${Date.now()}`;
  await addTask(page, title);
  const toggle = page.getByRole("checkbox", { name: `${title}を完了`, exact: true });
  await tabTo(page, toggle);
  await page.keyboard.press("Space");
  await expect(page.getByLabel("タイトルを検索")).toBeFocused();
});

test("キーボードでタスクを削除すると検索欄にフォーカスを移す", async ({ page }) => {
  await page.goto("/");
  const title = `focusdelete${Date.now()}`;
  await addTask(page, title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await tabTo(page, row.getByRole("button", { name: "削除" }));
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("タイトルを検索")).toBeFocused();
});

test("検索中にタイトルを変更して一覧から消すと検索欄にフォーカスを移す", async ({ page }) => {
  await page.goto("/");
  const title = `focusedit${Date.now()}`;
  await addTask(page, title);
  await page.getByLabel("タイトルを検索").fill(title);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await row.getByRole("button", { name: "編集" }).click();
  await page.getByLabel("タイトルを編集").fill("別のタイトル");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByLabel("タイトルを検索")).toBeFocused();
});

test("期限順を選ぶと期限が近い順で未設定は最後になり登録順に戻せる", async ({ page }) => {
  await page.goto("/");
  const prefix = `sort ${Date.now()}`;
  for (const [name, date] of [
    ["なし", ""],
    ["遅い", "2030-05-01"],
    ["同日1", "2029-01-01"],
    ["同日2", "2029-01-01"],
  ]) {
    await page.getByLabel("期限（任意）").fill(date);
    await addTask(page, `${prefix} ${name}`);
  }
  await page.getByLabel("タイトルを検索").fill(prefix);
  const titles = page.locator(".task-title");
  await expect(titles).toHaveText([
    `${prefix} なし`,
    `${prefix} 遅い`,
    `${prefix} 同日1`,
    `${prefix} 同日2`,
  ]);
  await page.getByLabel("並び順").selectOption("due");
  await expect(titles).toHaveText([
    `${prefix} 同日1`,
    `${prefix} 同日2`,
    `${prefix} 遅い`,
    `${prefix} なし`,
  ]);
  await page.getByLabel("並び順").selectOption("registered");
  await expect(titles).toHaveText([
    `${prefix} なし`,
    `${prefix} 遅い`,
    `${prefix} 同日1`,
    `${prefix} 同日2`,
  ]);
  await page.getByLabel("並び順").selectOption("due");
  await page.reload();
  await expect(page.getByLabel("並び順")).toHaveValue("registered");
  await page.getByLabel("タイトルを検索").fill(prefix);
  await expect(titles).toHaveText([
    `${prefix} なし`,
    `${prefix} 遅い`,
    `${prefix} 同日1`,
    `${prefix} 同日2`,
  ]);
});

test("期限順でステータスを絞り込むと一致するタスクだけが期限順に並ぶ", async ({ page }) => {
  await page.goto("/");
  const prefix = `status sort ${Date.now()}`;
  for (const [name, date] of [
    ["遅い", "2030-01-01"],
    ["早い", "2029-01-01"],
  ]) {
    await page.getByLabel("期限（任意）").fill(date);
    await addTask(page, `${prefix} ${name}`);
  }
  await page.getByRole("checkbox", { name: `${prefix} 早いを完了` }).click();
  await page.getByLabel("タイトルを検索").fill(prefix);
  await page.getByLabel("並び順").selectOption("due");
  await expect(page.locator(".task-title")).toHaveText([`${prefix} 遅い`]);
  await page.getByRole("checkbox", { name: "完了", exact: true }).check();
  await expect(page.locator(".task-title")).toHaveText([`${prefix} 早い`, `${prefix} 遅い`]);
});

test("期限順で期限を変更して保存すると一覧が新しい期限順に並ぶ", async ({ page }) => {
  await page.goto("/");
  const prefix = `edit sort ${Date.now()}`;
  for (const [name, date] of [
    ["先", "2029-01-01"],
    ["後", "2030-01-01"],
  ]) {
    await page.getByLabel("期限（任意）").fill(date);
    await addTask(page, `${prefix} ${name}`);
  }
  await page.getByLabel("タイトルを検索").fill(prefix);
  await page.getByLabel("並び順").selectOption("due");
  await page
    .locator("li")
    .filter({ hasText: `${prefix} 後` })
    .getByRole("button", { name: "編集" })
    .click();
  await page.getByLabel("期限を編集").fill("2028-01-01");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".task-title")).toHaveText([`${prefix} 後`, `${prefix} 先`]);
});
