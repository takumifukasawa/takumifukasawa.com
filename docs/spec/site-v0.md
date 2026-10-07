# site v0 — 最初に公開するもの

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`, `content-model.md`, `publish-pipeline.md`

## 目的

**sketch を止めないための最小のハブを公開する。** v0 の成功条件はサイトの完成度ではなく、
「この後 2 年、1 件公開するのに迷いと手戻りが無い」状態になっていること。

## フェーズ（順序が重要）

サイトより **lab と公開フローを先に立てる**。サイトが無くても sketch は X に投稿できるが、
sketch が無いサイトには載せるものが無い。順序を逆にすると「サイトを作り込む」ほうに時間が流れる。

| Phase | 範囲 | 完了の条件 |
|---|---|---|
| **P0** | `lab` repo + `lab.takumifukasawa.com` + R2 + `media.takumifukasawa.com` | sketch 001 が `lab` で動き、poster/mp4 が R2 から配信され、X に投稿できる |
| **P1** | サイト v0（この doc の範囲）。**3 ページだけ** | sketch 1〜10 件程度が載ったサイトが `takumifukasawa.com` で公開されている |
| **P1.5** | Notes 一式（`/notes/` + 記事ページ + MDX + Shiki + KaTeX + RSS） | **最初の記事を書きたくなった時に作る**。1 セッションで足りる |
| **P2** | `/lab/` 索引の分離 / 日付密度グリッド / サイト内 embed（iframe のクリックロード）/ Works ページ / tag 一覧 / 動的 OGP | （別 spec） |
| **P3** | 英語対応 / AI による metadata 生成 / X 連携の自動化 | （別 spec） |

P0 は**サイト repo の作業を 1 行も含まない**。P0 の最中に sketch を 5〜10 件積んでから P1 に入る
（schema は実データ 5 件を通すまで必ず間違っているので、架空の 1 件で設計を固めない）。

## P1 の範囲（作るページ）

| URL | 内容 |
|---|---|
| `/` | **全 sketch の索引を兼ねる**。年別セクションで区切り（`/#2026`）、`featured` を上に出す。サムネは poster のみ。1 段落の自己紹介 |
| `/lab/<slug>/` | 1 件の詳細。poster（必須）、`video` があれば動画、`embedUrl` があれば別タブで開くリンク（`content-model.md`） |
| `/about/` | 自己紹介・やっていること・Links / Contact・PaleGL へのリンク |
| `/404` | |

### P1 に入れる機能（ページ以外）

- `draft: true` の除外、sitemap.xml
- **Cloudflare Web Analytics**（script 1 行、無料、Cookie なし）。バズった時に数字が見られない状態を作らない
- OGP（`astro.config` の `site` 設定 + `poster` を `og:image` に使う）

### P1 で作らないもの（意図的に削ったもの）

| 削ったもの | 理由 | 行き先 |
|---|---|---|
| `/lab/` の索引ページ | `/` が索引を兼ねれば足りる。`/lab/<slug>/` の URL は変わらないので、後から分けても壊れない | P2 |
| 日付密度グリッド | sketch 10 件で出すと空白だらけで逆効果。50 件くらい溜まってから意味が出る | P2 |
| Notes 一式（記事ページ / MDX / Shiki / KaTeX / RSS） | 記事が 0 本の段階で記事基盤を作るのは早い。空ページができるだけ。書く対象の sketch が溜まってから作る | P1.5 |
| Works の一覧・詳細ページ | 代表作が出来てから。今あるのは PaleGL だけで、`/about` からリンクすれば足りる | P2 |
| サイト内 embed（iframe） | `embedUrl` は別タブで開くリンクにする（決定 0001） | P2 |

## 受け入れ条件

- [ ] `harness check` が pass（`astro check`、`astro build`、`media keys resolve`、`tech vocabulary`）
      ※ `src/data/tech.ts` の語彙は**空から作らず、P0 で積んだ sketch 5〜10 件で実際に使った語**を初期値にする
- [ ] Cloudflare Pages で `main` への push から自動 deploy され、PR はプレビュー URL が出る
- [ ] sketch が 500 件ある状態を**ダミーデータで検証済み**: ビルド 60 秒以内、`/` の初期転送 1.5 MB 以内
- [ ] `/lab/<slug>/` は **iframe を 1 つも生成しない**（`embedUrl` は別タブで開くリンク。決定 0001）
- [ ] `video` がある sketch は `<video autoplay muted loop playsinline>` でループ再生され、コントロールは出ない
- [ ] 各ページに OGP（`og:title` / `og:description` / `og:image` 絶対URL / `twitter:card: summary_large_image`）が入る
- [ ] 全ページで `<img>` に `width` / `height` が入り、CLS が 0.1 未満
- [ ] JS を無効にしても sketch 索引と詳細（poster・テキスト・リンク）が読める
- [ ] sitemap.xml が生成される
- [ ] `draft: true` にして push すると、そのページがサイトから消える（kill switch。1 分以内に反映）

### 500 件のダミー検証について

これは v0 で**必ずやる**。後回しにすると「破綻しない設計」が検証されないまま 300 件積む。
`scripts/gen-dummy-lab.ts` で `src/content/lab/` に 500 件生成し、**ビルド時間と `/` の初期転送量**を測って捨てる（コミットしない）。
Lighthouse までは測らない — iframe を外し画像を R2 に出したので、破綻しうる要素はこの 2 つに絞られている。
計測値は `../learnings.md` に残す。

## 範囲外（P1 でやらないと明記するもの）

- **サイト内 embed（iframe）**。`embedUrl` は別タブで開くリンクにする（決定 0001。移行は URL を変えずリンクを差し替えるだけ）
- Works 一覧 / 詳細ページ、Major Work の専用ページ
- tag / tech でのフィルタ・検索 UI（件数が 100 を超えてから。それまでは `/lab/` の年別で足りる）
- 動的 OGP 画像生成（`poster` をそのまま `og:image` に使う）
- ダークモード以外のテーマ切り替え、凝った transition、カスタムカーソル等の演出
- i18n（下記の「準備だけする」を参照）
- CMS・管理画面（frontmatter を手で書く + scaffold script で足りる）
- コメント・いいね等の動的機能

## 将来の英語対応（P1 では構造だけ）

- URL を `/...`（日本語）で始め、**後から `/en/...` を足せる形**にする（Astro の i18n で `prefixDefaultLocale: false`）。P1 で i18n 設定は入れない。
- sketch の本文を書かない（`content-model.md`）ので、英語化が必要になるのは `title` / `summary` / Notes 本文だけ。この構造を崩さないことが最大の i18n 対策。
- `/about` は P1 の時点から英語の段落を 1 つ併記する（海外からの見られ方が最も早く効くのはここ）。

## 未確定事項

- （解決済 2026-10-08）サブドメインは `lab.takumifukasawa.com`。決定 0002 を参照
- フォント・配色・レイアウトの方向性（作品が主役なので低彩度・余白重視を想定）→ P1 着手時に決める
