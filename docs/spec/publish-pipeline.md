# publish pipeline — 1 件を公開するまでの手順（制作を邪魔しない更新フロー）

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`, `content-model.md`

## 目的

sketch 1 件の公開を **2 コマンド + 1 push** に収める。ここが重いと 300〜500 件は積めない。
「サイトを作り込む」より、このフローを短くするほうが目的に直結する。

## 定常フロー（目標）

repo は 1 つ。push も 1 回（決定 0001）。

```bash
pnpm new 001-flow-field "Flow field with curl noise"
#   lab/001-flow-field/ に雛形（OGP 入り index.html / main.ts / shader.glsl）

cd lab/001-flow-field && pnpm dev     # 制作。Vite / npm / TS / GLSL を自由に。HMR あり

# 録画（横 1920×1080 or 縦 1080×1920 / 60fps / 8〜12 秒ループ / 音なし）

pnpm lab:add 001-flow-field --video ~/captures/clip.mp4
#   1. 作品をビルド → public/lab/001-flow-field/（★ これをコミットする）
#   2. ffmpeg で mp4 を再エンコード + poster.webp を生成
#   3. R2 に put（Cache-Control: immutable）、media/manifest.json に追記
#   4. src/content/lab/001-flow-field.md を生成（title は pnpm new の引数から引き継ぐ）
#   5. commit + push（--no-push で止められる）

# X に投稿（動画を直接アップロード + takumifukasawa.com/lab/001-flow-field/ のリンク）
```

**人間が書くのは `pnpm new` のタイトル 1 つだけ。** frontmatter を手で触る必要はない。
`pnpm lab:add` は投稿用テキストの雛形（title / 1 行 / 作品 URL / ハッシュタグ候補）を標準出力に出す。

## 何をコミットし、何をコミットしないか

判断軸は 2 つ。**配信されるもの**と**再生成できないもの**をコミットする。**中間生成物**と**巨大バイナリ**は入れない。

| | コミット | 理由 |
|---|---|---|
| `lab/<NNN-slug>/`（ソース） | **する** | 再生成できない。`repo` フィールドの誘導先になり、**低レイヤーの技術力を示す資産として読まれる**。テキストなので数十 KB |
| `public/lab/<NNN-slug>/`（成果物） | **する** | **配信される**。再生成できるが、これが設計の核（決定 0001） |
| `src/content/lab/*.md`（カード） | する | 再生成できない |
| `media/manifest.json` | する | 生成物だが、key の実在をオフラインで検査するのに必要 |
| `node_modules/` `.astro/` `dist/` | しない | 再生成できる |
| mp4 / 録画の元ファイル | しない | R2 に行く |
| `.hip` / `.blend` / `.uasset` / `.exr` など | しない | 巨大バイナリ、差分が取れない（決定 0003） |

`public/lab/` の成果物だけが「再生成できるのにコミットする」例外で、これは意図的。

```gitignore
node_modules/
.astro/
dist/              # サイトのビルド出力
lab/*/.vite/
captures/          # 録画の元ファイル置き場

