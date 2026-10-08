# glossary — 用語

同じ語が複数のものを指す場所だけを書く。自明な語は書かない。

## sketch の URL は 1 つだけ

| URL | 中身 |
|---|---|
| `takumifukasawa.com/lab/<NNN-slug>/` | **作品が実際に動く**（`public/lab/<NNN-slug>/` のビルド成果物） |
| `takumifukasawa.com/` | 全 sketch のグリッド。クリックで上へ飛ぶ |
| `takumifukasawa.com/about/` | 自己紹介・Links・PaleGL |

サブドメインは使わない（決定 0001）。URL を削れば `/lab/` → `/`（301。`spec/site-v0.md`）でトップへ着く。
`media.takumifukasawa.com` だけはサブドメイン（R2 の custom domain はこの形しか取れない）。

## sketch 1 件は同じ repo の 3 か所に分かれている

| | パス | 中身 | コミットするか |
|---|---|---|---|
| ソース | `lab/<NNN-slug>/` | `index.html`（OGP 入り）/ `main.ts` / シェーダー。Vite / npm / TS / GLSL を自由に使う | する |
| ビルド成果物 | `public/lab/<NNN-slug>/` | 手元で `pnpm lab:build` した出力（Vite の `outDir` が直接ここへ） | **する**（これが配信される） |
| カード | `src/content/lab/<NNN-slug>.md` | frontmatter（`date` / `title` / `medium` / `poster` / `tags` …） | する |

**成果物をコミットするのが設計の核**。Cloudflare Pages のビルドは Astro だけを走らせ、
`public/` はコピーするだけなので、**サイトのビルドは作品のコードに触らない**。
だから作品のビルドが壊れてもサイトは出るし、依存を上げても既存作品の bundle は変わらない（決定 0001）。

## `lab` が指すもの 3 つ

決定 0002 で tier 1 の語を `lab` に 1 語統一した。構造上は「覚える対応がゼロ」になる一方、
**会話で指すものが曖昧になる**。以下の呼び方で区別する。

| 呼び方 | 指すもの |
|---|---|
| **`lab/` ディレクトリ** | 作品のソース置き場。`index.html` があるものだけがビルドされる（決定 0003） |
| **lab コレクション** / `src/content/lab/` | カードの置き場（md 群）。Astro の content collection |
| **`/lab/`** | 配信される URL（`takumifukasawa.com/lab/<NNN-slug>/`） |

## その他

| 語 | 意味 |
|---|---|
| **sketch** | tier 1 の 1 件の呼び方。URL と識別子には出さない（決定 0002） |
| **technical study** | `notes` の記事が紐付いた sketch。独立した階層ではない（`spec/content-model.md`） |
| **`medium`** | 媒体の種別（`runtime` / `video` / `image`）。明示フィールドとして持つ |
| **`tags`** | 技術と意図を混ぜた 1 本のタグ列（`threejs` / `glsl` / `density` …）。script がソースから推定して埋める。検査は既知語の表記ゆれだけで、**未知語は通す** |
| **`description`** | 任意の説明。空のまま運用してよい。長さ制限なし |
| **shell** / `_shell.js` | 作品ページ（`/lab/<NNN-slug>/`）に出す、トップへの導線。作品には読み込みの 1 行だけが入り、見た目はサイト側の `public/_shell.js` 1 ファイルで決まる（決定 0004） |
| **mediaKey** | R2 のオブジェクトキー。frontmatter はこれだけを持ち、ホスト名を書かない（決定 0001） |
