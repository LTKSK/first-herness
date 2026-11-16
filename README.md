# AI Software Engineering Agent Harness — M1

AIエージェントの実装と評価を学ぶための題材アプリです。現在はM1として、React画面、Hono API、Docker上のMySQLによるタスクの作成・一覧・タイトル編集を実装しています。全体計画は [PROJECT.md](PROJECT.md) を参照してください。期限は任意の日付として設定でき、一覧・編集から確認・変更・解除できます。

## 必要な環境

- Node.js 26.13.1
- npm
- Docker Engine と Docker Compose
- E2EテストにはPlaywrightのChromiumと、そのOS依存ライブラリ
- レポートのテストと比較動画の生成にはFFmpegとffprobe

nvmを使う場合は、クリーンなチェックアウトで以下を実行します。

```sh
nvm install 26.13.1
nvm use 26.13.1
node --version
npm ci
npx playwright install chromium
# LinuxでブラウザーのOS依存ライブラリが不足する場合:
# npx playwright install-deps chromium
```

## 起動

MySQL を起動し、準備が整ったら別々のターミナルで API と画面を起動します。

```sh
docker compose up -d --wait
```

```sh
npm run dev:api
```

```sh
npm run dev
```

Viteが表示するURL（通常 http://127.0.0.1:5173）を開きます。APIは `127.0.0.1:3000` で動作し、Viteが `/api` をAPIへ転送します。MySQL は既定で `127.0.0.1:3306`、データベース・ユーザー・パスワードはそれぞれ `tasks`、`tasks`、`tasks` です。API は `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD` で接続先を変更できます。Compose の初期値は同じ変数と `MYSQL_ROOT_PASSWORD` で変更できます。これらはローカル開発用の設定です。初期化後のボリュームには環境変数の変更は反映されません。データは Docker ボリュームに保存され、コンテナや API を再起動しても残ります。停止は `docker compose down` を実行します。ボリュームの削除はデータを消去します。

既存 SQLite ファイルは読み込まず、空の MySQL データベースから開始します。

## 検証

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
```

`npm run format` でOxfmtを実行できます。LintにはOxlintを使います。APIテストとE2Eは、それぞれ独立した一時MySQLコンテナを起動して終了時に削除します。E2Eは専用ポート（API 31337、画面 4173）のサーバーを起動します。Dockerを利用できる権限とMySQL 8.0イメージが必要です。ポートが使用中なら起動に失敗します。テストは開発用DBを変更しません。

タスクは未完了で作成され、完了・未完了を切り替えられます。状態はDBに保存されます。一覧のステータスは1つ以上選択でき、画面を開くか再読み込みすると未完了のみが選択されます。タイトル検索は入力のたびに部分一致で絞り込み、英字の大文字小文字を区別しません。検索語の前後の空白を除き、ステータスの条件と併用します。再読み込みすると検索語は空に戻ります。

一覧は登録順と期限順を切り替えられます。期限順は近い日付から並び、未設定は最後、同じ期限は登録順です。再読み込み後は登録順に戻ります。

一覧の削除ボタンから確認後にタスクを完全削除できます。キャンセルすると削除されません。

期限は `YYYY-MM-DD` 形式の日付で、時刻は扱いません。既存のMySQLテーブルは初回起動時に期限列を追加し、既存タスクの期限を未設定にします。APIの `dueDate` は日付文字列または `null` です。作成時の省略は未設定、更新時の省略は変更なし、`null` は解除です。

APIは `GET /api/tasks`、`POST /api/tasks`、`PATCH /api/tasks/:id`、`DELETE /api/tasks/:id` を提供します。削除成功は204、存在しないIDは404を返します。タイトルは前後の空白を取り除き、空文字や不正なJSONを400で拒否します。存在しないIDへの更新は404を返します。

## M2: エージェントによる期限追加の試行

進行役がM1の固定コミット `34d4a9ee8bfe47194f0de08fd7dd608c8b0b5eee` から試行用Git worktreeを用意し、Codexアプリのサブエージェントに[課題](tasks/due-date.md)を渡します。実装者の差分と報告は `.harness/runs/` に保存します。評価は別のクリーンなworktreeに差分を適用し、チェックと評価者が用意したチェックで行います。元の作業領域には自動で適用しません。

試行と評価はローカルで行います。現在のテストには Docker が必要です。サブエージェントと評価者は同じホストのファイルにアクセスできるため、この段階では評価資産の秘匿を技術的に保証できません。`.harness/` には試行の変更やログが含まれるためGit管理しません。

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

## 仕様とテスト

[仕様とテストの一覧](tasks/index.html)から、各課題の仕様と対応するテストを確認できます。仕様や対応表を変更したときは `node tasks/build-index.mjs` でHTMLを更新します。

## StrykerJSによるテストの評価

評価用のクリーンな作業領域で、対象となる実装ファイルを指定します。実行にはDockerが必要です。対象を省略すると `frontend/src/search.ts` を調べます。

```sh
npm run test:mutation -- frontend/src/search.ts
npm run test:mutation -- backend/src/app.ts
npm run test:mutation -- --e2e frontend/src/App.tsx:100-120
# ブラウザーで既知の変異を実際に検出できるかを確認
npm run test:mutation:smoke
```

通常はVitestのAPI・単体テスト全体を実行します。`--e2e` はPlaywrightの画面テスト全体を実行するため、時間がかかります。画面に送る変異IDはテスト専用のVite設定でブラウザーに渡します。`ファイル:開始行-終了行` を指定すると対象を絞れます。どちらも専用MySQLとコピーしたコードを使い、並列数を1にします。画面テストは各変異の前に専用DBを初期化し、前の試行のデータによる誤判定を防ぎます。実行ごとに `.harness/mutation/` の別ディレクトリへ対象・候補・実行結果、JSONとHTMLを保存します。Strykerの一時コピーは `.stryker-tmp/` に作成し、Gitには含めません。

Strykerは終了コードにより変異を判定します。`Killed` は必ずしも期待した振る舞いのテストで検出されたことを意味しません。評価者はJSONの `statusReason` を確認し、対象テストの失敗、実行環境の問題、同等の振る舞いとなる変異を区別します。カバレッジ分析は無効で、未実行の変異を `NoCoverage` として区別できません。スコアは選んだファイルとテストに限られます。

Stryker 10のTypeScript設定処理はTypeScript 7で削除されたAPIを利用するため、設定ファイルのパス書き換えを行わない設定にしています。現在のTypeScript設定はリポジトリ内のファイルのみを参照します。外部への参照を追加する場合はこの設定を見直してください。依存関係の既知の脆弱性を避けるため、Strykerの `minimatch` と `typed-rest-client` の `qs` は修正済みバージョンへoverrideしています。Strykerの更新時には互換性と監査結果を再確認してください。
