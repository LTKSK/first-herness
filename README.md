# AI Software Engineering Agent Harness — M1

AIエージェントの実装と評価を学ぶための題材アプリです。現在はM1として、React画面、Hono API、SQLiteによるタスクの作成・一覧・タイトル編集を実装しています。全体計画は [PROJECT.md](PROJECT.md) を参照してください。期限とハーネス自体はM2以降で扱います。

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

タスクは未完了で作成され、完了・未完了を切り替えられます。状態はDBに保存されます。既存DBのタスクは未完了として移行します。一覧のステータスは1つ以上選択でき、画面を開くか再読み込みすると未完了のみが選択されます。

APIは `GET /api/tasks`、`POST /api/tasks`、`PATCH /api/tasks/:id` を提供します。タイトルは前後の空白を取り除き、空文字や不正なJSONを400で拒否します。存在しないIDへの更新は404を返します。

## M2: エージェントによる期限追加の試行

進行役がM1の固定コミット `34d4a9ee8bfe47194f0de08fd7dd608c8b0b5eee` から試行用Git worktreeを用意し、Codexアプリのサブエージェントに[課題](tasks/due-date.md)を渡します。実装者の差分と報告は `.harness/runs/` に保存します。評価は別のクリーンなworktreeに差分を適用し、チェックと評価者が用意したチェックで行います。元の作業領域には自動で適用しません。

試行と評価はローカルで行い、DockerやAPIキーは必要ありません。サブエージェントと評価者は同じホストのファイルにアクセスできるため、この段階では評価資産の秘匿を技術的に保証できません。`.harness/` には試行の変更やログが含まれるためGit管理しません。

## M3: 評価の再実行

評価側の `.harness/evaluator/` には、評価を実行するスクリプトと評価用テストを保存しています。Git管理外のため、必要に応じてバックアップしてください。候補差分を指定すると、M1を基準とした一時worktreeを作り、依存関係の導入、型検査、Lint、テスト、評価用API・画面テストを実行します。結果と各チェックのログは指定した新規ディレクトリに保存されます。

```sh
node .harness/evaluator/evaluate.mjs "$PWD" "$PWD/.harness/runs/app-due-date-01/candidate.patch" "$PWD/.harness/evaluations/my-first-evaluation"
```

Chromiumの導入が必要です。Playwrightが既定外の場所にインストールされている場合は `PLAYWRIGHT_BROWSERS_PATH` を指定してください。出力ディレクトリにはまだ存在しない名前を指定します。判定は、全チェック成功の `pass`、チェック不合格の `fail`、差分の適用不能を示す `patch_error`、環境の問題を示す `environment_error` に分けます。環境エラーの分類はログの既知パターンに基づくため、判定が不明な失敗ではログも確認してください。評価は同一ホストで行い、評価用テストの秘匿は保証しません。

## スキル

Codexでは `agent-harness` スキルを使い、実装から評価までの手順を依頼できます。Claude Codeでは `/agent-harness` を使えます。両者は同じスキル本文を参照します。スキルの読み込み方法によっては新しいセッションで開始してください。

スキルは手順を提供します。試行用worktreeや評価用テストが自動で隔離されるわけではありません。`.harness/` の評価スクリプトや結果はGit管理外であり、新しいチェックアウトには含まれません。

## エージェントによる編集後のフォーマット

CodexとClaude Codeのhookは、編集操作の前後でGit管理対象と未追跡ファイルを比較します。変更された `.ts` と `.tsx` だけにOxfmtを実行します。ファイルの直接編集に加え、対象のシェル操作も確認します。Gitの除外対象は処理しません。Lintはこのhookでは実行しません。

利用前に `npm ci` を実行してください。Codexではプロジェクトを信頼したうえで、CLIの `/hooks` またはアプリの「Review hooks」からhookの内容を確認して信頼する必要があります。Claude Codeではプロジェクトの `.claude/settings.json` を使います。設定の反映には新しいセッションが必要な場合があります。

hookは対応するエージェントのツール操作で実行されます。hookが無効な場合や、対応していないツールや外部プロセスによる変更には適用されません。シェル操作は終了後に確認します。複数の変更が同時に走った場合、変更元を区別できないことがあります。確実に確認するときは `npm run format:check` を実行してください。hook自体は `npm run test:hooks` で検証できます。