# DCC のプロジェクトファイル（決定 0003）
*.hip *.hiplc *.hipnc *.blend *.blend1
*.uproject *.uasset *.umap *.fbx *.abc *.exr *.psd
```

**拡張子リストは必ず漏れるので、サイズで止める検査を併せて入れる。**
`harness check` の `no large files`: git の index に 2 MB 超のファイルがあったら落とす（例外は許可リストに 1 行書く）。
閾値 2 MB は、Three.js の vendor チャンク（~700 KB）が通り、テクスチャやモデルが引っかかる位置。

作品で大きいテクスチャやモデルを使う場合は、**それも R2 に置いて作品から絶対 URL で読む**
（`media.takumifukasawa.com/lab/<YYYY>/<NNN-slug>/model.glb`）。repo が軽く保たれ、immutable キャッシュにも乗る。

## Vite の設定は `pnpm new` が書く

作品ごとの `vite.config.ts` に次の 2 つを入れる。どちらも slug から機械的に決まるので人間は触らない。

```ts
// lab/001-flow-field/vite.config.ts
export default {
  base: '/lab/001-flow-field/',               // 配信される URL のサブパス
  build: {
    outDir: '../../public/lab/001-flow-field', // 中間の dist/ を作らず直接ここへ
    emptyOutDir: true,
  },
};
```

- **`base`** を設定しないとアセットのパスが `/assets/...` になって 404 する。
  1 ドメインに寄せた（作品がサブパスで配信される）ことで必要になった設定（決定 0001）。
- **`outDir`** を `public/lab/<NNN-slug>/` に直接向けるので、中間ディレクトリもコピー手順も生まれない。

## ソースと成果物の乖離を検知する

この設計で新しく生まれる唯一の摩擦が、**ソースを直したのに再ビルドし忘れること**。
放置すると公開されているものと手元が静かに食い違う。

`pnpm lab:build <slug>` が `public/lab/<NNN-slug>/.build-meta.json` に次を書く。

```json
{ "sourceHash": "<lab/<NNN-slug>/ の全ファイルの内容ハッシュ>", "builtAt": "2026-10-20T12:34:56Z" }
```

`harness check` の `lab build in sync` が現在のソースからハッシュを再計算して比べ、違えば落とす
（ネットワークに触らず、オフラインで決定的に判定できる）。

## 各ステップの約束

| ステップ | 約束 |
|---|---|
| 雛形生成 | `pnpm new <slug> "<title>"`。雛形は「canvas と requestAnimationFrame が動く最小」+ **OGP 入りの `index.html`**（下記）。ライブラリは作品ごとに import する（共通 bootstrap を最初に作らない） |
| R2 の key | `lab/<YYYY>/<NNN-slug>/{poster.webp,clip.mp4}`。一度 put した key は上書きしない |
| ビルド成果物 | Vite の `outDir` が直接 `public/lab/<NNN-slug>/` に出す（中間の `dist/` を作らない）。これをコミットする。**Pages のビルドは Astro だけ**を走らせ、`public/` はコピーするだけなので、作品のコードがサイトのビルドを壊さない（決定 0001） |
| manifest | `media/manifest.json` は生成物だがコミットする。これが無いとビルドが落ちる（意図的: メディアの実在をオフラインで検査するため） |
| frontmatter | **人間が書くのは `title` だけ。** 必須 5 項目のうち 4 つは script が埋める: `date`（今日）/ `medium`（`--video` だけなら `video`、`index.html` があれば `runtime`）/ `poster`（動画の 1 フレーム）/ `tags`（作品のソースから推定: 依存、`.glsl` / `.wgsl` の有無、import 文）。`video` / `embedUrl` / `repo` も埋める。`medium` は明示フィールドなので推測が違えば直す。`description` は任意で空のままでよい |
| 失敗したとき | script は冪等。同じ `slug` で再実行したら、既存 key は put をスキップし manifest と md を更新する |

## 作品のページで OGP を出す

sketch を人に見せるリンクは `takumifukasawa.com/lab/<NNN-slug>/` になるので、**OGP は作品の `index.html` に置く**
（サイトのページ側は `/` と `/about/` だけで足りる。`site-v0.md`）。

問題は `og:image`。録画は制作の後なので `pnpm new` の時点で poster はまだ存在しない。
しかし **R2 の key を `lab/<YYYY>/<NNN-slug>/poster.webp` に固定してある**ので（決定 0001）、
slug と今年から **URL が最初から予測できる**。だから `pnpm new` が全部書ける。

```html
<!-- pnpm new 001-flow-field "Flow field with curl noise" が生成する -->
<title>Flow field with curl noise — takumifukasawa</title>
<meta property="og:title" content="Flow field with curl noise">
<meta property="og:type" content="website">
<meta property="og:url" content="https://takumifukasawa.com/lab/001-flow-field/">
<meta property="og:image" content="https://media.takumifukasawa.com/lab/2026/001-flow-field/poster.webp">
<meta name="twitter:card" content="summary_large_image">
```

**人間は後から触らない。** 録画して `lab:add` した時点で画像が実在するようになり、OGP が有効になる。
`index.html` が無い sketch（Houdini のレンダリングなど）は OGP ページも存在しない（リンク先が画像・動画そのものなので不要）。

### いつ貼るか

貼る URL は `takumifukasawa.com/lab/<NNN-slug>/` 1 つだけ（決定 0001）。

X では**動画を添付するとリンクカードが表示されない**（URL はテキストとして残る）。
リーチを考えると動画添付が強いので、その投稿ではカードは出ない。
OGP が効くのは **URL だけを投稿した時**と、**他の人が Slack / Discord / ブログでそのリンクを共有した時**。

**⚠ `lab:add` の前にリンクを共有しない。** X は一度カードをキャッシュすると OGP を直しても更新されず、
Card Validator が廃止されているので強制更新もできない。`pnpm new` で作品をデプロイした直後は `og:image` の URL がまだ 404 なので、
その状態でクロールされると壊れたカードが残る。**poster が R2 に上がってから貼る。**

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

`lab/` 配下の `core/` は**最初は空**にする。「作品 → 共通化 → 小さな framework」の順を守るため、
次を `lab/core/AGENTS.md`（パス限定の規律。`../rules/README.md` に登録済み）に書いて機械と人間の両方に効かせる。

> `core/` に何かを追加してよいのは、**同じコードを 3 つ以上の sketch で書いた後**だけ。
> 2 件以下なら sketch 側にコピーで置く。将来使うかもしれない抽象を `core/` に置かない。
> `core/` から `lab/<NNN-slug>/` への import は禁止（依存の向きは sketch → core の一方向）。

これは AI にコードを書かせるときに最も効く規律（指示が無いと共通化を先回りしてやりがちなため）。

## 受け入れ条件

- [ ] `pnpm lab:add <slug> --video <path>` の 1 回で、R2 への配置・manifest 更新・md 生成が完了する
- [ ] 同じ引数で 2 回実行しても壊れない（既存 key を上書きしない / md を重複生成しない）
- [ ] `--dry-run` で R2 に触らず生成内容を出せる
- [ ] 生成された md がそのまま `astro check` を通る（手で直さなくてもビルドが通る状態で出る）
- [ ] **人間が書く必須項目は `title` だけ**。`date` / `medium` / `poster` / `tags` は script が埋める（`medium` の推測が違えば直せる）
- [ ] `pnpm new <slug> "<title>"` が OGP 入りの `index.html` を生成し、`og:image` が録画前から正しい R2 URL を指す
- [ ] `--video` を省略し `--poster <path>` だけでも通る（静止画の sketch / Houdini のレンダリング用）
- [ ] 作品のビルドが壊れていても、サイトのビルドと deploy は成功する（Pages は `public/lab/` をコピーするだけ）

## 範囲外（当面やらない）

- X API での自動投稿（アカウント凍結リスクと API コストに見合わない。テキスト雛形の出力までで止める）
- AI による `description` / `tags` の自動生成 → P3。入れるときは `pnpm lab:add --ai` で**生成して frontmatter に入れるが、人間が必ず上書きできる**形にする（生成文をそのまま公開しない）
- 録画の自動化（ブラウザ内 MediaRecorder での自動キャプチャ）→ 必要になったら `lab/core/` の共通 util として入れる

## 未確定事項

（なし。決まり次第ここに書き、本文へ移して消す）
