# glossary — 用語

同じ語が複数のものを指す場所だけを書く。自明な語は書かない。

## sketch の URL は 1 つだけ（v0）

詳細ページを作らないので（`spec/site-v0.md`）、sketch を指す URL は 1 つ。

| URL | v0 | 中身 |
|---|---|---|
| `lab.takumifukasawa.com/<NNN-slug>/` | **ある** | **作品が実際に動く**（lab repo のデプロイ） |
| `takumifukasawa.com/` | **ある** | 全 sketch のグリッド。クリックで上へ飛ぶ |
| `takumifukasawa.com/lab/<NNN-slug>/` | **ある（301）** | `lab.takumifukasawa.com/<NNN-slug>/` へリダイレクト。口頭で言える URL を確保するため（決定 0001）。サイト側の詳細ページを作る予定は無い |

サブドメインが正規なのは、1 ドメインに寄せる 2 つの方法がどちらも割に合わないため（決定 0001）。
Workers プロキシは無料枠 10 万リクエスト/日を 1 件のバズで 2.4 時間で尽くしてサイトが落ちる。
1 repo 統合は 500 件分のビルド成果物を repo にコミットすることになる。
代わりに `_redirects` 1 行で `takumifukasawa.com/lab/*` も使える URL にしてある。

## sketch 1 件は 2 つの場所に分かれている

| | コード（作品そのもの） | カード（グリッドの 1 枚） |
|---|---|---|
| どこ | **lab リポジトリ**（`github.com/takumifukasawa/lab`） | **この個人サイトの repo**（`src/content/lab/<NNN-slug>.md`） |
| 中身 | `index.html`（OGP 入り）/ `main.ts` / シェーダー | frontmatter（`date` / `title` / `poster` / `tags`） |
| 役割 | `lab.takumifukasawa.com/<NNN-slug>/` で動く | `takumifukasawa.com/` のグリッドに並ぶ |

## `lab` が指すもの 3 つ

決定 0002 で tier 1 の語を `lab` に 1 語統一した。構造上は「覚える対応がゼロ」になる一方、
**会話で指すものが曖昧になる**。以下の呼び方で区別する。

| 呼び方 | 指すもの |
|---|---|
| **lab リポジトリ** / `lab` repo | 作品の実行コードが入る GitHub repo。`index.html` があるものだけがデプロイされる（決定 0003） |
| **lab サイト** / `lab.takumifukasawa.com` | 上をデプロイしたもの。作品が動く場所 |
| **lab コレクション** / `src/content/lab/` | この個人サイト側の metadata（md 群）。Astro の content collection |

（`takumifukasawa.com/lab/*` は 301 リダイレクトとしてだけ存在する。ページは無い）

## その他

| 語 | 意味 |
|---|---|
| **sketch** | tier 1 の 1 件の呼び方。URL と識別子には出さない（決定 0002） |
| **technical study** | `note` が紐付いた sketch。独立した階層ではない（`spec/content-model.md`） |
| **`tags`** | 技術と意図を混ぜた 1 本のタグ列（`threejs` / `glsl` / `density` / `erosion` …）。script がソースから推定して埋める。検査は既知語の表記ゆれだけで、**未知語は通す**（`spec/content-model.md`） |
| **`description`** | 任意の説明。空のまま運用してよい。長さ制限なし |
| **mediaKey** | R2 のオブジェクトキー。frontmatter はこれだけを持ち、ホスト名を書かない（決定 0001） |
