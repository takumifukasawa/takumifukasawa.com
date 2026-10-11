# site v0 — 最初に公開するもの

- 状態: 合意済（2026-10-08）
- 関連: `../decisions/0001-overall-architecture.md`, `content-model.md`, `publish-pipeline.md`

## 目的

**sketch を止めないための最小のハブを公開する。** v0 の成功条件はサイトの完成度ではなく、
「この後 2 年、1 件公開するのに迷いと手戻りが無い」状態になっていること。

## フェーズ（順序が重要）

サイトのページより **`lab/` と公開フローを先に立てる**。ページが無くても sketch は X に投稿できるが、
sketch が無いサイトには載せるものが無い。順序を逆にすると「サイトを作り込む」ほうに時間が流れる。

| Phase | 範囲 | 完了の条件 |
|---|---|---|
| **P0** | `lab/` の雛形 + `pnpm new` / `pnpm lab:add` + R2 + `media.takumifukasawa.com` + Pages | sketch 001 が `takumifukasawa.com/lab/001-flow-field/` で動き、poster/mp4 が R2 から配信され、X に投稿できる |
| **P1** | サイト v0（この doc の範囲）。**2 ページだけ** | sketch 1〜10 件程度が載ったサイトが `takumifukasawa.com` で公開されている |
| **P1.5** | Notes 一式（`/notes/` + 記事ページ + MDX + Shiki + KaTeX + RSS） | **最初の記事を書きたくなった時に作る**。1 セッションで足りる |
| **P2** | `/lab/` 索引の分離 / 日付密度グリッド / サイト内 embed（iframe のクリックロード）/ Works ページ / tag 一覧 / 動的 OGP | （別 spec） |
| **P3** | 英語対応 / AI による metadata 生成 / X 連携の自動化 | （別 spec） |

P0 は**サイトのページを `/` の 1 枚だけに留める**（残りは `lab/` と公開フローとデプロイ）。P0 の最中に sketch を 5〜10 件積んでから P1 に入る
（schema は実データ 5 件を通すまで必ず間違っているので、架空の 1 件で設計を固めない）。

**2026-10-11 に「P0 ではページを 1 枚も作らない」を緩めた。** 理由は 2 つ。ドメインが 404 を返す状態が
続くこと自体が落ち着かないのと、sketch を出すなら**同時に一覧が無いと出した意味が薄い**（X に動画を上げても
戻り先が無い）。緩めたのは枚数だけで、**作り込まない原則は変えていない**: `/` は暫定で、フォント・配色・
レイアウトは P1（1-1）で sketch 5〜10 件を見てから決める。落選案: 404 のまま P1 まで待つ（sketch を出した
瞬間に一覧が要るので、結局このタイミングで作ることになる）、静的な「準備中」HTML を `public/` に置く
（content collection に繋がらないので、sketch を出したときに作り直しになる）。

## P1 の範囲（作るページ）

| URL | 内容 |
|---|---|
| `/` | **全 sketch のグリッド。これが索引も詳細も兼ねる。** 年別セクション（`/#2026`）。カードは正方形固定 + `object-fit: cover`（縦横混在でも崩れない）。カードに出すのは `title` / `date` / `tags`。**クリックで別タブに実物を開く**（下記）。**P0 で暫定版を置いた**（`src/pages/index.astro`。グリッド・正方形カード・`draft` 除外・日付降順まで。年別セクションと下のフォールバック表は P1） |
| `/about/` | 自己紹介・やっていること・Links / Contact・PaleGL へのリンク |
| `/404` | |

### カードのクリック先はフォールバックで決まる

詳細ページを作らない。全部「**別タブで原寸を開く**」という同じ挙動にするので、JS が要らない。

| 条件 | 行き先 |
|---|---|
| `public/lab/<NNN-slug>/index.html` がある | `takumifukasawa.com/lab/<NNN-slug>/`（実物が動く。同一ドメインだが別タブで開く） |
| 無く `externalUrl` がある | その URL（独立 repo の作品。決定 0003） |
| 上のどちらも無く `video` がある | `media.takumifukasawa.com/.../clip.mp4`（ブラウザのプレイヤー） |
| いずれも無い | `media.takumifukasawa.com/.../poster.webp` |

