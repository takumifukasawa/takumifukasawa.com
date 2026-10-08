# site-and-lab — P0（lab と公開フロー）→ P1（サイト v0）

- 開始: 2026-10-08
- 状態: 計画中
- 関連: `../../decisions/0001-overall-architecture.md`, `0002`, `0003`, `0004`, `../../spec/site-v0.md`, `../../spec/publish-pipeline.md`, `../../spec/content-model.md`

## 目的（何ができれば完了か）

- **P0**: sketch 001 が `takumifukasawa.com/lab/001-<slug>/` で動き、poster / mp4 が R2 から配信され、X に投稿できる。sketch を 5〜10 件積み、schema を実データで直し終えている。
- **P1**: sketch 5〜10 件が載ったサイト（`/` と `/about/`）が `takumifukasawa.com` で公開されている。

**P0 ではサイトのページを 1 枚も作らない**（`spec/site-v0.md` のフェーズ表）。順序を逆にすると「サイトを作り込む」ほうに時間が流れる。

## 受け入れ条件（検査で確認できる形に）

P0:
- [ ] `pnpm new <slug> "<title>"` → `pnpm lab:add <slug> --video <path>` の 2 コマンド + push で 1 件公開できる（`spec/publish-pipeline.md` の受け入れ条件すべて）
- [ ] `takumifukasawa.com/lab/<slug>/` で作品が動き、左上に `/_shell.js` の導線が出る（`?clean` で消える）
- [ ] poster / mp4 が `media.takumifukasawa.com` から `Cache-Control: immutable` で配信される
- [ ] `harness check` に `lab build in sync` / `lab head in sync` / `media keys resolve` / `no large files` / `_shell.js` の grep 検査が登録され、pass する
- [ ] 「P0 で必ず実測するもの」（`../../handoff.md`）の全項目が実測され、書き戻し先に記録されている
- [ ] sketch が 5〜10 件ある

P1:
- [ ] `spec/site-v0.md` の受け入れ条件すべて（500 件ダミーでビルド 60 秒以内・`/` の初期転送 1.5 MB 以内を含む）
- [ ] `harness check` に `astro check` / `astro build` / `tag normalization` が追加され、pass する

## タスク分解（依存順）

AI との分担（`AGENTS.md`）: P0 のタスクはほぼ「任せる」（tooling / build / publish）。**sketch の中身（shader・数式・rendering）は自分で書く**。Cloudflare のアカウント操作は人間がやる。

