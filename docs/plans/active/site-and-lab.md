# site-and-lab — P0（lab と公開フロー）→ P1（サイト v0）

- 開始: 2026-10-08
- 状態: 計画中
- 関連: `../../decisions/0001-overall-architecture.md`, `0002`, `0003`, `0004`, `../../spec/site-v0.md`, `../../spec/publish-pipeline.md`, `../../spec/content-model.md`

## 目的（何ができれば完了か）

- **P0**: 最初の sketch が `takumifukasawa.com/lab/<slug>/` で動き、poster / mp4 が R2 から配信され、X に投稿できる。sketch を 5〜10 件積み、schema を実データで直し終えている。
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
| 0-1 | `package.json`（pnpm）・`.node-version`・`.gitignore`（DCC 拡張子と理由のコメント込み） | AI | 済 | pnpm 11.28.5（`packageManager`）、Node 24.21.0（`.node-version`。nodenv と Pages の両方が読む）。除外の正本は `.gitignore` |
| 0-2 | `media/manifest.json` に空の `{}` をコミット | AI | 済 | **無いと初回ビルドが落ちる**。0-1 と同じコミットでよい |
| 0-3 | `lab/core/AGENTS.md`（3 回ルール）と `lab/core/CLAUDE.md` | AI | 済 | `../../rules/README.md` に登録済み |
| 0-4 | `pnpm new <slug> "<title>"`: 雛形（canvas + rAF の最小、OGP、`/_shell.js` の 1 行、`vite.config.ts` は `base: './'`、絶対パス禁止と `?clean` の慣習をコメントで） | AI → 確認 | 済 | 2026-10-08 に動作を確認してもらった。雛形は「共同」寄り。`scripts/new.ts` と `scripts/templates/sketch/`。生成物を見せて確認を取る |
| 0-4b | `pnpm dev:lab <slug>`: 作品 1 件を Vite で起動（HMR）。`/_shell.js` も配信して導線込みで見る。`--https`（mkcert）で LAN 内の実機から HTTPS で開ける（iOS のカメラ・ジャイロは HTTPS 必須） | AI | 一部済 | `scripts/dev-lab.ts`。HMR と `/_shell.js` の配信は確認済み。`--https` は未確認（mkcert のルート証明書の登録に sudo が要るため、初回は人間が実行する） |
| 0-5 | `pnpm lab:build <slug>` / `pnpm lab:rebuild --all`（失敗はスキップして古い成果物を残す）、`lab/.build-meta/<slug>.json` | AI | 済 | 一時ディレクトリに出し、成功時だけ差し替える。md からの `<head>` 書き直しは 0-8 で足す | |
| 0-6 | `public/_shell.js`（左上のテキストリンク 1 つ。約束 6 項目）と `public/_headers`（`/_shell.js` は短い max-age） | AI | 済 | 決定 0004。見た目は P1 で決める |
| 0-7 | **Cloudflare**: `takumifukasawa.com` を Cloudflare DNS へ、R2 bucket 作成、custom domain `media.takumifukasawa.com`、**Workers project 作成**（設定値は `spec/site-v0.md` の表） | **人間** | 済 | 2026-10-11 完了。Pages ではなく Workers Static Assets（新規作成の入口が無かった）。`takumifukasawa.com` が応答する。pnpm 11 / Node 24 は環境変数なしで検出されたので `PNPM_VERSION` は不要だった |
| 0-8 | `pnpm lab:add <slug> --video/--poster`: ffmpeg / sharp → R2 put（既存 key はスキップ）→ manifest 追記 → md 生成 → 成果物の `<head>` を md から書き直す → commit / push。`--dry-run` / `--no-push` | AI | 一部済 | `scripts/lab-add.ts`。`--dry-run` で ffmpeg / sharp / md / manifest まで確認済み。**R2 への実 put・commit・push は未確認**（`.env` が埋まってから、`lab/greeble/` で初回実行して確かめる） |
| 0-9 | P0 時点で最小の Astro を置く（`pnpm build` が通り `dist/` に `public/` が出るだけ。ページは作らない） | AI | 済 | Pages のビルドコマンド `pnpm build` を満たすため。**ページを作らない**原則は守る。あわせて `pnpm dev`（Astro の dev。`public/lab/` の成果物と `_shell.js` も見える）と `pnpm preview`（`pnpm build` → `wrangler pages dev dist`。`_headers` / `_redirects` / 末尾スラッシュまで本番に近い）を用意する。**どちらも `--https` で LAN 内の実機から開ける**（0-4b と同じ mkcert の証明書を使う。iPhone にルート証明書を入れるのは 1 回だけ）。`astro.config.ts` / `scripts/preview.ts`。http で確認済み、`--https` は 0-4b と同じく未確認 |
| 0-10 | `.harness/checks.sh` に P0 の検査を登録 | AI | 済 | `tests green (>0)` / `lab build in sync` / `lab shell embedded` / `no large files` / `lab head in sync` / `media keys resolve`（すべて pre-commit で走る）。`astro check` / `astro build` と `src/` の grep は P1（1-5） |
| 0-11 | **sketch を 1 件作って公開まで通す** | **人間** | 着手中 | 1 本目（mirror-sphere）は**出さないと決めて `lab-archives/` へ棚上げ**した（決定 0006）。いまは `lab/greeble/`（題材は greeble。人間の決定）。技術的コアは自分で書く（決定 0005） |
| 0-12 | P0 の実測（末尾スラッシュ・`_shell.js` の書き換え・`base: './'`・repo サイズ・**差分アップロード**・R2 Class B） | AI + 人間 | 一部済 | 2026-10-11: 差分アップロードは**される**、ビルド 48 秒、`_headers` は Workers でも効く（`../../references/cloudflare-limits.md`）。残りは sketch を 1 件公開しないと測れない |
| 0-13 | **sketch を 5〜10 件積み**、schema を実データで直す | **人間** | 未着手 | 架空の 1 件で設計を固めない |
| 1-1 | Astro のページ: `/`（グリッド・年別）、`/about/`、`/404`、`/lab/` → `/` の 301 | AI → 確認 | 一部済 | **`/` の暫定版は P0 で置いた**（2026-10-11）。残りは年別セクション・カードのフォールバック表・`/about/`・`/404`・301。フォント・配色・レイアウトはここで人間が決める |
| 1-2 | `_shell.js` の見た目を決める | 人間 + AI | 未着手 | sketch 数件を見ながら |
| 1-3 | sitemap / 計測 / OGP | AI | 一部済 | **計測は P0 で入れた**（GA4 `G-L3EDWSFJ82`。2026-10-11）。残りは sitemap と OGP |
| 1-4 | 500 件ダミーで計測（ビルド時間・`/` の初期転送） | AI | 未着手 | 結果は `../../learnings.md` |
| 1-5 | `astro check` / `astro build` / `tag normalization` を検査に登録。`src/data/tech.ts` は 0-13 で実際に使った語から作る | AI | 未着手 | |

