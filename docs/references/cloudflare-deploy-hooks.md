# Workers Builds の Deploy Hooks（別リポジトリへの push からビルドを起こす）

- 取得日: 2026-11-28
- 出典: `https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/`, `https://developers.cloudflare.com/changelog/2026-04-01-deploy-hooks/`, `https://developers.cloudflare.com/api/resources/workers_builds/subresources/deploy_hooks/methods/trigger/`
- 関連: `../plans/active/diary-pipeline.md`（タスク 2）

Workers Builds は接続したリポジトリ（このリポジトリの `main`）への push でしかビルドしない。
日記の中継リポジトリへの push でサイトを作り直すには Deploy Hook を使う（2026-04-01 に Workers Builds でも使えるようになった）。

## 使い方（このプロジェクトが依存している部分）

- 作る: ダッシュボードの Workers & Pages → Worker → Settings → Builds → Deploy Hooks。名前とビルドするブランチを選ぶと URL が出る。
- 起こす: `POST https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<DEPLOY_HOOK_ID>`。**URL の ID そのものが認証**（API token は要らない）。
  リファレンスの curl の例には Bearer token が付いているが、本文は「認証不要、ID が秘密」と書いている。まず token 無しで試す。
- 秘密の扱い: URL を知っていれば誰でもビルドを起こせる。GitHub Actions の secret に入れ、リポジトリやログに出さない。
- 重複: 前のビルドが始まる前にもう一度叩くと、新しいビルドは作られず進行中のビルドが返る（連続 push で無駄にビルドが積まれない）。
- 確認: hook から起きたビルドは `build_trigger_source: "deploy_hook"` で記録される。応答の build UUID で状態とログを引ける。
- hook の作成・削除を API でやる場合は API token が要る（`/accounts/{account_id}/builds/workers/{script_name}/deploy_hooks`）。ダッシュボードで作るなら不要。
