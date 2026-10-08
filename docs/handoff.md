# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-10-08

## いま何をしているか（1〜3 行）

個人サイト（制作アーカイブ + 技術ノート + ポートフォリオ）の全体構成を設計中。
agent-harness を導入し、構成案を decisions 3 本 + spec 3 本 + references 1 本に**草案として**書き出した段階。
コードは 1 行も無い（Astro プロジェクト未作成、`lab` repo 未作成）。

## 状態

| 項目 | 状態 | 出典 |
|---|---|---|
| agent-harness 導入 | 検証済み | commit `c190c31`、`bash .harness/bin/harness doctor` |
| 全体構成（1 repo / 1 ドメイン / media は R2） | 草案（合意待ち） | `decisions/0001-overall-architecture.md` |
| tier 1 の命名（`lab` / `sketch`） | 草案（合意待ち） | `decisions/0002-naming-lab-sketch.md` |
| コードの置き場（昇格モデル） | 草案（合意待ち） | `decisions/0003-code-placement.md` |
| content schema | 草案（合意待ち） | `spec/content-model.md` |
| サイト v0 の範囲（P1 = 2 ページ） | 草案（合意待ち） | `spec/site-v0.md` |
| 公開フロー | 草案（合意待ち） | `spec/publish-pipeline.md` |
| Cloudflare の制限・料金の調査 | 完了（2026-10-07 取得） | `references/cloudflare-limits.md` |
| Astro プロジェクト | 未着手 | — |
| `lab/` と公開フロー（`pnpm new` / `pnpm lab:add`） | 未着手 | — |
| Cloudflare Pages / R2 | 未着手 | — |
| `.harness/checks.sh` | seed のみ（プロダクト検査 0 件） | `bash .harness/bin/harness check` |

## NEXT（依存順。順序制約があれば明記）

1. **草案 6 本に合意する**（人間の判断）。合意したら各 doc の 状態 を「合意済」、decisions を「採用」に直す。
2. 合意後、`plans/active/site-and-lab.md` を作る（P0 → P1 の計画。`plans/README.md` の雛形）。
3. **P0 を先にやる**（サイトより先。`spec/site-v0.md` のフェーズ表）
   - `media.takumifukasawa.com` のサブドメイン確保、R2 bucket + custom domain（`r2.dev` は本番不可）
   - このリポジトリに `lab/` と `pnpm new` / `pnpm lab:add` を作る（`core/AGENTS.md` の 3 回ルール、DCC 拡張子の gitignore）
   - Cloudflare Pages で `takumifukasawa.com` を自動 deploy
   - sketch を 5〜10 件積む（schema を実データで壊してから P1 に入る。架空の 1 件で設計を固めない）
4. P1: このリポジトリに Astro を入れ、`spec/site-v0.md` の受け入れ条件を満たして公開。
   - `.harness/checks.sh` に `astro check` / `astro build` / `media keys resolve` / `tag normalization` / `lab build in sync` / `no large files` を登録
   - 500 件ダミーでビルド時間と初期転送量を実測し `learnings.md` に残す
   - P0 の時点で **repo サイズ（`du -sh .git` と working tree）を実測**し、決定 0001 の見込み ~150 MB と照合する
   - P0 で **Pages のデプロイ所要時間とログ**も見る（差分アップロードされるかが未確認）

## 未確定事項（人間の判断待ち）

- 草案 6 本（上記 NEXT 1）
- `lab` か `labs` か → **`lab`（単数）を推奨**。決定 0002 の「なぜ `lab`（単数）か」を参照
- フォント・配色・レイアウトの方向性（P1 着手時）

### 検算（2026-10-08、double-check）で直したもの

- **repo サイズ見積り ~20 MB は機構ごと誤りだった** → ~150 MB（working tree）に修正。Vite は vendor チャンクを自動分割せず、tree-shaking で作品ごとに中身が変わるので blob 共有は起きない。本当に共有する逃げ道（Three.js を external にして `public/lab/_vendor/` の 1 本を全作品が import）を決定 0001 に明記（決定 0001「repo サイズ」）
- **`embedUrl` は導出可能だった** → 落として `public/lab/<slug>/index.html` の有無から導出。`z.string().url()` が相対パスを拒否するので、絶対 URL を書くしかなく「ホスト名を frontmatter に書かない」と矛盾していた。独立 repo の作品だけ `externalUrl` で上書き
- **R2 key の年が年末年始に OGP を壊す** → key から年を外した（`lab/<NNN-slug>/...`）。12 月に `pnpm new` して 1 月に `lab:add` すると `og:image` が 404 のまま残り、X のカードキャッシュで取り返しがつかなかった
- `.build-meta.json` を `public/` の外（`lab/.build-meta/`）へ。`public/` 配下は配信されるので内部メタデータが公開され、`emptyOutDir` で消える危険もあった
- `media/manifest.json` の空 `{}` を P0 の最初にコミットすると明記（無いと初回ビルドが落ちる）
- Cloudflare Pages の設定値の表を `spec/site-v0.md` に追加（P0 のダッシュボード作業で必要）
- Astro 5 の collection は `loader` が必須という記載を `spec/content-model.md` に追加
- **「Pages は差分アップロードする」は未確認**に格下げ（公式ドキュメントに記述が無い）。P0 で実測

