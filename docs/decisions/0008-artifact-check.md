# 0008: ビルド成果物をヘッドレスで開く検査を入れ、property mangling は既定で切る

- 日付: 2026-10-12
- 状態: 採用
- 関連: `0001-overall-architecture.md`（成果物をコミットして配信する）, `0004-lab-shell.md`, `../coding.md`, `../learnings.md`（2026-10-12）

## 背景

greeble の開発中、**`pnpm dev:lab` では完璧に動くのにビルド成果物だけが真っ黒**になった。
コンソールには `TypeError: Cannot read properties of undefined (reading 'replace')` が 1 行だけで、
スタックは mangle 済みで読めない。

原因は作品の `vite.config.ts` の `mangleProperties`（terser の `mangle.properties`）。
three は `#include <common>` のチャンク名を**シェーダーの文字列から取り出して** `ShaderChunk[name]` で引く。
mangle はキー側だけを書き換えるので、文字列側と食い違って `undefined` になる。

**偶然見つかっただけ**だった。成果物を直接配信して開いたのはこのときが初めてで、
やらなければ公開して初めて気付いていた。決定 0001 により成果物は作品ごとに凍結されるので、後から直せない。

## 採用案: 成果物を実際に開く検査を 1 本持ち、minify の設定はそれに守らせる

`.harness/checks.sh` の `artifacts run` → `scripts/check-artifacts.ts`。

- `public/` を静的配信して（`public/lab/<slug>/` 単体ではない。**本番と同じパス**で `/_shell.js` も解決される）
  `public/lab/*/index.html` をヘッドレス Chrome で開き、2.5 秒待って**コンソールエラーと未捕捉例外が 0 件**であることを見る
- 依存は増やさない。Node 内蔵の `WebSocket` で CDP を直接叩く（`scripts/lib/chrome.ts`、約 100 行）。
  puppeteer / playwright はブラウザのダウンロードを連れてくる
- Chrome が見つからない環境では**明言して pass**。コミットを止めない代わりに、黙って緑にはしない
- 遅い（Chrome 起動で数秒）ので `fast` にしない = pre-commit では走らない

### なぜ「mangle を禁止する」側で解かないか

**mangle の利得と危険は同じ場所から来ている。** 実測:

| | raw | gzip |
|---|---|---|
| mangle on | 599,239 | 155,378 |
| mangle off | 721,140 | 168,388 |
| 差 | +121,901 (20.3%) | **+13,010 (8.4%)** |

sketch 自身のソースは未 minify で 28 KB（半分はコメント）しかない。つまり 122 KB の節約は**ほぼ全部
three と tweakpane の内部を改名した分**で、危険もそこから来ている。配信も git の pack も圧縮されるので、
実際に払うのは **13 KB**。

一方、禁止側で解こうとすると粗い判定しか作れず（「three を import していたら落とす」）、
`RawShaderMaterial` だけの sketch にも 13 KB を払わせる。**判定ではなく実行で確かめる**方が正確で安い。

### three を mangle したまま通す道は、実際に試して閉じた

`mangle.properties.reserved` を three 自身から生成すれば予約できるはず、という筋を検査の上で試した。
**3 回壊れ、3 つ目で公開 API から手が出なくなった。**

| 回 | 壊れた所 | 予約できるか |
|---|---|---|
| 1 | `ShaderChunk[include]` | ○ `Object.keys(ShaderChunk)` |
| 2 | `ShaderLib[shaderID]` | ○ `Object.keys(ShaderLib)` |
| 3 | `shaderIDs[material.type]` | **× export されていない** |

4 つ目を事前に列挙する手段が無く、成果物は凍結されるのに予約リストは three のバージョンごとに変わる。
**13 KB のために張る賭けではない。** three を bundle する sketch は `mangleProperties = false`。

### `mangleProperties` の既定は `false` にする

このフラグには**「役に立ちかつ安全」な領域が無い**。

| sketch | 節約 | 安全か |
|---|---|---|
| ライブラリを bundle しない | ほぼ 0（自分のコードは数 KB） | 安全 |
| ライブラリを bundle する | 13 KB（**全部ライブラリ由来**） | 危険も全部そこ |

節約が出る条件と危険が出る条件が同じなので、どちらの側でも割に合わない。

そして本当のコストは 13 KB ではなく、**全 sketch に課していた規律の方**だった。
`../coding.md` の「文字列で参照されるプロパティはクォートする」は mangle のためだけに存在する規則で、
uniform 名・Tweakpane のキー・JSON のキーを毎回クォートし、守れたかは**ビルド成果物でしか分からない**。
既定を off にすると、この規律ごと消える。13 KB より確実に安い。

