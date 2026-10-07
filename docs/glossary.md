# glossary — 用語

同じ語が複数のものを指す場所だけを書く。自明な語は書かない。

## sketch 1 件は 2 つの場所に分かれている

| | コード（作品そのもの） | カード（紹介ページ） |
|---|---|---|
| どこ | **lab リポジトリ**（`github.com/takumifukasawa/lab`） | **この個人サイトの repo**（`src/content/lab/<NNN-slug>.md`） |
| 中身 | `index.html` / `main.ts` / シェーダー | frontmatter（`date` / `title` / `medium` / `poster` / `tech` …） |
| 公開先 | `lab.takumifukasawa.com/<NNN-slug>/` ← **実際に動く** | `takumifukasawa.com/lab/<NNN-slug>/` ← **紹介を読む** |

## `lab` が指すもの 4 つ

決定 0002 で tier 1 の語を `lab` に 1 語統一した。構造上は「覚える対応がゼロ」になる一方、
**会話で指すものが曖昧になる**。以下の呼び方で区別する。

| 呼び方 | 指すもの |
|---|---|
| **lab リポジトリ** / `lab` repo | 作品の実行コードが入る GitHub repo。`index.html` があるものだけがデプロイされる（決定 0003） |
| **lab サイト** / `lab.takumifukasawa.com` | 上をデプロイしたもの。作品が動く場所 |
| **lab コレクション** / `src/content/lab/` | この個人サイト側の metadata（md 群）。Astro の content collection |
| **`/lab/`** | この個人サイトの URL（`/lab/<NNN-slug>/`） |

## その他

| 語 | 意味 |
|---|---|
| **sketch** | tier 1 の 1 件の呼び方。URL と識別子には出さない（決定 0002） |
| **technical study** | `note` が紐付いた sketch。独立した階層ではない（`spec/content-model.md`） |
| **`medium`** | 媒体の種別（`runtime` / `video` / `image`）。見せ方ではない |
| **`tech`** | 技術の軸。集計用。語彙を `src/data/tech.ts` で検査する |
| **`themes`** | 感覚・視覚の軸（密度 / 静けさ / 侵食 …）。**検査しない**（`spec/content-model.md`） |
| **`core`** | その sketch で自分が直接書いた技術的コア（1 行） |
| **mediaKey** | R2 のオブジェクトキー。frontmatter はこれだけを持ち、ホスト名を書かない（決定 0001） |
