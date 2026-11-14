# AI Software Engineering Agent Harness — M1

Codex CLIの実装と独立した評価を学ぶための題材アプリです。現在はM1として、React画面、Hono API、SQLiteによるタスクの作成・一覧・タイトル編集を実装しています。全体計画は [PROJECT.md](PROJECT.md) を参照してください。期限とハーネス自体はM2以降で扱います。

## 必要な環境

- Node.js 22.13以上（Node.jsの組み込み `node:sqlite` を使用。実験的機能の警告が表示されます）
- npm
- E2EテストにはPlaywrightのChromiumと、そのOS依存ライブラリ

クリーンなチェックアウトで以下を実行します。

```sh
npm ci
npx playwright install chromium
# LinuxでブラウザーのOS依存ライブラリが不足する場合:
# npx playwright install-deps chromium
```

## 起動

別々のターミナルで実行します。

```sh
npm run dev:api
```

```sh
npm run dev
```

Viteが表示するURL（通常 http://127.0.0.1:5173）を開きます。APIは `127.0.0.1:3000` で動作し、Viteが `/api` をAPIへ転送します。既定のDBはルートの `tasks.sqlite` です。別の場所を使う場合は、API起動時に `DB_PATH=/path/to/tasks.sqlite npm run dev:api` のように指定します。親ディレクトリはあらかじめ作成してください。

## 検証

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
```

`npm run format` でOxfmtを実行できます。LintにはOxlintを使います。APIテストは一時DBを使用し、E2Eは一時DBと専用ポート（API 31337、画面 4173）のサーバーを起動します。ポートが使用中なら起動に失敗します。テストは開発用DBを変更しません。

APIは `GET /api/tasks`、`POST /api/tasks`、`PATCH /api/tasks/:id` を提供します。タイトルは前後の空白を取り除き、空文字や不正なJSONを400で拒否します。存在しないIDへの更新は404を返します。