## 決定ログ（日付・決めたこと・理由・落選案）

- 2026-10-08: 決定 0001〜0004 を採用、spec 3 本に合意。計画を開始。
- 2026-10-08: pnpm は 11 系（11.28.5）。12 は 2026-08-26 リリースで 6 週間しか経っておらず、知見が少ない。Node は 24（Active LTS、2028-04 まで）。22 は 2027-04 で EOL になり 2 年の運用に足りない。
- 2026-10-08: 雛形のループは takumifukasawa/html-game-template と同じ構造にする（`TimeAccumulator` で fixedUpdate を 60Hz 固定、`TimeSkipper` で update / render を 60fps に制限。pixel ratio は `Math.min(window.devicePixelRatio, 1.5)`）。2 ファイルは `lab/core/` ではなく**作品ごとにコピー**する。理由: 成果物は作品ごとに固まる（決定 0001）ので、core の変更が `lab:rebuild --all` で古い作品の挙動を変えるのを避ける。作品ごとに書き換えられる。落選案: `lab/core/` に置く（上記の理由に加え 3 回ルールに反する）、`AppBase` ごと持ち込む（分析用フックはゲーム用で不要）。
- 2026-10-08: 作品のコードは **class を使わない**（状態はプレーンなオブジェクト + 関数。tree-shaking のため）。`time/` の 2 ファイルも関数に書き直した。ビルドは **terser でプロパティ名まで mangle**（`keep_quoted`。PaleGL と同じ方針）し、modulePreload の polyfill を切る（雛形のバンドル 1565 → 895 バイト）。コードの書き方の規約は `docs/coding.md` に置き、`lab/AGENTS.md` からはそこを読むように指示するだけにした。落選案: Vite 既定の minifier（Oxc）のまま（PaleGL と同じ terser の設定と挙動を使い回せない）、プロパティを `_` 接頭辞だけ mangle（class 前提の方式で、関数ベースでは効きが小さい）。
- 2026-10-08: P0 に最小の Astro（0-9）を入れる。Pages のビルドコマンド `pnpm build` を P0 から通すため。ページは作らない。落選案: P0 では Pages のビルドを「`public/` をそのまま出す」設定にする（P1 で設定を変えることになり、P0 で実測した Pages の挙動が P1 と変わる）。

