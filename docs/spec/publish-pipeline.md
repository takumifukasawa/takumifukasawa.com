# publish pipeline — 1 件を公開するまでの手順（制作を邪魔しない更新フロー）

- 状態: 合意済（2026-10-08）
- 関連: `../decisions/0001-overall-architecture.md`, `content-model.md`

## 目的

sketch 1 件の公開を **2 コマンド + 1 push** に収める。ここが重いと 300〜500 件は積めない。
「サイトを作り込む」より、このフローを短くするほうが目的に直結する。

## 定常フロー（目標）

repo は 1 つ。push も 1 回（決定 0001）。

```bash
pnpm new 001-flow-field "Flow field with curl noise"
#   lab/001-flow-field/ に雛形（OGP 入り index.html / main.ts / shader.glsl）

pnpm dev:lab 001-flow-field           # 制作。Vite / npm / TS / GLSL を自由に。HMR あり。--https で実機（iPhone）からも開ける
pnpm dev [--https]                    # サイト全体（Astro dev）。public/lab/ のビルド済み作品と _shell.js も開ける
pnpm preview [--https]                # pnpm build → wrangler pages dev dist。_headers / 末尾スラッシュまで本番と同じ挙動

# 録画（横 1920×1080 or 縦 1080×1920 / 60fps / 8〜12 秒ループ / 音なし）

pnpm lab:add 001-flow-field --video ~/captures/clip.mp4
#   1. 作品をビルド → public/lab/001-flow-field/（★ これをコミットする）
#   2. ffmpeg で mp4 を再エンコード + poster.webp を生成
#   3. R2 に put（Cache-Control: immutable）、media/manifest.json に追記
#   4. src/content/lab/001-flow-field.md を生成（title は pnpm new の引数から引き継ぐ）
#      → 成果物の index.html の <head>（<title> / OGP）を md から書き直す（決定 0004）
#   5. commit + push（--no-push で止められる）

# X に投稿（動画を直接アップロード + takumifukasawa.com/lab/001-flow-field/ のリンク）
```

**人間が書くのは `pnpm new` のタイトル 1 つだけ。** frontmatter を手で触る必要はない。

`pnpm lab:add <slug> [--video <mp4>] [--poster <image>] [--title "<title>"] [--dry-run] [--no-push]`（`scripts/lab-add.ts`）:
- `--video` / `--poster` の少なくとも一方が要る。poster を省くと、再エンコード後の動画の**真ん中のフレーム**を使う（ループの頭は黒いことが多いため）。WebP 化は sharp（Homebrew の ffmpeg は WebP を書けない）
- title は md → `--title` → `lab/<slug>/index.html` の `og:title`（`pnpm new` の引数）の順に取る。`index.html` の無い sketch（Houdini 等）は初回だけ `--title` が要る
- **再実行では md の既存の値が勝つ**（手で直した title / tags / medium は上書きされない。欠けている項目だけ埋める）。R2 に既にある key は put せず、manifest の既存の行も書き換えない
- R2 の認証情報は `.env`（git に入らないのでマシンごとに作る。`../setup.md`）。`--dry-run` は `.env` 無しで動く
- commit するのはその sketch に関わるパスだけ（`lab/<slug>/`、`public/lab/<slug>/`、build-meta、manifest、md）
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

除外の正本はリポジトリ直下の `.gitignore`（除外の理由もそこにコメントで書く）。ここに例を写さない（二重管理になる）。

**拡張子リストは必ず漏れるので、サイズで止める検査を併せて入れる。**
`harness check` の `no large files`: git の index に 2 MB 超のファイルがあったら落とす（例外は許可リスト `scripts/large-files-allow.txt` に 1 行書く）。
閾値 2 MB は、Three.js を含む作品のバンドル（通常 400〜600 KB、addons を多用して 1.5 MB 級まで）が通り、テクスチャやモデルが引っかかる位置。
例外が必要になる作品は許可リストに 1 行書く。

作品で大きいテクスチャやモデルを使う場合は、**それも R2 に置いて作品から絶対 URL で読む**
（`media.takumifukasawa.com/lab/<NNN-slug>/model.glb`）。repo が軽く保たれ、immutable キャッシュにも乗る。

## Vite の設定は `pnpm new` が書く

作品ごとの `vite.config.ts` に次の 2 つを入れる。どちらも機械的に決まるので人間は触らない。

```ts
// lab/001-flow-field/vite.config.ts
export default {
  base: './',                                  // 相対パスでビルドする（配信先のパスを焼き込まない）
  build: {
    outDir: '../../public/lab/001-flow-field', // 中間の dist/ を作らず直接ここへ
    emptyOutDir: true,
  },
};
```

