# architecture — 境界と不変条件

<!-- 目的: エージェントが「どこに何を置き、何に依存してよいか」をリポジトリだけから推論できるようにする。
     実装の細部は縛らない。境界・依存の向き・データの検証点といった不変条件だけを書き、
     可能な限り機械的に強制する（リンタ・構造テスト）。強制手段が無い不変条件は「未強制」と明記する。 -->

状態: 草案（決定 0001 の合意後に確定）

## 全体の地図

repo は 1 つ。サイト・作品・カードが同じ repo に揃い、**メディアだけが外**にある（決定 `decisions/0001-overall-architecture.md`）。

```
takumifukasawa.com  (1 repo / Astro static / Cloudflare Pages)
  ├─ src/                        Astro（サイト本体）
  ├─ src/content/lab/            カード = metadata の正本（Markdown）
  ├─ lab/<NNN-slug>/             作品のソース（Vite / npm / TS / GLSL 自由）
  ├─ public/lab/<NNN-slug>/      作品のビルド成果物（★ コミットする。Vite の outDir が直接ここへ出す）
  ├─ public/_shell.js            作品ページに出すサイトへの導線（サイト側の手書き 1 ファイル。決定 0004）
  ├─ media/manifest.json         R2 に置いたメディアの索引（生成物だがコミットする）
  └─ 外部参照
       └─ media.takumifukasawa.com   R2 bucket。poster / mp4
```

### このリポジトリ内の層

```
src/content/        frontmatter（データ）           … content.config.ts の schema が境界
src/data/           語彙の定義（技術タグの正規名と alias）  … 依存なし
src/lib/            純粋ロジック（media 解決・collection クエリ）
src/components/     表示
src/layouts/        ページの外枠
src/pages/          ルーティング
lab/                作品のソース。src/ からは参照しない（独立）
public/lab/         作品のビルド成果物。Astro はコピーするだけ
scripts/            公開フローの CLI（Astro に依存しない）
```

## 依存の向き（許される辺だけを列挙する）

`src/data → src/lib → src/components → src/layouts → src/pages`

- `src/lib` は `src/components` を知らない。
- `src/components` は `getCollection()` を直接呼ばない。collection の取得は `src/pages`（または `src/lib/collections.ts`）で行い、components には**解決済みのデータを props で渡す**。
- `scripts/` は `src/` と `lab/` に依存してよいが、`src/` は `scripts/` と `lab/` に依存しない。
- **`lab/`（作品のソース）と `src/`（サイト）は互いに import しない。** 作品はサイトのビルドに参加せず、成果物として `public/lab/` に置かれるだけ。
- 外部 URL（R2）の組み立ては `src/lib/media.ts` だけが知る。**他の場所にホスト名を書かない。**
- **作品とサイトの接点は `/_shell.js` の 1 行だけ**（決定 0004）。作品は `_shell.js` をバンドルせず、`_shell.js` は作品の DOM・CSS・グローバル変数に依存しない。

## 不変条件と強制手段

| 不変条件 | 強制手段 | 状態 |
|---|---|---|
| frontmatter は schema を満たす | `astro check` / `astro build`（`.harness/checks.sh`） | 未強制（実装前） |
| frontmatter の mediaKey は `media/manifest.json` に実在する | `.harness/checks.sh` の `media keys resolve`（ネットワークに触らない） | 未強制（実装前） |
| `tags` に既知語の表記ゆれが無い（未知語は通す） | `.harness/checks.sh` の `tag normalization` | 未強制（実装前） |
| メディアのホスト名が `src/lib/` 以外に出てこない | `.harness/checks.sh` の grep 検査 | 未強制（実装前） |
| v0 のサイトは iframe を 1 つも生成しない（実物へは別タブリンク） | 未強制（レビュー観点。`spec/site-v0.md` の受け入れ条件） | 未強制 |
| サイトのビルドは作品のコードに触らない（`public/lab/` をコピーするだけ） | ビルドがネットワークを使わないこと（外部 fetch を入れない） | 未強制（レビュー観点） |
| R2 の key は上書きしない | `scripts/lab-add.ts` が既存 key を put しない | 未強制（実装前） |
| `src/` は `lab/` を import しない（作品はサイトのビルドに参加しない） | `.harness/checks.sh` の grep 検査 | 未強制（実装前） |
| `public/lab/<slug>/` の成果物が `lab/<slug>/` の現在のソースから作られている | `.harness/checks.sh` の `lab build in sync`（`lab/.build-meta/<slug>.json` の sourceHash と再計算値を比較） | 未強制（実装前） |
| git の index に 2 MB 超のファイルが無い（許可リストを除く） | `.harness/checks.sh` の `no large files` | 未強制（実装前） |
| `public/lab/*/index.html` はすべて `<script src="/_shell.js" defer>` を含む（`data-shell="none"` で無効化するのは可） | `.harness/checks.sh` の grep 検査 | 未強制（実装前） |
| 成果物の `<title>` / `og:title` が md の `title` と一致する（正本は md） | `.harness/checks.sh` の `lab head in sync` | 未強制（実装前） |

## 意図的に許している自由

- CSS の書き方（素の CSS / Tailwind / CSS Modules のいずれでもよい）。作品が主役なのでサイト側の見た目は後から変えられるようにしておく。
- `lab/` 配下のライブラリ選択とビルド設定は作品ごとに自由（Three.js / 素の WebGPU / PaleGL など）。成果物をコミットするので、後から依存を上げても既存作品は壊れない。共通化は 3 回ルール（`spec/publish-pipeline.md`）のみで縛る。
- Notes の MDX コンポーネントの作り方。