- 2026-10-11: 配信を Cloudflare Pages ではなく **Workers Static Assets** にする。ダッシュボードから Pages の新規作成の入口が消えていたため、決定 0001 の逃げ道 2 をそのまま発動した。要ったのは `wrangler.jsonc` 1 枚と `pnpm preview` の 1 行で、ビルドも URL も成果物も変わらない。**静的アセットのリクエストは無料・無制限**（Worker スクリプトを持たない構成なので Workers Free の 10 万リクエスト/日 に掛からない）ことを出典で確認し、「バズっても構造的に $0」が維持されることを確かめてから採った。落選案: Pages の既存 project を別経路で作れないか探す（入口が無い以上、見つかっても将来の受付停止を先送りするだけ）、`wrangler deploy` を手元から叩いて git 連携を使わない（push ごとの自動 deploy を失う）。
- 2026-10-11: カスタムドメインは `wrangler.jsonc` の `routes` に書かず、ダッシュボードで割り当てる。CI（Workers Builds）のトークンに zone の編集権が無く、`routes` に `custom_domain: true` を書くと deploy が落ちるため。落選案: `routes` に書いて再現性を取る（初回 deploy が失敗する側に倒れる）。
- 2026-10-11: `www` は作らない（apex のみ）。sketch の URL を短く保つ方針（決定 0002）と揃える。必要になったらリダイレクトで足せる。

- 2026-10-11: **P0 でも `/` の 1 枚だけは作る**ことにした（`spec/site-v0.md` を改めた）。ドメインが 404 を返し続けるのが落ち着かないのと、sketch を出すなら同時に一覧が要るため。作り込まない原則は変えず、暫定版（グリッド・正方形カード・`draft` 除外・日付降順）に留め、フォント・配色・レイアウトは P1（1-1）で決める。落選案: 404 のまま待つ、`public/` に静的な「準備中」HTML を置く（content collection に繋がらず作り直しになる）。

- 2026-10-11: 計測を **Cloudflare Web Analytics から Google Analytics 4 に変更**し、P1 ではなく P0 で入れた（`spec/site-v0.md` の「計測」）。作品ページには `_shell.js` 経由で載せる（決定 0004 の追記）。成果物をコミットする方式なので、作品側に直接足すと全件の再ビルドが要るため。落選案: Cloudflare Web Analytics のまま（Cookie 不要で軽いが流入元の粒度が粗い）、両方入れる（必要になってから足せる）、作品ページには入れずトップだけ計測する（どの sketch が見られたか分からず、入れる意味が半減する）。

