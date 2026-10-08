# 0001: 全体構成 — 1 repo / 1 ドメイン / media は R2

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

repo は 1 つ。分けるのは**ビルドのタイミング**と**メディアの置き場**。

| 層 | 置き場 | 配信 | ビルドされるタイミング |
|---|---|---|---|
| ハブ（sketch のグリッド / About） | `takumifukasawa.com` repo の `src/`（Astro, static） | Cloudflare Pages → `takumifukasawa.com` | push ごと |
| 作品（Three.js / WebGPU など） | 同 repo の `lab/<NNN-slug>/`（Vite / npm / TS / GLSL を自由に） | 同 Pages（`public/lab/` 経由） | **手元で作った時に 1 回だけ** |
| メディア（mp4 / poster 画像） | Cloudflare R2 bucket | custom domain → `media.takumifukasawa.com` | — |

**サイトは作品の実行環境ではなく、作品を束ねるハブ**という方針は維持する。
ただしそれを「repo を分ける」ことで実現するのではなく、**作品のビルド成果物を固定する**ことで実現する。
これで 1 ドメイン・1 repo のまま「作品側の事故がサイトを落とさない」が成り立つ（詳細は下の「鍵は『作品をビルドするタイミング』」）。

### metadata の正本

sketch 1 件 = 3 つのものが同じ repo に揃う。

| | パス |
|---|---|
| ソース | `lab/<NNN-slug>/` |
| ビルド成果物 | `public/lab/<NNN-slug>/`（コミットする） |
| カード（metadata） | `src/content/lab/<NNN-slug>.md` |

### メディアは R2、frontmatter は key だけを持つ

- `media/manifest.json`（サイト repo、生成物をコミット）が `key → { url 相対, width, height, bytes, durationSec }` を持つ。
- frontmatter は `poster: lab/001-flow-field/poster.webp` のような **key のみ**。ホスト名を書かない。
- アップロード script が ffmpeg / sharp で最適化 → R2 に put → manifest に追記、までを 1 コマンドでやる。
- 一度置いた key は上書きしない（immutable、`Cache-Control: public, max-age=31536000, immutable`）。差し替えは新 key。

これで (a) ドメイン / CDN を変えても frontmatter を触らない、(b) `width`/`height` が全メディアに付くので CLS が出ない、(c) **オフラインで決定的に検査できる**（R2 を叩かずに「frontmatter の key が manifest にあるか」を `harness check` で見られる）。

**例外: Notes の本文中に置く静止画（図・スクリーンショット）は R2 ではなく `src/assets/` に置き、Astro の画像最適化に任せる。**
非対称にする理由は件数。記事の図は増えないので、複数幅の自動生成と AVIF 変換の利得をそのまま取れる。
一方 `lab` の poster は 500 件に向かって増え、ビルド時間が件数に線形で伸びるため repo の外（R2）に出す必要がある。
動画は長さ・サイズ・Astro が扱えないことから、記事中のものも含めて常に R2。

### live 作品は v0 では別タブで開く。サイト内 embed は後から

v0 ではサイト内に `<iframe>` を置かない。実物へは**別タブで開くリンク**にする。

薄く始められること以上に、副作用が良い方向に効く。

- クリックロード機構、GPU を食う作品が一覧に影響する問題、モバイルの出し分けが v0 から全部消える
- `takumifukasawa.com/lab/<NNN-slug>/` が主役になり、**作品の URL が独立して流通する**（X から直リンクが張れる）

将来サイト内で完結させるときは、**URL が変わらないのでリンクを iframe に差し替えるだけ**で移行できる。
その時点では以下を守る（v0 で捨てた判断ではなく、embed を入れる時に適用する）。

> `<iframe>` は最初から DOM に置かない。poster 画像 + 再生ボタンを出し、**クリックで初めて iframe を挿入**する。
> `loading="lazy"` や IntersectionObserver による自動ロードは採らない（WebGPU / Three.js の作品が複数同時に走ると、一覧ページで GPU とメモリを食い潰す）。

### 作品も同じドメインに置く。URL は `takumifukasawa.com/lab/<NNN-slug>/`

サブドメイン（`lab.takumifukasawa.com`）は採らない。**URL を削ってトップへ行こうとする人は必ずいる**し、
2 つのドメインを行き来する構成は、貼る URL・OGP・キャッシュのすべてで 2 系統を考えることになる。

