---
name: task-specification
description: Turn a short software task request into a reviewable specification by inspecting the selected baseline, identifying unresolved product decisions, and recording user decisions and acceptance criteria. Use when the user wants to define a task before implementation.
---

# タスクの仕様を作る

短い要求を、実装者と評価者が使える仕様にする。実装の前に人が仕様を確認できるようにする。

1. 要求文と対象のリポジトリ・ベースラインを記録する。既存の変更を保全する。画面、API、データ、テストを調べ、根拠となるファイルや対象コミットと一緒に現状をまとめる。選んだベースラインに未反映の候補を現状として扱わない。
2. 要求から決まること、現状から分かること、仮定、未決事項を分ける。影響のある点について既存データ、保存、画面操作、エラー、既存機能との関係を確認する。関係のない条件は追加しない。
3. ユーザーの期待や受け入れ条件に影響する未決事項を優先して質問する。既に回答されたことを再質問しない。必要に応じて選択肢と影響を簡潔に示す。実装上の自由度は残す。質問の数を抑え、回答が必要な判断を勝手に確定しない。
4. [assets/specification-template.md](assets/specification-template.md) を使い、要求、目的、現状、振る舞い、受け入れ条件、既存機能との関係、判断、未決事項を整理する。確認可能な仕様と受け入れ条件にIDを付ける。未確認の事項を確定事項として書かない。
5. ユーザーが決めた内容を反映し、実装と評価の開始に支障がないか確認する。前提、判断の理由、残る未決事項を記録する。仕様書の草案とその場所をユーザーに提示し、内容の確認を求める。質問への個別回答を仕様全体の確認とみなさない。明示的な確認を受けるまでは草案のままにし、実装と評価を開始しない。ユーザーが先に進めるよう明示した場合は、その指示に従う。

仕様書はリポジトリに保存し、一覧から参照できるようにする。このプロジェクトでは `tasks/` に置き、`tasks/build-index.mjs` の一覧を更新して `node tasks/build-index.mjs` でHTMLを生成する。草案と確定済みを区別する。 仕様と受け入れ条件の対応を仕様書に記載し、対応しない条件や未確認の範囲も示す。

仕様の作成とユーザーへの確認は進行役が直接行う。仕様作成は実装やコミットの許可を意味しない。
