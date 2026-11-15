# レポート形式の草案

評価と修正は別々の記録として保存します。評価や修正の実行ごとにIDを付けます。修正には対応する指摘のIDを記録します。過去の結果は上書きしません。

ビューアーは各記録を読み、表示に必要な情報を `report.json` にまとめてHTMLを生成します。現在の `report.json` は試作のための表示形式です。評価の実行結果を自動的に統合する処理は今後追加します。

## 表示データ

- `formatVersion`: 表示形式のバージョン。現在は `1`。
- `title`, `summary`: 機能の名前と概要。
- `baseline`, `candidate`: 実装の基準と評価対象。
- `videos`: `title`, `path`, `description` を持つ配列。`path` はJSONファイルからの相対パス。機能の動画と注釈付き動画を記録する。
- `requirements`: 仕様の配列。各仕様は `id`, `description`, `result`, `checks` を持つ。各チェックは説明、根拠、結果を持つ。仕様全体を検証できていない場合は `unknown` とする。
- `evaluations`: 評価の配列。各評価はID、名前、結果、概要、指摘を持つ。各指摘はID、内容、根拠を持つ。
- `revisions`: 修正の配列。各修正はID、修正内容、対応した指摘ID、再評価IDを持つ。

結果は `pass`, `fail`, `not_run`, `unknown`, `patch_error`, `environment_error` を使用します。未確認や未実施を成功として扱いません。参照する動画はHTMLに埋め込みます。現在はWebMとMP4に対応しています。

この草案では評価と修正の記録ファイル自体の詳細な形式は未確定です。仕様とテストの対応も評価ごとに人またはAIが確認する必要があります。

## 別々に保存する記録の例

`examples/evaluation.json` と `examples/revision.json` は架空の例です。評価の `findings[].id` を修正の `findingIds` が参照します。修正後の再評価は別の評価記録にし、そのIDを修正の `reevaluationId` に記録します。実データには `exampleOnly` を付けません。
