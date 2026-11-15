# レビュー記録の形式

`viewer/prepare.mjs` はmanifestと別々の評価・修正JSONを読み、表示用 `report.json` を作ります。いずれも `formatVersion: 1` です。結果は `pass`、`fail`、`not_run`、`unknown`、`patch_error`、`environment_error` を使います。

## manifest

- `title`、`summary`、`baseline`、`candidate`: 機能の概要、基準と対象候補。`candidate` は最終候補のIDです。`candidateVersions` に修正前後の候補IDを列挙し、最終候補も含めます。
- `requirements`: `id`、`description`、`result`、`checks` の配列。各チェックは仕様書の確認項目IDと内容を含む `description`、確認方法と根拠を示す `evidence`、`result` を持ちます。テストで確認した場合は実際のテストケース名と実行結果を示します。テスト以外の方法で確認した場合は実施内容と確認先を示します。実行していないテストは成功にせず、仕様全体を確認できない場合は `unknown` にします。チェックなしや失敗・未実施のチェックを持つ仕様の `pass` は拒否します。
- `videos`: `kind`（`feature` と `annotated` を各1件）、`title` と `path`、`targetId` を持つ配列。パスはmanifestからの相対パスです。動画がない場合は `path` の代わりに `reason` を記載します。WebMとMP4をHTMLに埋め込みます。
- `evaluationFiles`、`revisionFiles`: 各記録のJSONファイルのパスの配列。manifestからの相対パスです。

## 評価と修正

評価は `recordType: evaluation`、`id`、`targetId`、`type`、`result`、`summary`、`findings` を持ちます。指摘には `id`、`summary`、`evidence` を記録します。修正は `recordType: revision`、`id`、`fromTargetId`（修正前）、`targetId`（修正後）、`summary`、`findingIds`、`reevaluationId` を持ちます。再評価が未実施なら `reevaluationId` はnullにします。IDは種類ごとに一意にします。候補の不一致や存在しない指摘・再評価の参照はエラーです。

形式の例は `examples/manifest.json`、`examples/evaluation.json`、`examples/revision.json` を参照してください。例の値は架空です。過去の記録は上書きせず、実行ごとに別のIDで保存します。
