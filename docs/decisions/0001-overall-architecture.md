# 0001: 全体構成 — 2 repo / 2 deployment / media は R2

- 日付: 2026-10-08
- 状態: 草案（この doc で合意を取る。合意後に「採用」へ）

## 背景

目的は「個人サイトを作り込むこと」ではなく、**2 年で sketch 300〜500 / Technical studies 20〜30 / Major works 4〜6 を積み上げる制作量を支えるインフラ**を持つこと。
したがって構成の評価軸は次の順で、見栄えや技術的な面白さは下位に置く。

1. 1 作品公開あたりの手数が少ないか（毎日踏む摩擦は複利で効く）
2. 作品側のビルド事故がサイトを落とさないか
3. 500 件を超えてもビルド時間とページ重量が破綻しないか
4. 2 年後に構成を変えるときの移行コストが小さいか

## 採用案

### 層の分離

| 層 | 置き場 | deploy 先 | 壊れたときの影響 |
|---|---|---|---|
| ハブ（Works / sketch 索引 / Notes / About） | `takumifukasawa.com` repo（Astro, static） | Cloudflare Pages → `takumifukasawa.com` | サイトが落ちる |
| 作品の実行環境（Three.js / WebGPU の interactive） | `lab` repo（Vite, multi-page） | Cloudflare Pages → `lab.takumifukasawa.com` | その作品の iframe だけ表示されない |
| メディア（mp4 / poster 画像） | Cloudflare R2 bucket | custom domain → `media.takumifukasawa.com` | 画像・動画が出ない |

**サイトは作品の実行環境ではなく、作品を束ねるハブ**という方針（依頼文のまま）を、repo とデプロイ単位にそのまま落とす。
この 3 分割が「作品側のビルド事故でサイトが落ちない」「サイトの改修で作品の URL が変わらない」を構造で保証する。

### metadata の正本はサイト repo

sketch 1 件 = `takumifukasawa.com` repo の `src/content/lab/<NNN-slug>.md` 1 ファイル。
lab repo は**実行コードだけ**を持ち、metadata を持たない（将来 `meta.yaml` を正本に移す余地は残すが、v0 ではやらない。→ 落選案 B）。

### メディアは R2、frontmatter は key だけを持つ

- `media/manifest.json`（サイト repo、生成物をコミット）が `key → { url 相対, width, height, bytes, durationSec }` を持つ。
- frontmatter は `poster: lab/2026/001-flow-field/poster.webp` のような **key のみ**。ホスト名を書かない。
- アップロード script が ffmpeg / sharp で最適化 → R2 に put → manifest に追記、までを 1 コマンドでやる。
- 一度置いた key は上書きしない（immutable、`Cache-Control: public, max-age=31536000, immutable`）。差し替えは新 key。

これで (a) ドメイン / CDN を変えても frontmatter を触らない、(b) `width`/`height` が全メディアに付くので CLS が出ない、(c) **オフラインで決定的に検査できる**（R2 を叩かずに「frontmatter の key が manifest にあるか」を `harness check` で見られる）。

**例外: Notes の本文中に置く静止画（図・スクリーンショット）は R2 ではなく `src/assets/` に置き、Astro の画像最適化に任せる。**
非対称にする理由は件数。記事の図は増えないので、複数幅の自動生成と AVIF 変換の利得をそのまま取れる。
一方 `lab` の poster は 500 件に向かって増え、ビルド時間が件数に線形で伸びるため repo の外（R2）に出す必要がある。
動画は長さ・サイズ・Astro が扱えないことから、記事中のものも含めて常に R2。

### live 作品は v0 では別タブで開く。サイト内 embed は後から

v0 ではサイト内に `<iframe>` を置かない。`embedUrl` を**別タブで開くリンク**にする。

薄く始められること以上に、副作用が良い方向に効く。

- クリックロード機構、GPU を食う作品が一覧に影響する問題、モバイルの出し分けが v0 から全部消える
- `lab.takumifukasawa.com/<NNN-slug>/` が主役になり、**作品の URL が独立して流通する**（X から直リンクが張れる）

