# 0003: コードの置き場 — 既定は `lab` repo、独立 repo は条件つきの昇格

- 日付: 2026-10-08
- 状態: 草案（この doc で合意を取る）
- 関連: `0001-overall-architecture.md`, `0002-naming-lab-sketch.md`, `../spec/publish-pipeline.md`

## 背景

10 分の GLSL スケッチと、数週間かかる WebGPU の実験と、PaleGL のようなライブラリを、同じ扱いにはできない。
一方で repo を増やすと「どこに何があるか」の管理コストと Cloudflare Pages project の増殖が起きる。
**「重さ」で分けるのか「種類」で分けるのかを決めないと、1 件作るたびに置き場を考えることになる**（= 毎日踏む摩擦）。

なお「サイト上の見せ方」は別の軸で、決定 0002 で既に解決している（軽い = `lab` 1 件 / 重め = `lab` 1 件 + `notes` 1 本 / 完成作品 = `works` 1 件）。
この決定はコードの物理的な置き場だけを扱う。

## 採用案

### 一覧（これが全部）

| | 軽い sketch | 重い技術検証 | 完成作品 | ライブラリ |
|---|---|---|---|---|
| **コードの置き場** | `lab` repo | `lab` repo | `lab` repo | **独立 repo**（PaleGL） |
| **サイトの collection** | `lab` | `lab` + `notes` | `works` | `works`（`kind: library`） |
| 判断基準 | — | 解説を書いたか | 自分で選ぶ | 下の 4 条件 |

**`experiments` という別の箱は作らない。** `lab` repo がそれで、名前が変わっただけ（決定 0002）。
**「重さ」のカテゴリも作らない** — `note` の有無で導出できる（`../spec/content-model.md`）。

`core/` の 3 回ルールと同じ**昇格モデル**にする。既定は 1 つで、条件を満たしたものだけが外へ出る。

| 置き場 | 条件 |
|---|---|
| `lab` repo の `src/<NNN-slug>/` | **既定。すべてここから始める** |
| `lab` repo の `core/` | 同じコードを 3 つ以上の sketch で書いた後（`../spec/publish-pipeline.md`） |
| **独立 repo** | 下の条件を 1 つ以上満たした時だけ |

### 独立 repo にする条件（1 つ以上満たしたら）

1. `lab` repo の共通 Vite ビルドに収まらない（別 toolchain / wasm / Rust / 別言語）
2. バイナリアセットが合計 50 MB を超える（clone コストが全 sketch に乗る）
3. ライブラリ・パッケージとして単体で配りたい（PaleGL がこれ）
4. 2 週間以上かかり、独自のリリースサイクルを持つ

**「重い」だけでは独立させない。** 2 週間かけた WebGPU 実験でも、Vite の 1 entry に収まりアセットが軽いなら `lab` repo の中に置く。
閾値は意図的に高くする（repo を増やすコストのほうが先に効くため）。

独立 repo は独自サブドメインを持つ（例: `palegl.takumifukasawa.com`）。年に数本なので Pages project 100/アカウントの天井には当たらない
（`../references/cloudflare-limits.md`）。

### サイト側の表現は repo 分割に影響されない

独立 repo のものも、サイトでは `lab` か `works` の 1 件として frontmatter を書き、`embedUrl` が別ドメインを指すだけ。
**repo をどう割ったかがサイトの構造に漏れない**のが、決定 0001 の「サイトはハブ」の効き目。
したがってこの決定は後から変えても、既存の URL も frontmatter も壊れない。

### `lab` repo は「sketch のソース置き場」であって「Web ビルドの置き場」ではない

`src/<NNN-slug>/` に `index.html` があるものだけが Vite に拾われ、`lab.takumifukasawa.com/<NNN-slug>/` にデプロイされる。
**`index.html` が無いディレクトリもそのまま置いてよい** — Houdini の VEX、Blender / Houdini の Python ツール、UE の設定メモなど。

これで Web 以外の sketch にも「誘導先の repo」ができる（frontmatter の `repo` がそのディレクトリを指せる）。
repo を増やさずに済むので、決定 0001 の落選案 C（1 作品 1 repo）に戻らない。

### DCC のプロジェクトファイルは git に入れない

| 対象 | 置き場 |
|---|---|
| **テキスト資産**（VEX / HDA の中身 / Python ツール / `.py` / 設定の抜粋） | `lab` repo の `src/<NNN-slug>/` に入れる |
| **プロジェクトファイル・ソースアセット**（`.hip` / `.hiplc` / `.blend` / `.uproject` / `.uasset` / `.fbx` / `.exr` など） | git に入れない。ローカル + 外部ストレージ |
| **成果物**（動画 / 静止画） | R2（`lab` / `works` の frontmatter から参照） |

`lab` repo の `.gitignore` で上記の拡張子を落とし、**除外の理由をそのファイルにコメントで書く**（後から「なぜ入っていないのか」を探さないため）。
再現手順やパラメータで残す価値があるものは `notes` の記事に書く（ファイルではなく文章で残す）。

### 動画形式は mp4 + webm。GIF は使わない

GIF は 256 色のため、シェーダーやジェネラティブの滑らかなグラデーションがバンディングで潰れる。
フレーム間圧縮も弱く、5 秒 1080p のループが GIF で 10〜30 MB、同じものが mp4 なら 1〜3 MB
（**画質が落ちてサイズが 10 倍**という、この用途では最悪の組み合わせ）。

`<video autoplay muted loop playsinline>` でコントロールを出さなければ、見た目は GIF と区別が付かない。
GIF を作るのは外部サービスが動画を受け付けない場合だけ（GitHub README など。GitHub は mp4 の直接アップロードに対応しているので必須ではない）。

## 落選案と落選理由

**A. 軽いもの用 repo と重いもの用 repo を 2 つ作る（`lab` と `experiments`）**
「どちらに置くか」を 1 件ごとに判断することになる。境界が主観なので、迷ったぶんだけ制作が止まる。
さらに `lab` で始めたものが育った時に repo をまたぐ移動が必要になる。採らない。

**B. sketch ごとに repo を作る**
決定 0001 の落選案 C と同じ。管理コストが高い。採らない。

**C. モノレポ（pnpm workspace）に全部入れる**
`lab` repo が実質モノレポになるが、workspace の設定コストを 1 件目から払うことになる。
`core/` が空のうちは素の Vite multi-page で足りる。**必要になってから** workspace 化する（その時はこの決定を覆さず、`lab` repo 内部の話として処理できる）。

## 影響・やり直す条件

- `lab` repo の clone サイズを定期的に見る。**50 MB を超えたら**、条件 2 に該当する sketch が中にいないか確認する。
- **やり直す条件**: 独立 repo が年 5 本を超えるようになったら、サブドメインの命名規則と索引の持ち方を決め直す（この決定を覆さず、新しい決定を足す）。
