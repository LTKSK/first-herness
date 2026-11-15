# レビュー用HTML

タスクごとの仕様とテスト結果、別々に記録した評価と修正、動画から単一HTMLを作ります。詳細な入力形式は [FORMAT.md](FORMAT.md) を参照してください。サンプルは架空の結果です。

## レポートを生成する

リポジトリのルートで、入力ファイルを用意して実行します。`viewer/examples/manifest.json` と評価・修正の例を出発点にできます。

```sh
node viewer/prepare.mjs <manifest.json> <report.json>
node viewer/build.mjs <report.json> <index.html>
```

仕様と実際のテストケース、その結果は実行結果を確認して記録します。成功とする条件のテストが足りない場合は未確認にします。`candidateVersions` に修正前後の候補IDを列挙します。評価・修正と指摘・再評価の対象が一致しない場合は生成に失敗します。動画のパスはmanifestからの相対パスです。未取得の場合は理由を記録します。

## 動画を撮影する

候補のコミット済みworktreeを指定し、タスク固有の操作シナリオを使います。`start({checkout})` は対象候補の環境を起動し、`url` と非同期の `stop` を返します。`run({page, note, annotated})` はPlaywrightで操作し、注釈を `note` で記録します。注釈付き動画を1本撮影します。撮影前にPlaywrightのChromiumをインストールしてください。

```sh
node viewer/record-scenario.mjs <候補worktree> <scenario.mjs> <出力ディレクトリ>
```

候補はクリーンなコミットで指定します。出力ディレクトリには存在しない名前を指定し、親ディレクトリは事前に作成してください。生成される `videos.json` の候補IDと動画のパスをmanifestに転記します。生成器は候補IDを比較しますが、シナリオが実際にその候補を起動したかまでは検証できません。操作と環境を確認してください。動画だけで全仕様の網羅性は保証できません。

`examples/title-search-scenario.mjs` はMySQLのテスト用DBを使う例です。候補で `npm ci` を実行し、専用の空DBと `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD` を用意してください。撮影ではタスクが作成されるため、開発用DBは使わないでください。

旧 `record.mjs` と `demo.mjs` はSQLiteを使った期限追加の過去の試行用です。旧結果を使う場合は、対象と各結果を確認し、新しい形式に手動で記録してください。

## UI変更の新旧比較

変更前と変更後をそれぞれクリーンなworktreeで用意し、同じ操作を行うシナリオをそれぞれ撮影します。UIの構造が変わった場合は、同等の操作を行う別々のシナリオを使えます。次のコマンドで左右に並んだ1本の動画を作ります。FFmpegが必要です。

```sh
node viewer/compare-videos.mjs <変更前のvideos.json> <変更後のvideos.json> <出力ディレクトリ>
```

出力ディレクトリは存在しない名前を指定します。左が変更前、右が変更後です。長さが異なる場合は短い方の最後の画面を表示し続けます。生成された `videos.json` の `baselineId` と `targetId` をmanifestの `baseline` と `candidate` に合わせて転記し、比較動画をHTMLに埋め込みます。

## テスト

FFmpegとffprobeをインストールしたうえで、`npm run test:viewer` でレポート生成のテストを実行します。`npm test` にも含まれます。