- **`base`** を設定しないとアセットのパスが `/assets/...` になって 404 する（作品はサブパス `/lab/<NNN-slug>/` で配信されるため。決定 0001）。
  `'/lab/<NNN-slug>/'` ではなく `'./'` にするのは、成果物を別の場所へ動かしても動くようにするため
  （作品を iframe で包む構成へ乗り換える時に `git mv` だけで済む。決定 0004）。
  代わりに**作品のコードで `/` から始まる絶対パスを書かない**（相対パスか `import.meta.env.BASE_URL`）。雛形のコメントにそう書く。
- **`outDir`** を `public/lab/<NNN-slug>/` に直接向けるので、中間ディレクトリもコピー手順も生まれない。
- **minify は terser**で、プロパティ名まで mangle する（`keep_quoted`。PaleGL と同じ方針）。文字列で参照されるプロパティはクォートする規律と、破損の確かめ方は `../coding.md`。
  雛形の `vite.config.ts` は作品ごとのコピーなので、守れない作品はその作品だけ `mangleProperties = false` にできる。

## 再ビルド

```bash
pnpm lab:build 001-flow-field     # 1 件
pnpm lab:rebuild --all            # 全件（共通の変更を入れた時など）
```

**`--all` は、ビルドに失敗した作品をスキップして古い成果物を残す。** 失敗リストを標準出力に出す。
これがないと「2 年前の作品が今の依存で壊れていて、一括再ビルドしたらサイトが壊れた」が起きる。
スキップすれば古い成果物が残るので**サイトは常に壊れない**。

500 件 × 数秒で 30 分〜1 時間かかるが、**手元で走る**ので Pages のビルドタイムアウトは関係ない（年に数回の作業）。

### 依存のバージョン

| | 方針 |
|---|---|
| 既定 | ルートに `package.json` 1 つ。再ビルド時は現在のバージョンが使われる |
| 固定したい作品だけ | その作品に `package.json` + lockfile を持たせる（`pnpm new --standalone`）。再ビルドでも同じバージョンが入る |

全作品に lockfile を持たせる案は、500 個で ~25 MB になるうえ**再ビルドが必要になる場面自体が稀**なので採らない。
既定はシンプルにして逃げ道だけ用意する。

## アップロードは差分だけ

- **Cloudflare Pages**: 変更のないファイルをスキップする（content hash による重複排除）**と思われるが、公式ドキュメントに記述が見つからなかった = 未確認**。
  毎回全件を上げる仕様だとデプロイ時間に効くので、**P0 でデプロイログと所要時間を実測する**（`../references/cloudflare-limits.md` の未確認事項）。
- **R2** も同じ。`lab:add` は既存 key を put せずスキップする（immutable 設計。決定 0001）。
  録画を撮り直して新 key にした時だけ転送が発生する。

## ソースと成果物の乖離を検知する

この設計で新しく生まれる唯一の摩擦が、**ソースを直したのに再ビルドし忘れること**。
放置すると公開されているものと手元が静かに食い違う。

`pnpm lab:build <slug>` が `lab/.build-meta/<NNN-slug>.json` に次を書く（**`public/` の中には置かない** — `public/` 配下はそのまま配信されるので内部メタデータが公開されてしまうし、`emptyOutDir: true` が書き込み順次第で消す）。

```json
{ "sourceHash": "<lab/<NNN-slug>/ の全ファイルの内容ハッシュ>", "builtAt": "2026-10-20T12:34:56Z" }
```

`harness check` の `lab build in sync` が現在のソースからハッシュを再計算して比べ、違えば落とす
（ネットワークに触らず、オフラインで決定的に判定できる）。

## 各ステップの約束

| ステップ | 約束 |
|---|---|
| 雛形生成 | `pnpm new <slug> "<title>"`。雛形は「canvas と requestAnimationFrame が動く最小」（ループは html-game-template と同じ構造: fixedUpdate 60Hz 固定 + update / render 60fps 上限。`time/` の 2 ファイルは作品ごとにコピー）+ **OGP 入りの `index.html`**（下記）。debug UI（Tweakpane）を足すときは `?clean` で出さない、を雛形のコメントに書く（録画用。決定 0004）。`index.html` にはサイトへの導線 `<script src="/_shell.js" defer></script>` を 1 行入れる（決定 0004）。ライブラリは作品ごとに import する（共通 bootstrap を最初に作らない） |
| R2 の key | `lab/<NNN-slug>/{poster.webp,clip.mp4}`。一度 put した key は上書きしない |
| ビルド成果物 | Vite の `outDir` が直接 `public/lab/<NNN-slug>/` に出す（中間の `dist/` を作らない）。これをコミットする。**Pages のビルドは Astro だけ**を走らせ、`public/` はコピーするだけなので、作品のコードがサイトのビルドを壊さない（決定 0001） |
| manifest | `media/manifest.json` は生成物だがコミットする。これが無いとビルドが落ちる（意図的: メディアの実在をオフラインで検査するため）。**P0 の最初に空の `{}` をコミットしておく**（1 件目を追加する前は存在しないので、無いと初回ビルドが落ちる） |
| frontmatter | **人間が書くのは `title` だけ。** 必須 5 項目のうち 4 つは script が埋める: `date`（今日）/ `medium`（`--video` だけなら `video`、`index.html` があれば `runtime`）/ `poster`（動画の 1 フレーム）/ `tags`（作品のソースから推定: 依存、`.glsl` / `.wgsl` の有無、import 文）。`video` / `repo` も埋める（実物へのリンクは `public/lab/<slug>/index.html` の有無から導出するのでフィールドを持たない）。`medium` は明示フィールドなので推測が違えば直す。`description` は任意で空のままでよい |
| 失敗したとき | script は冪等。同じ `slug` で再実行したら、既存 key は put をスキップし manifest と md を更新する |