人に特定の作品を見せるリンクも `takumifukasawa.com/lab/...` になるので、**OGP は作品の `index.html` 雛形**に入れておく（自動で付く）。
サイト側の OGP は `/` と `/about/` だけで足りる（X には動画を直接アップロードする方針なので、サイトの URL を貼らない）。

### Cloudflare Workers の設定値（P0 で入れる）

**Pages ではなく Workers Static Assets を使う。** 2026-10-11 の時点で Cloudflare のダッシュボードに Pages の
新規作成の入口が無く、決定 0001 が逃げ道として用意していた「同じ `dist/` を Workers Static Assets へ移す」が
そのまま発動した。配信するものは変わらない（`astro build` の `dist/`）。

配信側の設定の正本は **リポジトリの `wrangler.jsonc`**（assets のディレクトリ・末尾スラッシュ・404 の扱い）。
ダッシュボードに入れるのは、リポジトリに書けないものだけ。

| 項目 | 値 |
|---|---|
| Project name | `takumifukasawa-com`（`wrangler.jsonc` の `name` と一致。**後から変えられない**） |
| Build command | `pnpm build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler versions upload`（`npx wrangler preview` は wrangler 4 に無い） |
| Enable Preview builds | on（PR のプレビュー URL） |
| Protect with Cloudflare Access | off（公開サイト） |
| Production branch | `main` |
| 環境変数 | `NODE_VERSION=24.21.0` / `PUBLIC_MEDIA_BASE_URL=https://media.takumifukasawa.com` |
| Custom domain | `takumifukasawa.com`（apex のみ。ダッシュボードで割り当てる。DNS レコードは Cloudflare が自動で作る） |

カスタムドメインを `wrangler.jsonc` の `routes` に書かないのは、CI の Workers Builds トークンに zone の
編集権が無く、deploy が落ちるため（理由は `wrangler.jsonc` のコメントにも書いてある）。

### 計測 — Google Analytics 4（2026-10-11 に Cloudflare Web Analytics から変更）

測定 ID `G-L3EDWSFJ82`。**秘密ではない**（HTML に出る）ので repo に直接書く。

入れる場所が 2 つあるのは、**性質の違う HTML が 2 種類ある**ため。

| | 実体 | 入れ方 |
|---|---|---|
| `/` | Astro が生成 | `src/pages/index.astro` の `<head>` に gtag スニペット |
| `/lab/<slug>/` | 作品のビルド成果物（コミット済み。再ビルドしないと変わらない） | **`public/_shell.js` から読み込む**（決定 0004 の追記） |

作品側を `_shell.js` に載せるのは、**再ビルド無しで全作品に行き渡る**から。発火条件（`?clean` でも計測する等）は
決定 0004 の表が正。**測定 ID は 2 か所に書いてある**ので、変えるときは両方直す（互いにコメントで参照している）。

Cloudflare Web Analytics から変えた理由は、見たい数字（流入元・リアルタイム・イベント）が GA の方が揃っていること。
**代わりに払うもの**: GA は Cookie を使うので、EU からのアクセスを気にするなら同意バナーが要る側に倒れる。
`googletagmanager.com` への third-party リクエストも作品ページごとに 1 本増える。落選案: Cloudflare Web Analytics の
まま（Cookie なし・1 行で軽いが、流入元の粒度が粗い）、両方入れる（いつでも足せるので、必要になってからでよい）。

**未確認**: GA に実際にヒットが届くかは本番で `リアルタイム` を見て確かめる。ローカルでの確認では
`gtag/js` の取得（200）と `gtag('config')` の実行までは見えたが、**collect のリクエストはブラウザ拡張に
ブロックされていた**（計測ブロッカーを入れている閲覧者には届かない、という当たり前のことでもある）。