- 2026-10-14: **デバッグ画面（Tweakpane）は既定で出さず、URL に `?debug` が付いているときだけ出す**ことにした（`spec/publish-pipeline.md` の雛形生成の行、`lab/greeble-flow/debug.ts`、`scripts/templates/sketch/main.ts`）。理由: 作品を公開するとノブが訪問者に見えるのと、録画のたびにフラグを付け忘れると写ること。opt-in なら何も付けない側が常に正しい絵になる。落選案: `?clean` で隠す従来方式のまま（付け忘れが残る。`?clean` はサイトへの導線を隠すフラグで、pane と抱き合わせにする理由が無い）、dev だけ既定で出す（dev と本番で挙動が変わり、いま何を見ているのか分からなくなる）。

- 2026-10-15: **`/` の OGP を P1 から前倒しして入れた**（`src/pages/index.astro`）。`og:image` は**最新の公開 sketch の `poster`、無ければ出さない**。落選案: 既定の OGP 画像を 1 枚作る（poster は録画の後にしか存在しないので、同じ作品の 2 枚目の絵を別の作り方・別の比率・別の置き場で持つことになり、しかも効くのは公開 0 件の間だけ＝1 件目を出した日に死ぬ）、画像を諦めてタグだけ入れる（`lab:add` の直後から絵が出せるのに捨てる理由が無い）。**トップの URL を人に貼るのは `greeble-flow` を公開した後**（X はカードを永久にキャッシュする。`learnings.md` 2026-10-08）。

## 進捗ログ（セッションごとに 1〜3 行）

- 2026-10-08: 計画を作成。0-1 / 0-2 を実施（`package.json` / `.nvmrc` / `.gitignore` / `media/manifest.json`）。依存はまだ入れていない（0-4 で Vite、0-9 で Astro）。
- 2026-10-08: 0-7 の一部。`takumifukasawa.com`（レジストラはお名前.com）を Cloudflare に追加（Free）、ネームサーバーを `carrera` / `kaiser.ns.cloudflare.com` に変更（DNSSEC はもともと無効）。旧 A レコード `160.16.82.214` は解約済みのさくら VPS の IP で、**再割り当て先の他人のサイトが表示されていた**ため削除した。Cloudflare の Active 待ち。残り: R2 バケット・custom domain・CORS・API トークン、Pages（0-9 の後）
- 2026-10-08: 0-9 を実施。Astro 7.3.6 + wrangler 4.148.0。Astro 7.3.7 は公開 1 日未満で pnpm 11 の `minimumReleaseAge` に止められたため、除外設定を足さず 7.3.6 にした。esbuild / workerd の install script は `pnpm-workspace.yaml` の `allowBuilds` で許可。Astro dev は `public/**/index.html` をディレクトリ URL で返さないため、`astro.config.ts` に dev 用の middleware を足した（dev では末尾スラッシュ無しは 404 のまま。リダイレクトは preview で見る）。`pnpm preview` では `/lab/<slug>` → `/lab/<slug>/` が **308**、`/_shell.js` に `_headers` の `Cache-Control: public, max-age=300` が付くことを確認（本番の実測は 0-12）。
- 2026-10-08: 0-10 の一部。検査の本体は `scripts/lib/checks.ts`（`node scripts/check.ts <name>` で 1 つずつ走る）、テストは `node:test`（`pnpm test`、`scripts/**/*.test.ts`）。あわせて `sourceHash` を `git ls-files`（tracked + 未追跡のうち ignore されないもの）に変えた。ディレクトリを素で歩くと Finder が作る `.DS_Store` でハッシュが変わり、手元だけ落ちて fresh clone では通る食い違いが出るため。
- 2026-10-08: 0-7 の続き。Cloudflare で `takumifukasawa.com` が Active になった（DNS Setup: Full）。次は R2（バケット・custom domain・CORS・API トークン）
- 2026-10-08: 0-7 の R2 分が済。バケット `takumifukasawa-media`、custom domain `media.takumifukasawa.com`（TLS 有効、R2 が応答することを curl で確認）、r2.dev は無効、CORS は `AllowedOrigins: ["*"]` / GET・HEAD（開発時の入口が dev:lab 5173 / dev 4321 / preview 8788 / `--https` の LAN IP とばらばらで許可リストが必ず漏れる。公開メディアの読み取りだけなので `*` で失うものが無い。落選案: 本番ドメイン + localhost だけを許可）。API トークン `takumifukasawa-media-lab-add`（Object Read & Write、このバケットのみ）は人間の手元に保管し、0-8 で `.env` に入れる。残り: Pages
- 2026-10-08: 0-8 の大半と 0-10 の残り。`lab:add`（aws4fetch で R2 の S3 API に署名、yaml、sharp）、`src/content.config.ts`（content-model の lab だけ。生成した md が `astro build` を通り、壊れた md で落ちることを確認）、`.env.example` と `docs/setup.md`（`.env` はマシンごとに要る、を 3 か所に書いた: `.env.example` の冒頭・setup.md・`lab:add` のエラー文）。`lab:build` も最後に md から `<head>` を書き直す。テスト 25 件
- 2026-10-08: `.env` を人間が記入。`lab:add` と同じ関数で R2 の `_test/` に put → `media.takumifukasawa.com` から 200（`Cache-Control: immutable`、CORS `*`）→ DELETE まで通ることを確認し、テスト用ファイルは消した。`.webp` は CDN にキャッシュされる（MISS → HIT）。`.txt` はされない（`../../learnings.md`）

