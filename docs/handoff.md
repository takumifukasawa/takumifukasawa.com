# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-10-08

## いま何をしているか（1〜3 行）

個人サイト（制作アーカイブ + 技術ノート + ポートフォリオ）の設計が一巡し、**草案 7 本 + 用語集 + 外部知識 1 本**が揃った。
double-check で 9 件の誤りを直し済み。**コードは 1 行も無い**（Astro も `lab/` も未作成）。
次は P0 = `lab/` の雛形と公開 CLI を作り、Cloudflare を繋いで sketch を 5〜10 件積む。

## 別の PC で再開するとき（最初にやること）

`.git/config` と gitignore 対象のファイルは clone に乗らないので、2 つだけ手当てが必要。

```bash
git clone https://github.com/takumifukasawa/takumifukasawa.com.git
cd takumifukasawa.com
bash .harness/bin/harness doctor        # ← まずこれ。足りないものを全部教えてくれる
git config core.hooksPath .githooks     # pre-commit を有効化（git config は clone に乗らない）
```

- `core.hooksPath` を設定しないと **commit は成功するのに検査が走らない**（`learnings.md` の 1 件目）。`doctor` が WARN で教える。
- `.harness/source.local`（gitignore 対象）が無いので `doctor` が「source が辿れない」と WARN する。
  `harness update` / `harness upstream` を使うときだけ、agent-harness を clone してそのパスを 1 行書く。使わないなら放置してよい。
- Cloudflare / R2 の認証（`wrangler login`）は P0 に入ってから。

## 状態

| 項目 | 状態 | 出典 |
|---|---|---|
| agent-harness 導入 | 検証済み | `bash .harness/bin/harness doctor` |
| 管理ファイルの drift | 無し | `bash .harness/bin/harness status` |
| 検査の登録 | seed のみ（プロダクト検査 0 件） | `bash .harness/bin/harness check` |
| 全体構成（1 repo / 1 ドメイン / media は R2） | 草案（合意待ち） | `decisions/0001-overall-architecture.md` |
| tier 1 の命名（`lab` / `sketch`） | 草案（合意待ち） | `decisions/0002-naming-lab-sketch.md` |
| コードの置き場（昇格モデル） | 草案（合意待ち） | `decisions/0003-code-placement.md` |
| 作品ページからトップへの導線（`/_shell.js`） | 草案（合意待ち） | `decisions/0004-lab-shell.md` |
| content schema | 草案（合意待ち） | `spec/content-model.md` |
| サイト v0 の範囲（P1 = 2 ページ） | 草案（合意待ち） | `spec/site-v0.md` |
| 公開フロー | 草案（合意待ち） | `spec/publish-pipeline.md` |
| 境界と不変条件 | 草案（決定 0001 の合意後に確定） | `architecture.md` |
| Cloudflare / GitHub の制限調査 | 完了（2026-10-07 取得） | `references/cloudflare-limits.md` |
| Astro プロジェクト | 未着手 | — |
| `lab/` と公開 CLI（`pnpm new` / `lab:add` / `lab:build`） | 未着手 | — |
| Cloudflare Pages / R2 | 未着手 | — |

## NEXT（依存順。順序制約があれば明記）

1. **草案 7 本に合意する**（人間の判断）。後から戻しにくい順に 0002（URL）→ 0001（成果物コミット・R2 key）→ 0004（`_shell.js` の約束）→ publish-pipeline を重点的に見る。残りは後から変えられる。合意したら各 doc の 状態 を「合意済」、decisions を「採用」に直す。
2. 合意後、`plans/active/site-and-lab.md` を作る（P0 → P1 の計画。`plans/README.md` の雛形）。
3. **P0。サイトのページは 1 枚も作らない**（`spec/site-v0.md` のフェーズ表）
   - `media.takumifukasawa.com` のサブドメイン確保、R2 bucket + custom domain（`r2.dev` は本番不可）
   - `media/manifest.json` に空の `{}` をコミット（**無いと初回ビルドが落ちる**）
   - `lab/` の雛形と `pnpm new <slug> "<title>"`（OGP 入り `index.html` + `base` / `outDir` 入りの `vite.config.ts` を生成）
   - `pnpm lab:build` / `pnpm lab:add` / `pnpm lab:rebuild --all`
   - `.gitignore`、`lab/core/AGENTS.md`（3 回ルール）
   - `public/_shell.js`（左上のテキストリンク 1 つだけ）と `public/_headers`（`_shell.js` は短い max-age）。sketch 001 より前に（決定 0004）
   - Cloudflare Pages を繋ぐ（設定値は `spec/site-v0.md` の表）
   - **sketch を 5〜10 件積む。** schema を実データで壊してから P1 に入る（架空の 1 件で設計を固めない）
4. P1: Astro を入れ、`spec/site-v0.md` の受け入れ条件を満たして公開（`/` と `/about/` の 2 ページ）
   - `.harness/checks.sh` に `astro check` / `astro build` / `media keys resolve` / `tag normalization` / `lab build in sync` / `no large files` を登録
   - 500 件ダミーでビルド時間と `/` の初期転送量を実測し `learnings.md` に残す

### P0 で必ず実測するもの（未確認のまま進めている前提）

