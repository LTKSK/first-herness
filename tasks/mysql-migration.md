# SQLite から Docker MySQL への変更

- 状態: 草案（既存データの扱いは回答済み）
- 対象: first-hernes, ec23eb78d3bd57b9be3a6b64a876f2ae9bd0fe7d
- 要求: databaseをsqliteからdockerで建てたmysqlに変更してほしい。agent-hernessを使って進めて。

## 目的と現状
既存のタスク管理アプリの永続化先を Docker 上の MySQL に変更する。baseline の backend/src/app.ts と server.ts は node:sqlite を利用し、API と E2E は個別の一時 SQLite DB を利用する。README.md にユーザーの未コミット変更があるため保持する。

## 振る舞い・受け入れ条件
- [AC-01] Docker Compose で MySQL を起動し、API は設定可能な接続先を使い、必要なテーブルを用意する。
- [AC-02] タスクの作成・一覧・更新・完了状態・削除と既存の入力検証、HTTP応答を維持する。
- [AC-03] API の再起動後も同じ MySQL のデータを読み出せる。
- [AC-04] API と E2E のテストは開発データから分離した MySQL を使用する。
- [AC-05] 起動、設定、テスト方法を README に記載する。
- [AC-06] 既存 SQLite データを取り込まず、新規の空の MySQL データベースで開始する。

## 判断・未決事項
既存 SQLite データは引き継がず新規の空データベースで開始する（ユーザー回答）。DB 資格情報は開発用の設定例と環境変数を使用する。既存の未コミット README は候補に混ぜない。