- 2026-10-11: sketch mirror-sphere を制作したが**出さないと決め**、`lab-archives/` へ棚上げ（決定 0006）。あわせて決定 0005（AI にどこまで書かせるか）を記録
- 2026-10-11: **sketch の識別子から連番を外した**（決定 0007）。`lab/<slug>/`。きっかけは 0006 で「棚上げした sketch が番号を持ち続けるか」の判断が同じ日に 2 回変わったこと。前提に戻ると、索引の並びは `date`、一意性はディレクトリ名で、番号はどちらも担っていなかった。公開済み sketch が 0 件＝ URL を変えられる最後の地点だったので、ここで決めた。`numberOwner()` は削除
- 2026-10-11: 0-7 完了。**Pages ではなく Workers Static Assets** で公開（上の決定ログ）。`takumifukasawa.com` が応答するようになった（それまでは旧 A レコード削除後、向き先が無く NXDOMAIN だった）。`/_shell.js` は 200 + `max-age=300`、`/` は 404（P0 はページ 0 枚なので正常）。初回ビルド 48 秒、差分アップロードは**される**。残った宿題 2 件は `../../tech-debt.md`（workers.dev の本番 URL を塞ぐ / Always Use HTTPS）
- 2026-10-14: `wip` を **`greeble-flow`** に改名し、**現状を完成形とした**（人間の判断）。`params.json` の `flowGlow = 0`（発光オフ）は意図どおり。残っていた 3 件（床の読みやすさ / `flowExtent` の自動決定 / CPU→GPU 転送）は保留。**`greeble` は没**にして決定 0006 の手順で `lab-archives/greeble/` へ棚上げ（`public/lab/greeble/` と `lab/.build-meta/greeble.json` は削除）。これで `lab:add` の本番初回は `greeble-flow` になった。あわせてデバッグ画面を `?debug` 方式に変更し、`docs/learnings.md` に 1 件（Windows で `strictPort` が古い dev サーバーを検知しない）。`harness check` は pass=9 fail=0。
- 2026-10-15: **`greeble-flow` を公開**（撮影モード `?capture` の静止画を poster に。`lab:add` の本番初回。git commit だけ pre-commit のテストのバグで落ち、直した）。サイトに `/about/`（事実だけ）・共通レイアウト・プロフィールのリンク・M PLUS 1 Code を入れ、作品のカードを同じタブにした。ハーネスを 0.11.1 に。`tests green` が `FORCE_COLOR` で誤判定するのを直した。いずれも spec / learnings に書き戻し済み。

## 未確定事項（人間の判断待ち）
