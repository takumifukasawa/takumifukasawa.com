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
| **P1** | サイト v0（この doc の範囲） | sketch 1〜10 件程度が載ったサイトが `takumifukasawa.com` で公開されている |
| **P2** | Works ページ / tag 一覧 / 動的 OGP / RSS の拡充 | （別 spec） |
| **P3** | 英語対応 / AI による metadata 生成 / X 連携の自動化 | （別 spec） |

P0 は**サイト repo の作業を 1 行も含まない**。P0 の最中に sketch を 5〜10 件積んでから P1 に入る
（schema は実データ 5 件を通すまで必ず間違っているので、架空の 1 件で設計を固めない）。

## P1 の範囲（作るページ）

| URL | 内容 |
|---|---|
| `/` | 最新 sketch 12〜24 件のグリッド + `featured` の Works 数点 + 1 段落の自己紹介 |
| `/lab/` | 全件の索引。**年別セクション**で区切る（`/lab/#2026`）。1 ページに全部出すが、サムネは poster 画像のみ |
| `/lab/<slug>/` | 1 件の詳細。`presentation()` の導出結果に応じて embed / video / still を出し分ける（`content-model.md`） |
| `/notes/` | 記事一覧（日付降順） |
| `/notes/<slug>/` | 記事本文（MDX） |
| `/about/` | 自己紹介・やっていること・Links / Contact |
| `/rss.xml` | Notes + Works のフィード（sketch は入れない。件数が多く用途が違う） |
| `/404` | |

### P1 に入れる機能（ページ以外）

- **日付密度グリッド**（contribution graph 風）を `/lab/` に置く。`date` から算出する。「量と継続」は名前で主張せずここで見せる（決定 0002）
- **MDX + Shiki + KaTeX + 見出しリンク**（`content-model.md` の「ファイル形式と執筆環境」）。Notes を書き始められる状態にする
- `draft: true` の除外、sitemap.xml、RSS
- **Cloudflare Web Analytics**（script 1 行、無料、Cookie なし）。バズった時に数字が見られない状態を作らない

Works の一覧・詳細ページは **P1 に入れない**。代表作が出来てから作る（今あるのは PaleGL だけで、それは `/about` からリンクすれば足りる）。

## 受け入れ条件

- [ ] `harness check` が pass（`astro check`、`astro build`、`media keys resolve`、`tech vocabulary`）
- [ ] Cloudflare Pages で `main` への push から自動 deploy され、PR はプレビュー URL が出る
- [ ] `/lab/` に sketch が 500 件ある状態を**ダミーデータで検証済み**: ビルド 60 秒以内、`/lab/` の初期転送 1.5 MB 以内、Lighthouse Performance 90 以上（モバイル）
- [ ] `/lab/<slug>/` で `embedUrl` のある sketch は poster を表示し、**クリックするまで iframe を生成しない**
- [ ] 各ページに OGP（`og:title` / `og:description` / `og:image` 絶対URL / `twitter:card: summary_large_image`）が入る
- [ ] 全ページで `<img>` に `width` / `height` が入り、CLS が 0.1 未満
- [ ] JS を無効にしても sketch 索引と詳細（poster・テキスト・リンク）が読める
- [ ] sitemap.xml が生成される
- [ ] `/lab/` の日付密度グリッドが `date` から生成され、空白期間があっても崩れない
- [ ] Notes で GLSL / WGSL のコードブロックがハイライトされ、`$$` の数式が描画される
- [ ] `draft: true` にして push すると、そのページがサイトから消える（kill switch。1 分以内に反映）

### 500 件のダミー検証について

これは v0 で**必ずやる**。後回しにすると「破綻しない設計」が検証されないまま 300 件積む。
`scripts/gen-dummy-lab.ts` で `src/content/lab/` に 500 件生成し、ビルドと Lighthouse を測って捨てる（コミットしない）。
計測値は `../learnings.md` に残す。

## 範囲外（P1 でやらないと明記するもの）

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