### プレビュー URL（実機確認に使う）

PR を出すと Workers Builds が **2 種類**の URL を払い出す（PR にコメントで貼られる）。どちらも
`X-Robots-Tag: noindex` が付くので、検索エンジンには拾われない。

| | 形 | 性質 |
|---|---|---|
| Branch Preview | `<branch>-takumifukasawa-com.<subdomain>.workers.dev` | **ブランチ名で安定。push するたび中身が入れ替わる** |
| Commit Preview | `<hash>-takumifukasawa-com.<subdomain>.workers.dev` | コミットごとに固有。その時点の中身が残る |

**スマホでの確認は Branch Preview を使う。** URL が変わらないので、一度開いておけば push するたびに
リロードするだけで済む（mkcert と `--https` を使う `pnpm dev:lab --https` の代わりに、LAN の外からでも見られる）。

本番の `takumifukasawa-com.<subdomain>.workers.dev` は `wrangler.jsonc` の `"workers_dev": false` で塞いである
（`takumifukasawa.com` と同じ中身を返す 2 つ目の URL を作らないため）。プレビューが道連れにならないよう、
`"preview_urls": true` を同時に明示している。**片方だけ消すと実機確認の手段を失う。**

**`pnpm build` は作品をビルドしない**（Astro だけ。作品は `public/lab/` に成果物が入っている。決定 0001）。
Worker スクリプトも置かない（assets だけの Worker）。全リクエストに Worker を通すのは決定 0004 が退けた形。

### P1 に入れる機能（ページ以外）

- sitemap.xml
- ~~Cloudflare Web Analytics~~ → **Google Analytics 4**（`G-L3EDWSFJ82`）。**2026-10-11 に P0 で入れた**（下記）
- OGP（`astro.config` の `site` 設定 + `poster` を `og:image` に使う）
- 作品ページの導線（`public/_shell.js`）の見た目を決める。P0 の間は左上のテキストリンク 1 つ（決定 0004）

### P1 で作らないもの（意図的に削ったもの）

| 削ったもの | 理由 | 行き先 |
|---|---|---|
| **sketch の詳細ページ**（`/lab/<slug>/`） | 直リンクで足りる。紹介文を書く義務を作らない。失うのは sketch 単位の OGP と検索流入だが、前者は X に動画直上げなので実害なし、後者は**500 件の薄いページ量産は SEO 的にも不利**（thin content）なので妥当 | P2。**`/lab/<slug>/` は作品そのものが使っているので、同じ URL に置くには決定 0004 の (B)（作品を iframe で包む）へ乗り換える**。乗り換えは `git mv` で済み、共有済みの URL は壊れない |
| `/lab/` の索引ページ | `/` が索引を兼ねれば足りる | P2 |
| 日付密度グリッド | sketch 10 件で出すと空白だらけで逆効果。50 件くらい溜まってから意味が出る | P2 |
| Notes 一式（記事ページ / MDX / Shiki / KaTeX / RSS） | 記事が 0 本の段階で記事基盤を作るのは早い。空ページができるだけ。書く対象の sketch が溜まってから作る | P1.5 |
| Works の一覧・詳細ページ | 代表作が出来てから。今あるのは PaleGL だけで、`/about` からリンクすれば足りる | P2 |
| サイト内 embed（iframe） | 実物へは別タブで開くリンクにする（決定 0001）。P2 の形は three.js examples / atlab.io と同じ: **直接開けば作品だけ**（+ `_shell.js` のリンク）、**一覧から開けばハブの中に iframe で出す**。作品も URL も変わらないので P1 の成果物は壊れない（`_shell.js` は iframe の中では出ない。決定 0004）。**カメラ・センサー系の作品**は iframe の中で動かない恐れがある（iOS Safari。決定 0004）。P2 では (1) 同一オリジン + `allow` 属性で実機確認し、(2) 動かなければ `lab:build` がソースの `getUserMedia` / `DeviceMotionEvent` / `DeviceOrientationEvent` を検出して build-meta に書き、ハブはその作品だけ iframe ではなくページ遷移で開く（導出できるので frontmatter に持たない）。直接開く URL は常に動く | P2 |