| # | タスク | 担当 | 状態 | 備考 |
|---|---|---|---|---|
| 0-1 | `package.json`（pnpm）・`.nvmrc`・`.gitignore`（DCC 拡張子と理由のコメント込み） | AI | 済 | pnpm 11.28.5（`packageManager`）、Node 24。除外の正本は `.gitignore` |
| 0-2 | `media/manifest.json` に空の `{}` をコミット | AI | 済 | **無いと初回ビルドが落ちる**。0-1 と同じコミットでよい |
| 0-3 | `lab/core/AGENTS.md`（3 回ルール）と `lab/core/CLAUDE.md` | AI | 済 | `../../rules/README.md` に登録済み |
| 0-4 | `pnpm new <slug> "<title>"`: 雛形（canvas + rAF の最小、OGP、`/_shell.js` の 1 行、`vite.config.ts` は `base: './'`、絶対パス禁止と `?clean` の慣習をコメントで） | AI → 確認 | 未着手 | 雛形は「共同」寄り。生成物を見せて確認を取る |
| 0-4b | `pnpm dev:lab <slug>`: 作品 1 件を Vite で起動（HMR）。`/_shell.js` も配信して導線込みで見る。`--https`（mkcert）で LAN 内の実機から HTTPS で開ける（iOS のカメラ・ジャイロは HTTPS 必須） | AI | 未着手 | 作品ごとの `vite.config.ts` は増やさず、`dev:lab` 側で 1 か所だけ設定する |
| 0-5 | `pnpm lab:build <slug>` / `pnpm lab:rebuild --all`（失敗はスキップして古い成果物を残す）、`lab/.build-meta/<slug>.json` | AI | 未着手 | |
| 0-6 | `public/_shell.js`（左上のテキストリンク 1 つ。約束 6 項目）と `public/_headers`（`/_shell.js` は短い max-age） | AI | 未着手 | 決定 0004。見た目は P1 で決める |
| 0-7 | **Cloudflare**: `takumifukasawa.com` を Cloudflare DNS へ、R2 bucket 作成、custom domain `media.takumifukasawa.com`、Pages project 作成（設定値は `spec/site-v0.md` の表） | **人間** | 未着手 | `wrangler login` もここ。AI は手順書を出す。Pages のビルドが `packageManager` の pnpm 11 を使うか（使わなければ環境変数 `PNPM_VERSION`）を確かめる |
| 0-8 | `pnpm lab:add <slug> --video/--poster`: ffmpeg / sharp → R2 put（既存 key はスキップ）→ manifest 追記 → md 生成 → 成果物の `<head>` を md から書き直す → commit / push。`--dry-run` / `--no-push` | AI | 未着手 | 0-7 が前提 |
| 0-9 | P0 時点で最小の Astro を置く（`pnpm build` が通り `dist/` に `public/` が出るだけ。ページは作らない） | AI | 未着手 | Pages のビルドコマンド `pnpm build` を満たすため。**ページを作らない**原則は守る。あわせて `pnpm dev`（Astro の dev。`public/lab/` の成果物と `_shell.js` も見える）と `pnpm preview`（`pnpm build` → `wrangler pages dev dist`。`_headers` / `_redirects` / 末尾スラッシュまで本番に近い）を用意する。**どちらも `--https` で LAN 内の実機から開ける**（0-4b と同じ mkcert の証明書を使う。iPhone にルート証明書を入れるのは 1 回だけ） |
| 0-10 | `.harness/checks.sh` に P0 の検査を登録 | AI | 未着手 | 受け入れ条件の検査一覧 |
| 0-11 | **sketch 001 を作る** | **人間** | 未着手 | 技術的コアは自分で書く |
| 0-12 | P0 の実測（末尾スラッシュ・`_shell.js` の書き換え・`base: './'`・repo サイズ・Pages の差分アップロード・R2 Class B） | AI + 人間 | 未着手 | 結果は `../../handoff.md` の表の書き戻し先へ |
| 0-13 | **sketch を 5〜10 件積み**、schema を実データで直す | **人間** | 未着手 | 架空の 1 件で設計を固めない |
| 1-1 | Astro のページ: `/`（グリッド・年別）、`/about/`、`/404`、`/lab/` → `/` の 301 | AI → 確認 | 未着手 | フォント・配色・レイアウトはここで人間が決める |
| 1-2 | `_shell.js` の見た目を決める | 人間 + AI | 未着手 | sketch 数件を見ながら |
| 1-3 | sitemap / Cloudflare Web Analytics / OGP | AI | 未着手 | |
| 1-4 | 500 件ダミーで計測（ビルド時間・`/` の初期転送） | AI | 未着手 | 結果は `../../learnings.md` |
| 1-5 | `astro check` / `astro build` / `tag normalization` を検査に登録。`src/data/tech.ts` は 0-13 で実際に使った語から作る | AI | 未着手 | |

## 決定ログ（日付・決めたこと・理由・落選案）

- 2026-10-08: 決定 0001〜0004 を採用、spec 3 本に合意。計画を開始。
- 2026-10-08: pnpm は 11 系（11.28.5）。12 は 2026-08-26 リリースで 6 週間しか経っておらず、知見が少ない。Node は 24（Active LTS、2028-04 まで）。22 は 2027-04 で EOL になり 2 年の運用に足りない。
- 2026-10-08: P0 に最小の Astro（0-9）を入れる。Pages のビルドコマンド `pnpm build` を P0 から通すため。ページは作らない。落選案: P0 では Pages のビルドを「`public/` をそのまま出す」設定にする（P1 で設定を変えることになり、P0 で実測した Pages の挙動が P1 と変わる）。

## 進捗ログ（セッションごとに 1〜3 行）

- 2026-10-08: 計画を作成。0-1 / 0-2 を実施（`package.json` / `.nvmrc` / `.gitignore` / `media/manifest.json`）。依存はまだ入れていない（0-4 で Vite、0-9 で Astro）。
- 2026-10-08: 0-7 の一部。`takumifukasawa.com`（レジストラはお名前.com）を Cloudflare に追加（Free）、ネームサーバーを `carrera` / `kaiser.ns.cloudflare.com` に変更（DNSSEC はもともと無効）。旧 A レコード `160.16.82.214` は解約済みのさくら VPS の IP で、**再割り当て先の他人のサイトが表示されていた**ため削除した。Cloudflare の Active 待ち。残り: R2 バケット・custom domain・CORS・API トークン、Pages（0-9 の後）

## 未確定事項（人間の判断待ち）

- sketch 001 の題材（0-11）