## 作品のページで OGP を出す

sketch を人に見せるリンクは `takumifukasawa.com/lab/<NNN-slug>/` になるので、**OGP は作品の `index.html` に置く**
（サイトのページ側は `/` と `/about/` だけで足りる。`site-v0.md`）。

問題は `og:image`。録画は制作の後なので `pnpm new` の時点で poster はまだ存在しない。
しかし **R2 の key を `lab/<NNN-slug>/poster.webp` に固定してある**ので（決定 0001）、
slug だけから **URL が最初から予測できる**（key に年を入れない理由。`../learnings.md`）。だから `pnpm new` が全部書ける。

```html
<!-- pnpm new 001-flow-field "Flow field with curl noise" が生成する -->
<title>Flow field with curl noise — takumifukasawa</title>
<meta property="og:title" content="Flow field with curl noise">
<meta property="og:type" content="website">
<meta property="og:url" content="https://takumifukasawa.com/lab/001-flow-field/">
<meta property="og:image" content="https://media.takumifukasawa.com/lab/001-flow-field/poster.webp">
<meta name="twitter:card" content="summary_large_image">
<script src="/_shell.js" defer></script>  <!-- トップへの導線。中身はサイト側の 1 ファイル（決定 0004） -->
```

**人間は後から触らない。** 録画して `lab:add` した時点で画像が実在するようになり、OGP が有効になる。

**title と OGP の正本は md の frontmatter。** `pnpm new` の時点では md が無いので引数の title で書くが、
md ができた後は `pnpm lab:add` と `pnpm lab:build` の最後に、成果物（`public/lab/<NNN-slug>/index.html`）の `<head>` を md から書き直す（JS は触らない）。
md の title を直したら `pnpm lab:build <slug>` で反映する。食い違いは `harness check` の `lab head in sync` で落とす（決定 0004）。
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
- [ ] `pnpm lab:rebuild --all` でビルドに失敗した作品はスキップされ、古い成果物が残る（失敗リストを出す）
- [ ] `--dry-run` で R2 に触らず生成内容を出せる
- [ ] 生成された md がそのまま `astro check` を通る（手で直さなくてもビルドが通る状態で出る）
- [ ] **人間が書く必須項目は `title` だけ**。`date` / `medium` / `poster` / `tags` は script が埋める（`medium` の推測が違えば直せる）
- [ ] `pnpm new <slug> "<title>"` が OGP 入りの `index.html` を生成し、`og:image` が録画前から正しい R2 URL を指す
- [ ] 生成された `index.html` に `<script src="/_shell.js" defer></script>` が入り、ビルド後の `public/lab/<slug>/index.html` にも書き換えられずに残る（決定 0004）
- [ ] 成果物の `<title>` / `og:title` が md の `title` と一致する（`lab:add` / `lab:build` が書き直す。決定 0004）
- [ ] `base: './'` でビルドした成果物を別のディレクトリへ動かしても動く（決定 0004）
- [ ] `--video` を省略し `--poster <path>` だけでも通る（静止画の sketch / Houdini のレンダリング用）
- [ ] 作品のビルドが壊れていても、サイトのビルドと deploy は成功する（Pages は `public/lab/` をコピーするだけ）

## 範囲外（当面やらない）

- X API での自動投稿（アカウント凍結リスクと API コストに見合わない。テキスト雛形の出力までで止める）
- AI による `description` / `tags` の自動生成 → P3。入れるときは `pnpm lab:add --ai` で**生成して frontmatter に入れるが、人間が必ず上書きできる**形にする（生成文をそのまま公開しない）
- 録画の自動化（ブラウザ内 MediaRecorder での自動キャプチャ）→ 必要になったら `lab/core/` の共通 util として入れる

## 未確定事項

（なし。決まり次第ここに書き、本文へ移して消す）