```
takumifukasawa.com/
├── src/                          Astro（サイト）
├── lab/<NNN-slug>/               作品のソース（Vite / npm / TS / GLSL を自由に使う）
├── public/lab/<NNN-slug>/        作品のビルド成果物（★ コミットする）
└── src/content/lab/<NNN-slug>.md  カード（frontmatter）
```

### 鍵は「作品をビルドするタイミング」

**Cloudflare Pages のビルドは Astro だけを走らせる。** `public/` はコピーされるだけなので、
**サイトのビルドは作品のコードに一切触らない**。作品のビルドは手元で 1 件ずつ、作った時に 1 回だけ走る。

これで 1 repo 統合の懸念が 2 つとも消える。

| 懸念 | なぜ消えるか |
|---|---|
| 500 件の Vite ビルドが Pages の 20 分上限に当たる | Pages は作品をビルドしない |
| 古い作品のビルドが壊れてサイトのデプロイが止まる | 成果物が固定されている。**依存を上げても既存作品の bundle は変わらない** |

2 つ目は副産物として大きい。共通の `package.json` でも、ビルド済みの作品は依存更新の影響を受けない。
**別 repo にする理由（デプロイの独立）が、成果物の固定で代替される。**

### repo サイズ（成果物をコミットする代償）

**この方式の唯一の実コストがここ。** 当初「Vite の vendor チャンクが content-hash で git blob を共有するので ~20 MB」と見積もったが、
2026-10-08 の検算で**機構ごと誤りだった**ことが分かった。

- Vite は単一エントリのアプリビルドで**vendor チャンクを自動分割しない**（公式 build ドキュメントに自動分割の記述が無く、`build.rolldownOptions.output.codeSplitting` 等で明示設定する前提）。
- より決定的なのは **tree-shaking**。作品ごとに使う Three.js の範囲が違うので、**仮に vendor チャンクを分けても中身が作品ごとに異なり、blob は共有されない**。

再計算した見込み:

| | サイズ |
|---|---|
| WebGLRenderer を使う作品の minified バンドル | 400〜600 KB / 件 |
| 素の WebGL / canvas の作品 | 10〜20 KB / 件 |
| 500 件（6 割が Three.js 系と仮定）| **~150 MB（working tree）** |
| `.git` | zlib と類似 blob の delta 圧縮が効くので小さくなるが、**実測しないと不明** |

**P0 で sketch 5〜10 件を積んだ時点で `du -sh .git` と working tree を実測し、`../learnings.md` に残す。**

### 150 MB が許容できない場合の逃げ道（本当に共有する方法）

Three.js を `external` にして、**1 本の共有コピー**を全作品が import する。

```
public/lab/_vendor/three@0.180.0.module.js    ← 1 コピーだけ置く
```

各作品は import map か直接 URL でこれを読む。Vite は作品自身のコード（TypeScript・GLSL プラグイン・HMR）に使い続けられるので、
**制作体験は変わらない**。バージョンごとに 1 ファイルなので、10 バージョン使っても ~7 MB。

これを**最初からやるかは P0 の実測で決める**（先回りして複雑にしない）。

### 落選案

**サブドメイン + リダイレクト** — `lab.takumifukasawa.com` を正規にし、`/lab/*` から 301 を張る。
URL が 2 系統になり「どちらを貼るか」が毎回の判断になる。URL を削った人の救済にもリダイレクトが必要で、
全体がややこしい。上記の成果物コミット方式でデプロイの独立性が保てるので、分ける理由が無い。採らない。

**Cloudflare Workers で `/lab/*` を別 Pages project にプロキシする** — URL は同じになるが、
Workers Free は 10 万リクエスト/日。1 件バズって 10 万人が来ると（1 人あたりアセット 10 リクエストで）1 日 100 万リクエストになり、
無料枠は 2.4 時間で尽きてエラーが返る = **サイトが落ちる**。有料（$5/月）でも Worker の運用が増える。
成果物コミット方式なら $0 で同じ URL が得られる。採らない。

**サイトのビルドで作品もビルドする（成果物をコミットしない）** — 500 件の Vite ビルドが Pages の 20 分上限に当たり、
古い作品の 1 件が壊れるとサイトが出せなくなる。採らない。

### Astro / Cloudflare Pages

依頼文の案（Astro + Content Collections + Cloudflare Pages + R2）をそのまま採用する。静的出力 1 本に閉じ、SSR を使わない。

