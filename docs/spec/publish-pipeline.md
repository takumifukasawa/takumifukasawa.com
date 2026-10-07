# publish pipeline — 1 件を公開するまでの手順（制作を邪魔しない更新フロー）

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`, `content-model.md`

## 目的

sketch 1 件の公開を **2 コマンド + 2 push** に収める。ここが重いと 300〜500 件は積めない。
「サイトを作り込む」より、このフローを短くするほうが目的に直結する。

## 定常フロー（目標）

```
# lab repo で
pnpm new 001-flow-field          # ← 雛形生成（index.html / main.ts / shader.glsl）
...制作...
pnpm dev                          # localhost で全 sketch を一覧・個別に確認
git add -A && git commit && git push      # → lab.takumifukasawa.com/001-flow-field/ に自動 deploy

# 録画（ブラウザ or OBS）して clip.mp4 を手元に置く

# takumifukasawa.com repo で
pnpm lab:add 001-flow-field --video ~/captures/clip.mp4
#   1. ffmpeg で mp4 を再エンコード（H.264 / 1080p / 8〜12s / 音声なし）+ poster.webp を生成
#   2. R2 に put（Cache-Control: immutable）
#   3. media/manifest.json に key/寸法/サイズを追記
#   4. src/content/lab/001-flow-field.md を frontmatter 込みで生成（date は今日、embedUrl は lab の URL）
#   5. 開くべきファイルのパスを出力する
...title を 1 行書く（他は script が埋めてある）...
git add -A && git commit && git push      # → takumifukasawa.com に自動 deploy
```

`pnpm lab:add` は lab repo とサイト repo の両方を commit + push できる（`--no-push` で止められる）。**手数は 1 コマンド。**

X への投稿は手でやる（動画は X に直接アップロードする。サイトの OGP 画像ではなく動画そのものが伸びるため）。
`pnpm lab:add` は最後に**投稿用テキストの雛形**（title / 1 行 / 作品 URL / ハッシュタグ候補）を標準出力に出す。

## 各ステップの約束

| ステップ | 約束 |
|---|---|
| 雛形生成 | `pnpm new <slug> "<title>"`。lab 側の雛形は「canvas と requestAnimationFrame が動く最小」+ **OGP 入りの `index.html`**（下記）。ライブラリは作品ごとに import する（共通 bootstrap を最初に作らない） |
| R2 の key | `lab/<YYYY>/<NNN-slug>/{poster.webp,clip.mp4}`。一度 put した key は上書きしない |
| manifest | `media/manifest.json` は生成物だがコミットする。これが無いとビルドが落ちる（意図的: メディアの実在をオフラインで検査するため） |
| frontmatter | **人間が書くのは `title` だけ。** 必須 5 項目のうち 4 つは script が埋める: `date`（今日）/ `medium`（`--video` だけなら `video`、`index.html` があれば `runtime`）/ `poster`（動画の 1 フレーム）/ `tags`（lab repo のソースから推定: 依存、`.glsl` / `.wgsl` の有無、import 文）。`video` / `embedUrl` / `repo` も埋める。`medium` は明示フィールドなので推測が違えば直す。`description` は任意で空のままでよい |
| 失敗したとき | script は冪等。同じ `slug` で再実行したら、既存 key は put をスキップし manifest と md を更新する |

## lab 側のページで OGP を出す

sketch を人に見せるリンクは `lab.takumifukasawa.com/<NNN-slug>/` になるので、**OGP は lab 側の `index.html` に置く**
（サイト側は `/` と `/about/` だけで足りる。`site-v0.md`）。

問題は `og:image`。録画は制作の後なので `pnpm new` の時点で poster はまだ存在しない。
しかし **R2 の key を `lab/<YYYY>/<NNN-slug>/poster.webp` に固定してある**ので（決定 0001）、
slug と今年から **URL が最初から予測できる**。だから `pnpm new` が全部書ける。

```html
<!-- pnpm new 001-flow-field "Flow field with curl noise" が生成する -->
<title>Flow field with curl noise — takumifukasawa</title>
<meta property="og:title" content="Flow field with curl noise">
<meta property="og:type" content="website">
<meta property="og:url" content="https://lab.takumifukasawa.com/001-flow-field/">
<meta property="og:image" content="https://media.takumifukasawa.com/lab/2026/001-flow-field/poster.webp">
<meta name="twitter:card" content="summary_large_image">
```

**人間は後から触らない。** 録画して `lab:add` した時点で画像が実在するようになり、OGP が有効になる。
`index.html` が無い sketch（Houdini のレンダリングなど）は OGP ページも存在しない（リンク先が画像・動画そのものなので不要）。

## 録画の既定フォーマット

毎回決め直さないための既定値。実測で変える。

| 項目 | 既定 | 理由 |
|---|---|---|
| 長さ | **8〜12 秒のループ** | X のタイムラインで 2 周見える。6 秒未満は短すぎ、15 秒超は飽きる |
| 解像度 | **横 1920×1080 / 縦 1080×1920 の 2 パターン** | **作品の向きに合わせる**。スマホ向けに作った作品は縦で撮る。横で撮ったものを後から正方形に切ることはできるが、逆はできない |
| fps | **60** | ジェネラティブは滑らかさ自体が価値。30 に落とさない |
| 音 | **なし** | X は自動再生でミュート。音が主役の作品は別途考える |
| コーデック | **H.264 / yuv420p**（mp4 のみ。webm は作らない） | H.264 は全ブラウザ・全モバイルで再生でき、webm を併せ持つとエンコード時間・容量が 2 倍になる |

向きは frontmatter に持たない。`lab:add` が ffprobe で実寸を読み、`media/manifest.json` の width / height に書く（導出できるものは持たない。`content-model.md`）。

撮り方は当面 OBS かブラウザの録画機能で手動。`lab` 側の自動キャプチャは必要になってから（下の範囲外）。
1080p60 / 10 秒で mp4 は 4〜6 MB になるため、500 件での R2 ストレージは約 2.6 GB（mp4 のみ）（無料枠 10 GB の内側。`../references/cloudflare-limits.md`）。

## core/ への共通化ルール

lab repo の `core/` は**最初は空**にする。「作品 → 共通化 → 小さな framework」の順を守るため、
次を `core/AGENTS.md`（パス限定の規律。`../rules/README.md` に登録する）に書いて機械と人間の両方に効かせる。

> `core/` に何かを追加してよいのは、**同じコードを 3 つ以上の sketch で書いた後**だけ。
> 2 件以下なら sketch 側にコピーで置く。将来使うかもしれない抽象を `core/` に置かない。
> `core/` から `src/<NNN-slug>/` への import は禁止（依存の向きは sketch → core の一方向）。

これは AI にコードを書かせるときに最も効く規律（指示が無いと共通化を先回りしてやりがちなため）。

## 受け入れ条件

- [ ] `pnpm lab:add <slug> --video <path>` の 1 回で、R2 への配置・manifest 更新・md 生成が完了する
- [ ] 同じ引数で 2 回実行しても壊れない（既存 key を上書きしない / md を重複生成しない）
- [ ] `--dry-run` で R2 に触らず生成内容を出せる
- [ ] 生成された md がそのまま `astro check` を通る（手で直さなくてもビルドが通る状態で出る）
- [ ] **人間が書く必須項目は `title` だけ**。`date` / `medium` / `poster` / `tags` は script が埋める（`medium` の推測が違えば直せる）
- [ ] `pnpm new <slug> "<title>"` が OGP 入りの `index.html` を生成し、`og:image` が録画前から正しい R2 URL を指す
- [ ] `--video` を省略し `--poster <path>` だけでも通る（静止画の sketch / Houdini のレンダリング用）
- [ ] lab repo のビルドが壊れていても、サイトのビルドと deploy は成功する

## 範囲外（当面やらない）

- X API での自動投稿（アカウント凍結リスクと API コストに見合わない。テキスト雛形の出力までで止める）
- AI による `description` / `tags` の自動生成 → P3。入れるときは `pnpm lab:add --ai` で**生成して frontmatter に入れるが、人間が必ず上書きできる**形にする（生成文をそのまま公開しない）
- 録画の自動化（ブラウザ内 MediaRecorder での自動キャプチャ）→ 必要になったら lab 側の共通 util として入れる

## 未確定事項

（なし。決まり次第ここに書き、本文へ移して消す）