フラグ自体は残す（作品ごとのコピーなので）。立ててよいのは**ライブラリを bundle しない大きめの自作コード**だけで、
立てたまま three を足したら `artifacts run` が落ち、エラー文が `mangleProperties = false` と書く。

## 落選案と落選理由

| 案 | 落選理由 |
|---|---|
| 「three を import していたら `mangleProperties = true` を落とす」検査 | 粗すぎる。`RawShaderMaterial` だけの sketch（001 がそうだった）も落ちて 13 KB を払う。危険の有無ではなく import の有無しか見ていない |
| 組み込みマテリアル名（`MeshStandardMaterial` 等）を grep する検査 | リストの維持が要り、**漏れたときに「検査が通った＝安全」という誤った安心を生む**。検査として最悪の失敗の仕方 |
| 成果物の `#include <NAME>` と `NAME:` キーを突き合わせる検査 | 依存ゼロで実際に判別できた（実測）。だがこの壊れ方 1 つにしか効かず、実際に 2 つ目・3 つ目が出た。ヘッドレス検査が入るなら要らない |
| `mangle.properties.reserved` を three から生成 | 上記のとおり 3 つ目で閉じた |
| `mangle.properties.regex` で自分の命名だけ mangle | 完全に安全だが、自分のコードは 28 KB しかないので節約がほぼ 0。複雑さだけが残る |
| テンプレートの既定を `true` のまま、検査だけに捕まえさせる | 検査は壊れたことは教えるが、**クォート規律は全 sketch に残り続ける**。13 KB より高い。しかもライブラリを bundle しない sketch では節約がほぼ 0 なので、既定が `true` である利点がそもそも無い |
| puppeteer / playwright を使う | ブラウザのダウンロードを連れてくる。CDP を直接叩けば約 100 行で、依存ゼロ |
| ヘッドレス検査を `fast` にする（pre-commit で走らせる） | Chrome 起動で数秒。毎コミットに乗せると、コミットを避ける圧力になる（目的と逆） |

## 影響・やり直す条件

- `scripts/lib/chrome.ts`（CDP ドライバ）と `scripts/check-artifacts.ts`（検査本体）。
  環境メッセージと本物のエラーを分ける判定は `isEnvironmentProblem()`（`scripts/lib/page-problems.ts`。2026-10-17 に `chrome.ts` から分けた。
  ドライバと検査の方針を混ぜないため）で、**テストで両方向を固定している**（`scripts/lib/page-problems.test.ts`）。ここを緩めると検査が「壊れたビルドへの緑信号」に変わる
- `ENVIRONMENT_PHRASES` は**実際にその環境が出力したものだけ**追加する。推測で足すと穴になる
- `pnpm lab:add` の前にこの検査が通っていることが、公開の前提
- やり直す条件: Chrome の起動が重くて検査を回さなくなったら。その場合は「`lab:add` の中でだけ走らせる」に移す
  （毎回ではなく公開時だけに寄せる）

## 追記 2026-10-17: `console.error` を成果物に残す / WebGPU の作品は実 GPU でも開く

- **成果物から `console.error` / `console.warn` を消さない**（作品の `vite.config.ts` の `drop_console: ['log', 'info', 'debug']`。雛形も）。
  `drop_console: true` は three がシェーダーの失敗を知らせる `console.error` ごと消していて、この検査は壊れたシェーダーを素通りさせていた
  （`learnings.md` 2026-10-17）。判定は文言に頼らず「`console.error` か未捕捉の例外が 1 件でもあれば失敗」のまま。
- **WebGPU の作品は 2 回開く**: いまのソフトウェア WebGL のブラウザ（全作品）と、フラグなし＝実 GPU のブラウザ（`lab:add` のタグ推定で
  `webgpu` になる作品だけ）。実 GPU のブラウザで adapter が取れなければ `SKIPPED` と明示する（黙って `ok` にしない）。
  - 落選: Chrome の warning の文言で WebGPU の検証エラーを拾う（文言が変わると穴になる）、SwiftShader の WebGPU
    （正常な作品でも canvas のテクスチャで落ちる）、全作品を実 GPU にする（既存の WebGL 作品の検査条件まで変わる）、
    `--disable-gpu` だけ外す（ANGLE が SwiftShader のあいだは adapter が null のまま）。
  - やり直す条件: SwiftShader の WebGPU が正常な作品を描けるようになったら、実 GPU をやめて 1 回に戻せる（GPU の無いマシンでも検査できる）。

