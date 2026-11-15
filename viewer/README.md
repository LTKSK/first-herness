# 評価レポートの試作

期限追加の候補をPlaywrightで操作し、操作動画と注釈付き動画を作ります。評価結果と仕様・チェックの対応をJSONで用意し、動画を埋め込んだHTMLを生成します。形式は [FORMAT.md](FORMAT.md) を参照してください。

## 実行

Node.jsとnpmのほかに、候補のチェックアウトと、候補を対象に実行した評価結果が必要です。プロジェクトと候補の両方で `npm ci` を実行してください。PlaywrightのChromiumがなければ、プロジェクトのルートで `npx playwright install chromium` を実行します。

以下は期限追加の候補を使う例です。`<候補のworktree>` は候補差分を適用したチェックアウトの絶対パスに置き換えてください。動画と評価結果の対象が一致することを確認してください。

```sh
node viewer/record.mjs <候補のworktree> .harness/viewer-demo
node viewer/demo.mjs .harness/evaluations/calibration/reference-final/result.json .harness/viewer-demo
node viewer/build.mjs .harness/viewer-demo/report.json .harness/viewer-demo/index.html
```

生成された `index.html` は動画を含む単一ファイルです。`.harness/` はGit管理外です。`demo.mjs` は期限追加の評価結果に合わせたデモ用の変換です。仕様とテストの対応を汎用的に抽出する機能ではありません。

評価と修正を別ファイルに保存する形式は草案です。現在のビューアーは、それらを直接読み込まず、表示用の `report.json` を読み込みます。動画は実際のブラウザー操作を示しますが、動画だけで全仕様を確認するものではありません。