### 解決済（記録のため残す）

- 作品の URL は `lab.` サブドメインか `takumifukasawa.com/lab` か → **`takumifukasawa.com/lab/<slug>/`**。サブドメインは使わない。実装は「作品を手元でビルドして `public/lab/<slug>/` にコミットする」方式で、Pages のビルドは Astro だけを走らせる。これで 1 ドメイン・1 repo のまま「作品の事故がサイトを落とさない」「依存更新で古い作品が壊れない」が成り立つ（決定 0001）
- frontmatter 最終形 → 必須 5（`date` / `title` / `medium` / `poster` / `tags`）+ 任意 5（`description` / `video` / `externalUrl` / `repo` / `draft`）。`x` / `note` / `featured` / `videoWebm` / `core` / `no` は持たない。`note` は notes 側の `relatedLab` に一本化（`spec/content-model.md`）

- タグを 2 本に分けるか → 分けない。`tech` と `themes` を 1 本の `tags` に統合（`spec/content-model.md`）

- sketch の詳細ページは必要か → **不要**。直リンクで足りる。サイトは `/` と `/about/` の 2 ページ（`spec/site-v0.md`）
- sketch ごとの OGP → 作品の `index.html` に置く。R2 key が予測可能なので `pnpm new` が録画前から `og:image` を書ける（`spec/publish-pipeline.md`）
- `core` は必要か → **不要**。毎回 1 文書く義務にすると続かない。ルールは `AGENTS.md`（AI との分担）に書いた
- `description` → 任意で用意だけする。空のまま運用してよい。長さ制限なし（`spec/content-model.md`）

- `lab` が複数のものを指して紛らわしい → 名前は変えず `glossary.md` で呼び分けを定義（`lab/` ディレクトリ / lab コレクション / `/lab/` URL）
- 録画の既定フォーマット → 1920×1080 / 60fps / 8〜12 秒ループ / 音なし / H.264（`spec/publish-pipeline.md`）

- OGP は Cloudflare で出るか → 出る。OGP は HTML の meta タグなのでホスト無関係。`astro.config` の `site` 設定と `poster` を `og:image` に使うだけ（`spec/site-v0.md`）
- 重め / 軽めの住み分け → 一緒くた。`experiments` という箱は作らず、`lab` repo + `lab` collection に全部入れる。「重さ」のカテゴリも持たず `note` の有無で導出（決定 0003 の一覧表）
- v0 をさらに薄くした → `/lab/` 索引・日付密度グリッド・Notes 一式・Lighthouse 計測を外し、**P1 は 3 ページ**に（`spec/site-v0.md`）

- `daily` という命名 → 頻度を構造に埋めないため廃止。`lab` / `sketch` に（決定 0002）
- 重いものと軽いものの住み分け → 置き場は昇格モデル（決定 0003）、見せ方は `lab` / `notes` / `works`（決定 0002）
- バズった時のコスト → 構造的に $0。実際に効くのは R2 Class B のみで 1 件に月 41 万 PV 相当まで無料枠内（`references/cloudflare-limits.md`）
- GIF を使うか → 使わない。mp4 のみで `autoplay muted loop playsinline`（webm も作らない。決定 0003）
- R2 を使わない選択肢 → 使わない方が先に課金される（Git LFS の帯域）か品質が落ちる（`references/cloudflare-limits.md`）
- モバイル対応 → 基本はモバイルで動くように作る。専用フィールドは持たず、動かないものは `index.html` を置かず `video` だけ入れる（`spec/content-model.md`）
- live 作品の見せ方 → v0 は別タブで開くリンク。サイト内 embed は P2（URL が変わらないので移行はリンクの差し替えだけ。決定 0001）
- GitHub Pages にするか → しない。帯域 100 GB/月のソフト上限でバズ時に止まる側に倒れる／R2 を使う時点で Cloudflare DNS が前提になる（決定 0001 落選案 E）

## このセッションで触らなかったが確認したもの

- `harness doctor`: FAIL 0。WARN は jq 未インストール（任意）と Codex hook の信頼（Codex を使うときに各 PC で 1 回）
- `.harness/source.local` に `D:/Development/agent-harness` を設定済み（この PC 用、gitignore 対象）
