# 0004: 作品ページからサイトへの導線 — 作品をそのまま配信し、`/_shell.js` を 1 行だけ埋め込む

- 日付: 2026-10-08
- 状態: 採用（2026-10-08）
- 関連: `0001-overall-architecture.md`, `../spec/publish-pipeline.md`

## 背景

sketch の URL `takumifukasawa.com/lab/<NNN-slug>/` には作品が置かれ、X や共有リンクから人が直接来る。
ここに**トップ（`/`）へ戻る導線が無い**。共通ヘッダーやボタンのような、サイト側の何かが要る。

その手前に、より大きな問いがある。**`/lab/<slug>/` は「作品そのもの」か「サイトの 1 ページ」か。**

- (A) 作品そのもの: 作品の HTML をそのまま配信し、導線は薄く足す
- (B) サイトの 1 ページ: Astro のテンプレートが作品を iframe で包む

作品の成果物はビルドした時点で固まる（決定 0001）。後から 500 件に何かを足すのは高いので、sketch 001 より前に決める。

## 採用案: (A)。ただし (B) へ安く乗り換えられる形にしておく

決め手は **iOS Safari でのカメラ・センサー**。カメラ入力（`getUserMedia`）やジャイロ（`DeviceMotionEvent.requestPermission`）を使う作品を作りたい。
(A) なら作品がトップレベルのページなので素直に動く。(B) は iframe 越しになり、過去に「同一オリジンの iframe でも呼ぶたびに許可ダイアログが出る」
（WebKit #210104）「iframe の中に `requestPermission` が存在しない」（WebKit #221399、修正済みだが修正版は未確認）などのバグがあった。実機で確かめるまで信用できない。

(B) にしか無い利点は「同じ URL で詳細ページを育てられる」ことで、これは P2 以降の話。残りの利点（title の正本が 1 つ、作品とサイトの結合が小さい）は、下の工夫で (A) でも取れる。

### 作品に焼き込むのは 1 行だけ。中身はサイト側の 1 ファイル

`pnpm new` が生成する `index.html` の雛形に、次の 1 行を入れる。

```html
<script src="/_shell.js" defer></script>
```

- 実体は `public/_shell.js`。**サイト側が持つ手書きの 1 ファイル**で、作品のビルド成果物ではない（`public/lab/` の外に置く）。
- 作品のバンドルには入れない（`type="module"` を付けないので Vite は束ねずにそのまま残す）。
- 導線の見た目・位置・文言・挙動はすべて `_shell.js` の中身で決まる。**変えるときはこのファイル 1 つを直せば全作品に反映される。再ビルドは要らない。**

### 作品側に固まる約束（ここだけは後から変えにくい）

| 約束 | 内容 |
|---|---|
| 埋め込み | `<script src="/_shell.js" defer></script>`（パスは変えない） |
| 作品ごとの無効化 | `<html data-shell="none">` で何も出さない |
| 作品ごとの位置 | `<html data-shell-position="top-left \| top-right \| bottom-left \| bottom-right">`。既定は `top-left` |
| 録画 | URL に `?clean` を付けると何も出さない（録画するときはこれで開く）。**作品側の debug UI（Tweakpane）も `?clean` では出さない**のを慣習にし、雛形に書く |
| 表示の切り替え | `h` キーで表示 / 非表示。作品のキー操作と衝突させないため、(1) **入力中は無視する**（`document.activeElement` が `input` / `textarea` / `contenteditable`。Tweakpane の数値欄もこれ）、(2) **作品が `preventDefault()` したキーは無視する**。(2) はリスナーの登録順に依存させないよう、`setTimeout(0)` を挟んでイベント処理が終わってから `defaultPrevented` を見る |
| **iframe の中では何も出さない** | `window.top !== window` なら何もしない。(B) へ乗り換えた時にテンプレートのボタンと二重に出るのを防ぐ |

### `_shell.js` が守ること（作品を壊さない）

- **作品の DOM・CSS・グローバル変数に依存しない。** 要素は Shadow DOM の中に 1 つだけ作り、作品側にスタイルを漏らさない。
- **作品のイベントを奪わない。** `pointer-events` は導線の要素自体だけで受ける。
- **失敗しても作品は動く。** `_shell.js` が 404 になっても、例外が出ても、作品には影響しない（`defer` の独立 script なので）。
- キャッシュは immutable にしない。`public/_headers` で `/_shell.js` に短い `max-age`（例: 300 秒）を付ける。

### 工夫 1: 成果物を相対パスでビルドする（`base: './'`）

作品の `vite.config.ts` は `base: './'` にする（`/lab/<slug>/` を焼き込まない）。
これで成果物のディレクトリを別の場所へ動かしても動く。(B) へ乗り換える時は `public/lab/<slug>/` → `public/lab/<slug>/app/` の `git mv` で済み、**再ビルドが要らない**。

代わりの約束: **作品のコードで `/` から始まる絶対パスを書かない。** 相対パスか `import.meta.env.BASE_URL` を使う。雛形にそう書いておく。

### 工夫 2: title と OGP の正本は md の frontmatter 1 つ

`pnpm new` は引数の title で `<title>` と OGP を書く（md がまだ無いため）。
md ができた後は、`pnpm lab:add` と `pnpm lab:build` の最後に**成果物の `public/lab/<slug>/index.html` の `<head>` を md から書き直す**（JS は触らない）。
md の title を直したら `pnpm lab:build <slug>` で反映する。食い違いは `harness check` の `lab head in sync` で検出する。

