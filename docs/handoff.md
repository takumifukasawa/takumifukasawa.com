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
| 全体構成（2 repo / 2 deployment / media は R2） | 草案（合意待ち） | `decisions/0001-overall-architecture.md` |
| tier 1 の命名（`lab` / `sketch`） | 草案（合意待ち） | `decisions/0002-naming-lab-sketch.md` |
| コードの置き場（昇格モデル） | 草案（合意待ち） | `decisions/0003-code-placement.md` |
| content schema | 草案（合意待ち） | `spec/content-model.md` |
| サイト v0 の範囲 | 草案（合意待ち） | `spec/site-v0.md` |
| 公開フロー | 草案（合意待ち） | `spec/publish-pipeline.md` |
| Cloudflare の制限・料金の調査 | 完了（2026-10-07 取得） | `references/cloudflare-limits.md` |
| Astro プロジェクト | 未着手 | — |
| `lab` repo | 未着手 | — |
| Cloudflare Pages / R2 | 未着手 | — |
| `.harness/checks.sh` | seed のみ（プロダクト検査 0 件） | `bash .harness/bin/harness check` |

## NEXT（依存順。順序制約があれば明記）

1. **草案 6 本に合意する**（人間の判断）。合意したら各 doc の 状態 を「合意済」、decisions を「採用」に直す。
2. 合意後、`plans/active/site-and-lab.md` を作る（P0 → P1 の計画。`plans/README.md` の雛形）。
3. **P0 を先にやる**（サイトより先。`spec/site-v0.md` のフェーズ表）
   - サブドメイン確保（`lab.` / `media.`）、R2 bucket + custom domain（`r2.dev` は本番不可）
   - `lab` repo 作成（Vite multi-page、`pnpm new`、`core/AGENTS.md` の 3 回ルール、DCC 拡張子の gitignore）
   - Cloudflare Pages で `lab.takumifukasawa.com` を自動 deploy
   - sketch を 5〜10 件積む（schema を実データで壊してから P1 に入る。架空の 1 件で設計を固めない）
4. P1: このリポジトリに Astro を入れ、`spec/site-v0.md` の受け入れ条件を満たして公開。
   - `.harness/checks.sh` に `astro check` / `astro build` / `media keys resolve` / `tech vocabulary` を登録
   - 500 件ダミーでビルド時間と Lighthouse を実測し `learnings.md` に残す

## 未確定事項（人間の判断待ち）

- 草案 6 本（上記 NEXT 1）
- `lab` か `labs` か → **`lab`（単数）を推奨**。決定 0002 の「なぜ `lab`（単数）か」を参照
- `themes` の語彙を固定するか（`spec/content-model.md`。v0 は自由の方針）
- 録画の既定フォーマット（長さ・解像度・fps。`spec/publish-pipeline.md`）
- フォント・配色・レイアウトの方向性（P1 着手時）

### 解決済（記録のため残す）

- サブドメイン名 → `lab.takumifukasawa.com`（決定 0002）
- `daily` という命名 → 頻度を構造に埋めないため廃止。`lab` / `sketch` に（決定 0002）
- 重いものと軽いものの住み分け → 置き場は昇格モデル（決定 0003）、見せ方は `lab` / `notes` / `works`（決定 0002）
- バズった時のコスト → 構造的に $0。実際に効くのは R2 Class B のみで 1 件に月 41 万 PV 相当まで無料枠内（`references/cloudflare-limits.md`）
- GIF を使うか → 使わない。mp4 + webm で `autoplay muted loop playsinline`（決定 0003）
- R2 を使わない選択肢 → 使わない方が先に課金される（Git LFS の帯域）か品質が落ちる（`references/cloudflare-limits.md`）
- モバイル対応 → 基本はモバイルで動くように作る。専用フィールドは持たず、動かないものは `embedUrl` を付けず `video` だけ入れる（`spec/content-model.md`）
- `kind` は必要か → `lab` では不要（`embedUrl` / `video` の有無から導出）。`works` にだけ残す。原則「導出できるものは frontmatter に持たない」（`spec/content-model.md`）
- GitHub Pages にするか → しない。帯域 100 GB/月のソフト上限でバズ時に止まる側に倒れる／R2 を使う時点で Cloudflare DNS が前提になる（決定 0001 落選案 E）

## このセッションで触らなかったが確認したもの

- `harness doctor`: FAIL 0。WARN は jq 未インストール（任意）と Codex hook の信頼（Codex を使うときに各 PC で 1 回）
- `.harness/source.local` に `D:/Development/agent-harness` を設定済み（この PC 用、gitignore 対象）
