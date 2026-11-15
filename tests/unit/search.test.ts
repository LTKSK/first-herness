import { describe, expect, it } from "vitest";
import { matchesTitle } from "../../frontend/src/search";

describe("タイトル検索", () => {
  it("英字の大小が異なる部分文字列を入力するとタイトルに一致する", () => {
    expect(matchesTitle("Prepare Report", "pArE rEp")).toBe(true);
    expect(matchesTitle("Prepare Report", "missing")).toBe(false);
  });

  it("検索語の前後に空白があると除去した語でタイトルに一致する", () => {
    expect(matchesTitle("買い物の準備", "  買い物  ")).toBe(true);
  });

  it("空文字または空白だけの検索語ではすべてのタイトルに一致する", () => {
    expect(matchesTitle("買い物", "")).toBe(true);
    expect(matchesTitle("買い物", " \t ")).toBe(true);
  });

  it("検索語の途中の空白はタイトルとの一致に必要となる", () => {
    expect(matchesTitle("AB CD", "b c")).toBe(true);
    expect(matchesTitle("ABCD", "b c")).toBe(false);
  });
});