### 見た目は後で決める

ヘッダーにするかボタンにするかは `_shell.js` の中身の話なので、**この決定では縛らない**。

- P0 の間は、左上に `← takumifukasawa` のテキストリンクを 1 つ置くだけにする。
- P1 でサイトのフォント・配色を決めるときに、sketch が数件ある状態で実物を見て決める。
- 既定の方向性は**隅の小さなボタン**（全画面 canvas の作品を押し出さず、縦長の作品の空間も食わない）。背景に追従させる（`mix-blend-mode: difference` など）。
- 既定の位置を左上にするのは、debug UI に使う Tweakpane の既定位置（右上）と重ねないため。

### P0 で確かめること

- `base: './'` でビルドした作品が `/lab/<slug>/` で動くか。Web Worker・動的 import・`new URL('./x', import.meta.url)` で読むアセットを含めて確かめる。
- Vite が、`type` の無い `<script src="/_shell.js">` を書き換えずに残すか（警告は出るが残る想定）。**`base: './'` で `./_shell.js` に書き換えられると 404 になる**ので必ず確かめる。
- 末尾スラッシュ無しの `/lab/<slug>` で開いた時に `/lab/<slug>/` へリダイレクトされるか（`curl -I` で確かめる）。相対パスの成果物はスラッシュ無しで開かれるとアセットが全部 404 になる。Workers Static Assets はフォルダを `/folder/` へリダイレクトするが、Pages の既定は文書で確認できなかった。されなければ `public/_redirects` に `/lab/:slug /lab/:slug/ 301` を書く。
- 作品単体の `pnpm dev`（Vite）では `/_shell.js` は 404 になり導線は出ない。これは無害なので許容する。サイトの dev サーバー（Astro は `public/` をそのまま配信する）経由なら導線込みで見える。

## (B) へ乗り換える場合の手順（やり直す条件を満たした時のため）

1. `public/lab/<slug>/` → `public/lab/<slug>/app/` に `git mv`（工夫 1 により再ビルド不要）。あわせて各作品の `vite.config.ts` の `outDir` を `.../app` に一括置換する（しないと次の再ビルドが旧パスに出る）
2. Astro に `/lab/[slug]/` の動的ルートを足す。全画面の `<iframe>` + 導線 + OGP（md から）
   - iframe に `allow="camera; microphone; accelerometer; gyroscope; fullscreen"` を付ける
   - **`location.search` と `location.hash` を iframe の `src` へ引き継ぐ**（`?seed=42` のような共有リンクを壊さない）
   - 読み込み後に `iframe.contentWindow.focus()`（キー入力を作品へ届ける）
3. `/app/` には `noindex` と canonical（`/lab/<slug>/`）を付ける
4. iframe で動かない作品（カメラ・センサー系）だけ、frontmatter の任意フィールドで包まずに `/app/` を直接開く
5. 作品の中の `_shell.js` は iframe の中では何も出さないので、触らなくてよい

共有済みの URL・X にキャッシュされた OGP は変わらない（同じ URL、同じ md から生成）。

**P2 で sketch の詳細ページを `/lab/<slug>/` に置きたくなったら、それはこの乗り換えを意味する**（(A) のままでは同じ URL に作品と詳細ページを両方置けない）。

## 落選案と落選理由

**B. Astro のテンプレートが作品を iframe で包む** — 作品とサイトの結合がゼロになり、title の正本が md の 1 つになり、詳細ページを同じ URL で育てられる。
落とした理由は iOS Safari でのカメラ・センサーの不確実さ（上記）。iframe へのフォーカス処理、URL が 2 つになること、P0 に Astro のルートが入ることも小さなコスト。
**排除したわけではない**。工夫 1 で乗り換えを安くしてあり、手順も上に書いた。

**C. 雛形に `<a>` と CSS を直接焼き込む** — 500 件がそれぞれ作った時点の見た目で固まる。サイトを改修するたびに全件の書き換えになる。採らない。

**D. サイトのビルド時に `public/lab/*/index.html` へリンクを差し込む** — 作品単体の確認時に見えない。「サイトのビルドは作品に触らない」（決定 0001）にも穴が開く。採らない。

**E. Cloudflare の Worker / Pages Functions で配信時に差し込む（HTMLRewriter）** — Free の 10 万リクエスト/日に当たり、バズると落ちる（決定 0001 の落選理由と同じ）。採らない。

**F. `lab/core/` の共通 util にして各作品で import する** — 作品のバンドルに入るので固まる（C と同じ問題）。採らない。

## 影響・やり直す条件

- `pnpm new` の雛形に 1 行入り、`vite.config.ts` は `base: './'` になる（`../spec/publish-pipeline.md`）。
- `public/_shell.js` と `public/_headers` は P0 で作る（中身は最小）。
- `_shell.js` の変更は**全作品に即座に効く**。壊すと全作品に出るので、変更したら最低 2 件の作品（横長・縦長）で確認する。
- **やり直す条件（(B) へ乗り換える）**: 作品ページに作品以外の情報（説明・関連 note・前後の sketch など）を常に出したくなり、`_shell.js` の重ね表示では足りなくなった時。乗り換えは新しい決定として足す。