| 測るもの | なぜ | 書き戻す先 |
|---|---|---|
| repo サイズ（`du -sh .git` と working tree） | 500 件 ~150 MB の見込みが当たっているか。外れたら Three.js を external にして共有コピー 1 本にする | `decisions/0001` の「repo サイズ」と `learnings.md` |
| Pages のデプロイ所要時間とログ | **差分アップロードされるかが未確認**。毎回全件上がるならデプロイ時間に効く | `references/cloudflare-limits.md` の未確認事項 |
| `base: './'` の成果物が Worker・動的 import・`new URL(..., import.meta.url)` 込みで動くか | (B) への乗り換えを `git mv` だけにする前提（決定 0004） | `decisions/0004-lab-shell.md` |
| `/lab/<slug>`（末尾スラッシュ無し）が `/lab/<slug>/` へリダイレクトされるか（`curl -I`） | 相対パスの成果物はスラッシュ無しで開くと白画面になる。されなければ `_redirects` で 301 | `decisions/0004-lab-shell.md` |
| ビルド後も `<script src="/_shell.js">` が `./_shell.js` に書き換わっていないか | 書き換わると全作品で導線が 404 | 同上 |
| R2 の Class B 実績（Dashboard） | キャッシュヒットがカウントされるかが未確認 | 同上 |

## 未確定事項（人間の判断待ち）

- 草案 7 本（上記 NEXT 1）
- `lab` か `labs` か → **`lab`（単数）を推奨**。決定 0002 の「なぜ `lab`（単数）か」を参照
- フォント・配色・レイアウトの方向性（P1 着手時に決める）

### 2026-10-08 の 2 回目のセッションで直したもの

- 検算の修正が他の doc に伝わっていなかった 11 件を直した（0001/0003 の「~20 MB」、`note` フィールドの残骸、OGP の「今年」、0002 の日付密度グリッドが P1 になっていた件、site-v0 の詳細ページ前提の受け入れ条件など）
- 作品ページからトップへの導線を決定 0004 として追加。iframe で包む案（B）と比べ、iOS Safari のカメラ・センサーの不確実さから**作品をそのまま配信する（A）**を選んだ。作品には `<script src="/_shell.js" defer>` の 1 行だけ焼き込み、見た目はサイト側の 1 ファイルで後から決める。`base: './'` で (B) への乗り換えを `git mv` だけにしてある

### 検算（2026-10-08、double-check）で直したもの

- **repo サイズ見積り ~20 MB は機構ごと誤りだった** → ~150 MB（working tree）に修正。Vite は vendor チャンクを自動分割せず、tree-shaking で作品ごとに中身が変わるので blob 共有は起きない（`learnings.md`）。本当に共有する逃げ道も決定 0001 に明記
- **`embedUrl` は導出可能だった** → 落として `public/lab/<slug>/index.html` の有無から導出。`z.string().url()` が相対パスを拒否するので絶対 URL を書くしかなく、「ホスト名を frontmatter に書かない」と矛盾していた。独立 repo の作品だけ `externalUrl` で上書き
- **R2 key の年が年末年始に OGP を壊す** → key から年を外した（`learnings.md`）
- `.build-meta.json` を `public/` の外（`lab/.build-meta/`）へ。`public/` 配下は配信されるので内部メタデータが公開され、`emptyOutDir` で消える危険もあった
- `media/manifest.json` の空 `{}` を P0 の最初にコミットすると明記
- Cloudflare Pages の設定値の表を `spec/site-v0.md` に追加
- Astro 5 の collection は `loader` が必須という記載を `spec/content-model.md` に追加
- **「Pages は差分アップロードする」は未確認に格下げ**（公式ドキュメントに記述が無い）

### 解決済（記録のため残す。再提案されたら理由を読む）

- 作品の URL → `takumifukasawa.com/lab/<slug>/`。サブドメインは使わない。実装は「作品を手元でビルドして `public/lab/<slug>/` にコミットする」方式で、Pages のビルドは Astro だけを走らせる（決定 0001）
- `daily` という命名 → 頻度を構造に埋めるため廃止。`lab` / `sketch` に（決定 0002）
- 重め / 軽めの住み分け → 一緒くた。`experiments` という箱は作らず「重さ」のカテゴリも持たない（決定 0003 の一覧表）
- sketch の詳細ページ → 作らない。直リンクで足りる（`spec/site-v0.md`）
- タグを 2 本に分けるか → 分けない。`tech` と `themes` を 1 本の `tags` に統合（`spec/content-model.md`）
- `core`（自分が書いた部分）→ frontmatter に持たない。ルールは `AGENTS.md` の「AI との分担」に書いた
- GIF → 使わない。mp4 のみで `autoplay muted loop playsinline`（webm も作らない。決定 0003）
- R2 を使わない選択肢 → 使わない方が先に課金される（Git LFS の帯域）か品質が落ちる（`references/cloudflare-limits.md`）
- GitHub Pages → しない。帯域 100 GB/月のソフト上限でバズ時に止まる側に倒れる（決定 0001 落選案 E）
- バズった時のコスト → 構造的に $0。実際に効くのは R2 Class B のみで 1 件に月 41 万 PV 相当まで無料枠内
- 録画の既定 → 横 1920×1080 / 縦 1080×1920 / 60fps / 8〜12 秒ループ / 音なし / mp4
- モバイル対応 → 基本はモバイルで動くように作る。専用フィールドは持たない
- `themes` の語彙 → 固定しない。検査は既知語の表記ゆれだけで未知語は通す

## このセッションで触らなかったが確認したもの

- `docs/plans/` は空のまま。計画は草案への合意後に作る（`plans/README.md` の雛形を使う）
- `docs/tech-debt.md` は空のまま。コードが無いので負債も無い
- `docs/roles/` は harness の seed のまま。`task-orchestrate` を回す段階になったら読む
- `docs/rules/README.md` に `lab/core/AGENTS.md`（3 回ルール）を登録済み。ファイル自体は P0 で作る
