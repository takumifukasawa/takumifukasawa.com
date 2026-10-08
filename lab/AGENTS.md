# lab — 作品のソース置き場の規律

`lab/<NNN-slug>/` は作品 1 件のソース。ビルド成果物は `public/lab/<NNN-slug>/` に固定される（決定 0001）。

## コードを書く前に

**`../docs/coding.md` の「lab」の節を読む。** class を使わない、文字列で参照されるプロパティはクォートする（terser がプロパティ名まで mangle する）、
破損はビルド済みの成果物で確かめる、などの規約がある。

## 常に守ること

- 作品の `vite.config.ts` は作品ごとのコピーにする。共通ファイルからの import にしない
  （成果物は作品ごとに固まるので、共通設定の変更が `lab:rebuild --all` で古い作品を変えないように）。
- 共通化は 3 回ルール（`core/AGENTS.md`）。

## やらないこと

- shader の核・数式・GPU アルゴリズム・rendering logic を AI が書き切らない（`../AGENTS.md` の AI との分担。骨組みを示して止まる）。