## 落選案と落選理由

**A. サイトと作品を別 repo・別デプロイにする（サブドメイン `lab.takumifukasawa.com`）**
当初の案。URL が 2 系統になり「どちらを貼るか」が毎回の判断になるうえ、URL を削った人の救済にもリダイレクトが要る。
分ける唯一の実利は「作品側のビルド事故がサイトを落とさない」ことだが、**作品の成果物をコミットすれば同じ保証が 1 repo で得られる**。
分ける理由が無くなったので採らない。

**B. 作品の metadata を作品ディレクトリ側（`lab/<slug>/meta.yaml`）に置く**
「作品を作った repo で metadata も書く」ほうが筋は良いが、submodule か GitHub API fetch が必要になり、ビルドが外部状態に依存する（= Cloudflare 側のプレビュービルドが壊れやすく、ローカルと挙動が違う）。Astro Content Collections の型検査も repo 内で完結しなくなる。
v0 では採らない。**移行可能性だけ確保する**: frontmatter にサイト固有の表示指示（レイアウト名・並び順の手指定など）を入れず、フラットな値だけにしておく。将来 B へ移るときは生成元が変わるだけになる。

**C. sketch ごとに repo を分ける**
依頼文のとおり管理コストが高い。Cloudflare Pages の project も 1 作品 1 個になる。採らない
（ただし決定 0003 の 4 条件を満たす重いもの — PaleGL のようなライブラリ、wasm / Rust が混ざるもの — だけは独立 repo に出す）。

**D. メディアをサイト repo に入れて Astro の画像最適化に任せる（`src/assets`）**
500 件 × 動画の repo は clone もビルドも重くなり、ビルド時間が件数に比例して伸びる。Astro の画像最適化は mp4 を扱わない。採らない。

**E. GitHub Pages**
不可能ではないが採らない。公式の制限（2026-10-07 確認。`../references/cloudflare-limits.md`）で差が出るのは 2 点。

1. **帯域が 100 GB/月のソフト上限**。メディアは R2 なのでサイト本体は軽く（詳細ページ 150 KB なら月 67 万 PV 相当）問題にならないが、効くのは作品側で、Three.js のバンドルが 1 MB なら **10 万回で上限**。1 件バズれば数日で到達し、超えると警告 → throttle。**バズった時に「止まる側」に倒れる。** Cloudflare Pages は静的アセットの帯域制限がドキュメントに存在しない。
2. **R2 の custom domain は同じ Cloudflare アカウントのゾーンにしか張れない**。つまり R2 を使う時点で Cloudflare DNS が前提になり、そこから Pages を使わない積極的な理由が残らない。

ほかに `_headers` / `_redirects` が無く Cache-Control も CSP もリダイレクトも設定できない、PR プレビューが無い、という差もある。
GitHub Pages の利点（GitHub だけで完結する／ビルドが Actions で環境の自由度が高い）は認めるが、上記 2 点を上回らない。
**この選択は後から変えられる**（成果物が `dist/` の静的ファイルなので移行は DNS とビルド設定だけ）ので、迷ったら Cloudflare で始めてよい。

**F. SSR / DB で sketch を管理**
件数の問題は静的生成とページ分割で解ける。運用コストに見合わない。採らない。

## 影響・やり直す条件

- `media.takumifukasawa.com` のサブドメインを確保する前提になる（R2 の custom domain）。作品用のサブドメインは不要。
- **ビルド成果物を git にコミットする**ことを受け入れる。見込み ~20 MB（上の実測見込み）。
  Vite の vendor チャンクが content-hash で共有されることに依存しているので、
  **P0 で sketch 5〜10 件を積んだ時点で実測し、見込みから外れていたら `../learnings.md` に残す。**
- **やり直す条件**:
  1. working tree が 300 MB を超えたら、**Three.js を external にして共有コピー 1 本にする**（上の「逃げ道」。URL も制作体験も変わらない）。それでも足りなければ成果物を R2 に移し `/lab/*` を Worker でプロキシする方式を検討する。
  2. Cloudflare が Pages を新規受付停止したら、同じ静的成果物を Workers Static Assets へ移す（成果物が `dist/` の静的ファイルなので移行は deploy 設定だけで済む。この独立性は意図的）。
  3. 1 日の公開手数が 3 コマンドを超えて恒常的に摩擦になったら、落選案 B（作品ディレクトリ側を metadata の正本に）へ移る。
