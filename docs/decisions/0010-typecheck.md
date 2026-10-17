# 0010: TypeScript の型検査を必須にする（`src/`・`scripts/`・`lab/`）

- 日付: 2026-10-17
- 状態: 採用
- 関連: `0006-lab-archives.md`（棚上げしたコードは対象外）, `0008-artifact-check.md`, `../plans/active/site-and-lab.md`（1-5 の一部を前倒し）

## 背景

リポジトリには TypeScript も `tsconfig.json` も無く、**型は誰にも検査されていなかった**。
`scripts/` は Node の型剥がし（`node scripts/x.ts`）で、`lab/` は Vite で動くので、どちらも型を見ずに実行できてしまう。

2026-10-17 の voxel rain 制作で、エージェントが `npx tsc --noEmit -p .` を「型チェック」として何度も回し、
「通った」と報告していた。実際には `typescript` が入っておらず、`npx tsc` は別物のパッケージの案内を出していただけで、
出力を `lab/wip` で絞り込んでいたため何も表示されず、通ったように見えていた。
その間に、関数名の付け替え漏れがクリック時の `ReferenceError` として残った（ブラウザで動かして初めて見つかった）。

## 採用案

- `typescript`（**6 系に固定**）・`@astrojs/check`・`@types/node` を devDependencies に入れる。
  Tweakpane の型は `@tweakpane/core` を import するのに tweakpane はそれに依存していないので、`@tweakpane/core` も入れる。
- ルートの `tsconfig.json` は `astro/tsconfigs/strict` を継承し、`src/`・`scripts/`・`lab/` を対象にする。
  除外は `public/`（ビルド成果物）・`lab-archives/`（決定 0006）・`.harness/`。
  - `erasableSyntaxOnly`: `scripts/` は Node が型を剥がして実行するので、剥がせない構文（enum など）を型検査の段階で止める。
  - `types: ["node", "vite/client"]`: `scripts/` の `node:*` と、`lab/` の `import.meta.env` / `import.meta.hot`。
- `pnpm typecheck`（= `astro check`）を `harness check` に「types pass」として登録する。
  `astro check` は `.astro` だけでなく、tsconfig が対象にする `.ts` もすべて見る（`lab/wip` にわざと型エラーを入れて、終了コード 1 で落ちることを確かめた）。
  10 秒ほどかかるので、pre-commit で回る fast にはしない。

### 公開済みの作品の扱い

greeble-flow と grid-ray-clock も対象に含める。導入時に出た型エラーは、型だけの修正（`as` のキャスト）で直した。
修正後に作り直した成果物は、公開済みのものと**バイト単位で同じ**だった（`diff -rq` で差分なし）。
変わったのは `lab/.build-meta/<slug>.json` のソースのハッシュだけ。成果物を固定する方針（決定 0001）とは矛盾しない。

## 落選案と落選理由

- **TypeScript 7（npm の最新）を入れる**: `astro check` が 7 以上だと止まる（`astro/dist/cli/check` が拒否する）。
  `@astrojs/check` の peer も `^5 || ^6`。Astro が対応するまで 6 に留める。
- **`tsc --noEmit` を別に回す**: `astro check` だけで `.astro` と `.ts` の両方を見られるので、2 本にする理由が無い。
  `astro check` が廃止されたら（Astro は将来の廃止を予告している）、その時に置き換える。
- **公開済みの作品を対象から外す**: 外すと、次に作品を出すたびに除外の一覧を足すことになり、どの作品が検査されているかが分かりにくくなる。
  型だけの修正なら成果物は変わらないので、外す理由が無い。
- **tsconfig の `paths` で `@tweakpane/core` の解決先を指定する**: 導入時に Pane のメソッドが全部見えなくなり、原因を pnpm の解決だと考えて足した。
  実際の原因はインストールの途中失敗（symlink だけあって中身が無かった）で、`pnpm install` で直った後は `paths` が無くても通ったので外した。

## 影響・やり直す条件

- 新しい作品（`pnpm new`）も最初から検査される。型エラーがあると `harness check` が落ちる。
- `astro check` が TypeScript 7 に対応したら、6 への固定を外してよい。
- 型検査を通すために `// @ts-ignore` や除外を足すのは、検査を弱めることになる（`AGENTS.md`）。必要なら理由をここに書き足す。