将来サイト内で完結させるときは、**URL が変わらないのでリンクを iframe に差し替えるだけ**で移行できる。
その時点では以下を守る（v0 で捨てた判断ではなく、embed を入れる時に適用する）。

> `<iframe>` は最初から DOM に置かない。poster 画像 + 再生ボタンを出し、**クリックで初めて iframe を挿入**する。
> `loading="lazy"` や IntersectionObserver による自動ロードは採らない（WebGPU / Three.js の作品が複数同時に走ると、一覧ページで GPU とメモリを食い潰す）。

### Astro / Cloudflare Pages

依頼文の案（Astro + Content Collections + Cloudflare Pages + R2）をそのまま採用する。静的出力 1 本に閉じ、SSR を使わない。

## 落選案と落選理由

**A. 1 repo に全部入れる（サイト + lab）**
sketch 1 件の commit がサイトのビルドを毎回走らせ、作品側の壊れた WebGPU コードがサイトのデプロイを止める。500 件の Vite entry を 1 つのビルドに同居させるのも無理が出る。採らない。

**B. lab repo の `meta.yaml` を metadata の正本にし、サイトがビルド時に取り込む**
「作品を作った repo で metadata も書く」ほうが筋は良いが、submodule か GitHub API fetch が必要になり、ビルドが外部状態に依存する（= Cloudflare 側のプレビュービルドが壊れやすく、ローカルと挙動が違う）。Astro Content Collections の型検査も repo 内で完結しなくなる。
v0 では採らない。**移行可能性だけ確保する**: frontmatter にサイト固有の表示指示（レイアウト名・並び順の手指定など）を入れず、フラットな値だけにしておく。将来 B へ移るときは生成元が変わるだけになる。

**C. sketch ごとに repo を分ける**
依頼文のとおり管理コストが高い。Cloudflare Pages の project も 1 作品 1 個になる。採らない。

**D. メディアをサイト repo に入れて Astro の画像最適化に任せる（`src/assets`）**
500 件 × 動画の repo は clone もビルドも重くなり、ビルド時間が件数に比例して伸びる。Astro の画像最適化は mp4 を扱わない。採らない。

**E. GitHub Pages**
不可能ではないが採らない。公式の制限（2026-10-07 確認。`../references/cloudflare-limits.md`）で差が出るのは 2 点。

1. **帯域が 100 GB/月のソフト上限**。メディアは R2 なのでサイト本体は軽く（詳細ページ 150 KB なら月 67 万 PV 相当）問題にならないが、効くのは `lab` 側で、Three.js のバンドルが 1 MB なら **10 万回で上限**。1 件バズれば数日で到達し、超えると警告 → throttle。**バズった時に「止まる側」に倒れる。** Cloudflare Pages は静的アセットの帯域制限がドキュメントに存在しない。
2. **R2 の custom domain は同じ Cloudflare アカウントのゾーンにしか張れない**。つまり R2 を使う時点で Cloudflare DNS が前提になり、そこから Pages を使わない積極的な理由が残らない。

ほかに `_headers` / `_redirects` が無く Cache-Control も CSP もリダイレクトも設定できない、PR プレビューが無い、という差もある。
GitHub Pages の利点（GitHub だけで完結する／ビルドが Actions で環境の自由度が高い）は認めるが、上記 2 点を上回らない。
**この選択は後から変えられる**（成果物が `dist/` の静的ファイルなので移行は DNS とビルド設定だけ）ので、迷ったら Cloudflare で始めてよい。

**F. SSR / DB で sketch を管理**
件数の問題は静的生成とページ分割で解ける。運用コストに見合わない。採らない。

## 影響・やり直す条件

- `lab.takumifukasawa.com` と `media.takumifukasawa.com` のサブドメインを確保する前提になる。
- **やり直す条件**: (1) 1 日の公開手数が 3 コマンドを超えて恒常的に摩擦になったら、落選案 B（lab repo 側を正本に）へ移る。(2) Cloudflare が Pages を新規受付停止したら、同じ静的成果物を Workers Static Assets へ移す（成果物が `dist/` の静的ファイルなので移行は deploy 設定だけで済む。この独立性は意図的）。
