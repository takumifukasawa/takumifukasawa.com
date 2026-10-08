# learnings — 踏んだ罠と対処

<!-- 書くのは「コードや git log から導出できないこと」だけ。
     形式は「症状 → 原因 → 対処（再発したらまず X を見る）」。日付は絶対日付。
     プロジェクト非依存のものには [harness候補] を付ける。harness-maintain が昇格を検討する。
     昇格先の優先順位: 検査スクリプト（check.sh）> スキル > AGENTS.core.md の文章 -->

## 2026-10-08 pre-commit の実行ビットが git index 上で落ちて、フックが黙って無視される（Windows）

- 症状: `harness init` 直後は `doctor` が OK だったのに、`git add -A` を挟んだ後の `doctor` が
  「`.githooks/pre-commit` が実行できない状態（git index 上の mode が 100644）」で FAIL した。
  **commit は成功するのに検査が走らない**ので、気づく手段が `doctor` しかない。
- 原因: Windows は実行ビットを持たないため、`git add` でファイルモードが 100644 として index に入りうる。
  git は実行できないフックを**黙って無視する**。
- 対処 / 再発したら: `chmod +x .githooks/pre-commit && git update-index --chmod=+x .githooks/pre-commit`。
  **commit する前に `bash .harness/bin/harness doctor` を回す**習慣にすると、この種の「静かに効かなくなる」状態を拾える。

## 2026-10-08 ビルド成果物を複数ディレクトリにコミットしても、git blob は共有されない

- 症状: 「Vite は依存を content-hash 付き vendor チャンクに分けるので、同じバージョンなら同じファイル =
  git は 1 つの blob を共有する」という前提で repo サイズを ~20 MB と見積もったが、検算で崩れた。
- 原因: 2 段ある。(1) Vite は**単一エントリのアプリビルドで vendor チャンクを自動分割しない**
  （公式 build ドキュメントに自動分割の記述が無く、`build.rolldownOptions.output.codeSplitting` 等で明示設定する前提）。
  (2) より決定的なのは **tree-shaking** — 作品ごとに使うライブラリの範囲が違うので、仮に vendor チャンクを
  分けても中身が作品ごとに異なり、content hash も変わる。
- 対処 / 再発したら: 見積りは「1 件あたりのバンドルサイズ × 件数」で出す（Three.js を使う作品で 400〜600 KB）。
  本当に 1 コピーにしたいなら、依存を `external` にして共有ファイルを 1 本置き、各作品がそれを import する。
  詳細は `decisions/0001-overall-architecture.md` の「repo サイズ」。

## 2026-10-08 [harness候補] scaffold 時に「未来の URL」を埋める設計では、URL に時刻依存の要素を入れてはいけない

- 症状: 作品の雛形を作る時点で `og:image` に R2 の URL（`lab/<YYYY>/<slug>/poster.webp`）を書き込む設計にしていた。
  12 月に雛形を作って 1 月に画像をアップロードすると**年が変わって URL が食い違い、`og:image` が 404 のまま残る**。
  X はカードをキャッシュし、Card Validator が廃止されているので**取り返しがつかない**。
- 原因: 「URL が予測可能だから先に書ける」という利点に乗ったが、予測の材料に**実行時刻**が混ざっていた。
- 対処 / 再発したら: 予測 URL に使う材料は、**scaffold 時と公開時で必ず同じ値になるもの**（slug、連番）だけにする。
  日付・年・タイムスタンプは入れない。この件では R2 の key から年を外した（`lab/<NNN-slug>/...`）。

## 2026-10-08 macOS で大文字小文字だけ違うファイル名へ「書いてから旧名を rm」すると新しいファイルが消える [harness候補]

- 症状: `TimeAccumulator.ts` を `timeAccumulator.ts` にリネームするつもりで、新しい名前で書き込んだ後に `rm TimeAccumulator.ts` したら、
  ディレクトリが空になった。エラーは出ず、後のビルドが `Could not resolve './time/timeAccumulator.ts'` で落ちて初めて気づいた。
- 原因: macOS（APFS の既定）は大文字小文字を区別しない。2 つの名前は同じファイルを指していて、書き込みは上書き、`rm` はその 1 つを消した。
- 対処: 大文字小文字だけのリネームは `git mv Old.ts old.ts`（未追跡なら `mv Old.ts tmp && mv tmp old.ts`）で行い、旧名を `rm` しない。
  **再発したらまず**、リネーム後に `ls` で新しい名前の実体があるかを見る。