## 受け入れ条件

- [ ] `harness check` が pass（`astro check`、`astro build`、`media keys resolve`、`tag normalization`、`lab build in sync`、`no large files`）
      ※ `src/data/tech.ts`（技術タグの正規名と alias）は**空から作らず、P0 で積んだ sketch 5〜10 件で実際に使った語**を初期値にする
- [ ] Cloudflare Pages で `main` への push から自動 deploy され、PR はプレビュー URL が出る
- [ ] sketch が 500 件ある状態を**ダミーデータで検証済み**: ビルド 60 秒以内、`/` の初期転送 1.5 MB 以内
- [ ] サイトは **iframe を 1 つも生成しない**（実物へは別タブで開くリンク。決定 0001）
- [ ] 各ページに OGP（`og:title` / `og:description` / `og:image` 絶対URL / `twitter:card: summary_large_image`）が入る
- [ ] 全ページで `<img>` / `<video>` に `width` / `height` が入り、CLS が 0.1 未満
- [ ] 縦向き（1080×1920）の sketch を混ぜても `/` のグリッドが崩れない（カードは正方形 + `object-fit: cover`）
- [ ] JS を無効にしても `/` の sketch 索引（poster・テキスト・リンク）が読める
- [ ] sitemap.xml が生成される
- [ ] `takumifukasawa.com/lab/` は `/` に 301 リダイレクトする（`public/_redirects`。URL を削った人がトップに辿れる）
- [ ] `draft: true` にして push するとそのカードがサイトから消える（kill switch。1 分以内に反映）

### 500 件のダミー検証について

これは v0 で**必ずやる**。後回しにすると「破綻しない設計」が検証されないまま 300 件積む。
`scripts/gen-dummy-lab.ts` で `src/content/lab/` に 500 件生成し、**ビルド時間と `/` の初期転送量**を測って捨てる（コミットしない）。
Lighthouse までは測らない — iframe を外し画像を R2 に出したので、破綻しうる要素はこの 2 つに絞られている。
計測値は `../learnings.md` に残す。

## 範囲外（P1 でやらないと明記するもの）

- **サイト内 embed（iframe）**。実物へは別タブで開くリンクにする（決定 0001。移行は URL を変えずリンクを差し替えるだけ）
- Works 一覧 / 詳細ページ、Major Work の専用ページ
- tag / tech でのフィルタ・検索 UI（件数が 100 を超えてから。それまでは `/` の年別セクションで足りる）
- 動的 OGP 画像生成（`poster` をそのまま `og:image` に使う）
- masonry レイアウト（高さがばらつくタイル）。正方形グリッドで足りるうえ、500 件での挙動が読めない
- ダークモード以外のテーマ切り替え、凝った transition、カスタムカーソル等の演出
- i18n（下記の「準備だけする」を参照）
- CMS・管理画面（frontmatter を手で書く + scaffold script で足りる）
- コメント・いいね等の動的機能

## 将来の英語対応（P1 では構造だけ）

- URL を `/...`（日本語）で始め、**後から `/en/...` を足せる形**にする（Astro の i18n で `prefixDefaultLocale: false`）。P1 で i18n 設定は入れない。
- sketch の本文を書かない（`content-model.md`）ので、英語化が必要になるのは `title` / `description` / Notes 本文だけ。この構造を崩さないことが最大の i18n 対策。
- `/about` は P1 の時点から英語の段落を 1 つ併記する（海外からの見られ方が最も早く効くのはここ）。

## 未確定事項

- （解決済 2026-10-08）作品も同じドメインに置き、URL は `takumifukasawa.com/lab/<slug>/`。決定 0001 を参照
- フォント・配色・レイアウトの方向性（作品が主役なので低彩度・余白重視を想定）→ P1 着手時に決める
