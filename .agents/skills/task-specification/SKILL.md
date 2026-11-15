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
5. ユーザーが決めた内容を反映し、実装と評価の開始に支障がないか確認する。前提、判断の理由、残る未決事項を記録する。人が確認するまで草案と明記する。

サブエージェントとして依頼された場合は、要求を増やさず、現状と重要な確認事項を進行役に報告する。進行役は結果を確認し、ユーザーへの質問と回答を仲介する。仕様の確定後に実装を依頼された場合は、仕様作成を担当した同じサブエージェントが実装を担当する。仕様作成は実装やコミットの許可を意味しない。
