# content model — Content Collections の schema（唯一の正）

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`

sketch / Works / Notes の frontmatter はここが唯一の正。実装は `src/content.config.ts`（Astro 5 の置き場）で、この doc と 1:1 に対応させる。
**schema を変えたら、この doc を同じ commit で直す。**

## 目的

- runtime / video / image を 1 つの collection に共存させる。種類ごとに collection を分けない。見せ方のフィールドは持たず、「あるものを出す」だけにする。
- sketch の frontmatter を「書くのに 30 秒で済む量」に抑える。必須は 5 項目（`date` / `title` / `medium` / `poster` / `tech`）で、うち 4 つは script が埋める。
- 制作方針（毎作品 1 つは自分で直接触るコアを持つ）を schema 上に残し、後から振り返れるようにする。

## 共通: メディア参照

メディアは R2 の **key 文字列**で参照する。URL を frontmatter に書かない（決定 0001）。

```ts
// key は media/manifest.json のキー。例: "lab/2026/001-flow-field/poster.webp"
const mediaKey = z.string().regex(/^[a-z0-9][a-z0-9/_.-]*$/);
```

解決は `src/lib/media.ts` の `resolveMedia(key) => { url, width, height, bytes, durationSec? }` に閉じる。
`url` は `import.meta.env.PUBLIC_MEDIA_BASE_URL`（例: `https://media.takumifukasawa.com`）+ key。

## lab

```ts
const lab = z.object({
  // --- 必須（これだけで公開できる） ---
  date: z.coerce.date(),                 // 制作日。並び順の第一キー
  title: z.string(),
  medium: z.enum(['runtime', 'video', 'image']), // 媒体の種別。見せ方ではない（導出できないので持つ）
  poster: mediaKey,                      // 一覧サムネ兼 OGP 画像。常に必須
  tech: z.array(z.string()).min(1),      // 'threejs' | 'glsl' | 'webgpu' | 'wgsl' | 'houdini' | 'blender' | 'unreal' | ...

  // --- 任意 ---
  summary: z.string().max(140).optional(),   // 1〜3 行。X の投稿文とほぼ同じものを入れる
  themes: z.array(z.string()).default([]),   // 感覚テーマ: 'density' | 'silence' | 'unstable' | 'erosion' | 'order-collapse' | ...
  core: z.string().optional(),               // この作品で自分が直接書いたコア（1 行）
  video: mediaKey.optional(),                // mp4。これがあると「動画で見せる」になる
  videoWebm: mediaKey.optional(),
  embedUrl: z.string().url().optional(),     // これがあると「live を実行できる」になる
  repo: z.string().url().optional(),
  x: z.string().url().optional(),            // 投稿 URL。後から script で埋める
  note: z.string().optional(),               // 深掘りした Notes の slug
  featured: z.boolean().default(false),      // トップに出す / Works 昇格候補
  draft: z.boolean().default(false),
});
```

### 表示は「あるものを出す」だけ。見せ方のフィールドは持たない

v0 の詳細ページはこれで足りる。分岐と呼ぶほどのものがないので、導出関数も enum も要らない。

```
poster を出す（必須）
video があれば <video autoplay muted loop playsinline> に差し替える（コントロールは出さない）
embedUrl があれば「別タブで開く」リンクを出す
repo / x / note があればリンクを出す
```

**v0 ではサイト内に iframe を埋めない。** `embedUrl` は別タブで開くリンクにする（決定 0001）。
これでクリックロード機構も、GPU を食う作品が一覧に影響する問題も、モバイルの出し分けも v0 から消える。
将来サイト内で完結させるときは、URL が変わらないのでリンクを iframe に差し替えるだけで移行できる。

### 「重さ」のカテゴリは持たない — `note` の有無で導出する

重い技術検証と軽いスケッチを分けるフィールド（`depth` のようなもの）は持たない。

> **`note` が紐付いているかどうかが「重め」の定義そのもの。**

「解説を書くほどのものだったか」は自己申告の `depth: heavy` より客観的で、後から嘘にならない。
2 年後に「technical study を何件やったか」を数えるのも、`note` を持つ sketch を数えるだけで済む。

力を入れたものが埋もれる心配は**構造ではなく表示で解く**。`featured: true` でトップに上げ、
代表作は `works` に出す。箱もカテゴリも増やさない（決定 0003）。

### `medium` は見せ方ではなく媒体の種別

| 値 | 範囲 |
|---|---|
| `runtime` | ブラウザで実行されるもの（Three.js / WebGPU / p5） |
| `video` | 映像が本体のもの（Houdini / UE / Blender / 録画） |
| `image` | 静止画（レンダリング / フォトグラメトリ / 生成画像） |

**導出できないので frontmatter に持つ。** 例: WebGL で作ったが live は公開せず録画だけ出した sketch は、
`embedUrl` が無いので項目の有無からは `video` に見えるが、実体は `runtime`。これは「作ったものの性質」で、
「公開した形」からは分からない。

さらに**後から遡って埋められない**。500 件溜まってから種別を入れたくなったら 500 ファイルを開くことになる。
1 日 1 件書くときに 1 語書くのは 2 秒。`lab:add` script が推測して埋める（`--video` だけなら `video`、
`lab` repo に `index.html` があれば `runtime`）ので、手で直すのは例外のときだけ。

3 つで始めて、必要になったら足す（enum を広げるのは後方互換）。表示には使わず、分類と集計にだけ使う。

### 設計の意図（変えるときに読む）

- **`tech` と `themes` を分ける。** `tech` は検索・集計の軸（2 年後に「WebGPU を何件やったか」を数える）。`themes` は視覚・感覚の軸で、技術とは直交する。混ぜると両方使えなくなる。
- **`tech` は enum にしない。** enum にすると新しい技術を触るたびに schema 編集が必要になり、sketch の摩擦になる。代わりに表記ゆれを検査で潰す（`three.js` / `ThreeJS` → `threejs`）。許可語彙は `src/data/tech.ts` の 1 ファイルに置き、`harness check` が frontmatter と突き合わせる。**未知の語は検査が落ちる**ので、語彙を足す commit が意識的になる。
- **`core` を持たせる理由。** 「毎作品、最低 1 つは自分で直接触る技術的コア」という制作ルールを frontmatter に残す。v0 では optional だが、`harness check` で**未記入率を警告として出す**（落とさない）。2 年後に「どこを自分で訓練したか」が集計可能になる。
- **`no`（連番）は frontmatter に持たない。** slug（`001-flow-field`）の先頭から導出する。二重管理にしない。並び順は `date` desc → slug desc。
- **frontmatter に何を持つかは 2 段で判断する。** (1) 導出できるもの → **持たない**（後からいつでも計算できる。`no` は slug の先頭から、表示は項目の有無から）。(2) 導出できず、後から遡って埋めるのが高いもの → **最初から持つ**（`medium` がこれ。500 件溜まってからでは埋められない）。(3) 導出できず、今も後も要らないもの → 持たない。
  二重に持ったものは必ずいつかズレるので (1) は徹底する。一方 (2) を「先回りしない」と言って省くと、取り返しがつかなくなる。
- **本文（Markdown 本体）は原則空。** sketch に本文を書き始めると 1 件あたりのコストが上がり、英語対応時の翻訳量も跳ねる。深掘りは Notes に書いて `note` で繋ぐ。
- **「技術の性格」を軸に混ぜない。** 当初 `kind` に `technical`（実装解説が主役）を入れていたが、これは媒体でも見せ方でもなく中身の性格だった。これは `note` が紐付いているかで判定できる（= technical study）。軸は 3 つに分ける: `medium`（媒体）/ `tech`（技術）/ `themes`（感覚）。

## works

sketch の superset。`src/content/works/<slug>.mdx`。本文（concept / process / technology）を MDX で書く。

**`works` には `kind` を残す。** `installation`（URL も動画も無い実物）や `library`（PaleGL のようなコード資産）は項目の有無から導出できず、
かつ 4〜6 件しかないのでフィールド 1 つのコストが無視できる。`lab` と判断が違うのは件数と導出可能性の差であって、不統一ではない。

```ts
const works = z.object({
  title: z.string(),
  year: z.number().int(),
  date: z.coerce.date(),                 // 公開日（並び順）
  summary: z.string(),                   // 必須。一覧とOGPで使う
  role: z.array(z.string()).default([]),  // 'concept' | 'programming' | 'graphics' | 'sound' | ...
  kind: z.enum(['interactive', 'video', 'installation', 'library']),
  poster: mediaKey,
  gallery: z.array(mediaKey).default([]),
  video: mediaKey.optional(),
  embedUrl: z.string().url().optional(),
  repo: z.string().url().optional(),
  tech: z.array(z.string()).min(1),
  credits: z.array(z.object({ role: z.string(), name: z.string(), url: z.string().url().optional() })).default([]),
  relatedLab: z.array(z.string()).default([]),  // lab の slug。「この作品はこの sketch から来た」を示す
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
});
```

`kind: 'library'` は PaleGL のような技術資産を Works として置く枠（低レイヤーの技術力を示す資産として残す、という方針のため）。

## notes

```ts
const notes = z.object({
  title: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
  relatedLab: z.array(z.string()).default([]),
  relatedWork: z.array(z.string()).default([]),
  poster: mediaKey.optional(),           // 無ければ既定の OGP 画像
  draft: z.boolean().default(false),
});
```

## ファイル形式と執筆環境

| collection | 拡張子 | 理由 |
|---|---|---|
| `lab` | `.md` | 本文は原則空（frontmatter 中心）。MDX のビルドコストを 500 件分払う意味がない |
| `notes` | `.mdx` | 本文中に実行デモ・図・シェーダーのライブ編集を埋める。素の `.md` ではコンポーネントが使えない |
| `works` | `.mdx` | concept / process / technology を作り込む。件数が少ないのでコストは無視できる |

Notes / Works の執筆のために入れるもの（いずれも設定数行）。**P1 では入れない** — 記事を書き始める P1.5 で入れる（`site-v0.md`）。

- **Shiki**（Astro 標準）— コードブロックのハイライト。GLSL / WGSL / HLSL も対応言語
- **remark-math + rehype-katex** — `$$` の数式。レイマーチ・ノイズ・座標変換を書くので必須
- **rehype-slug + rehype-autolink-headings** — 日本語見出しの ID と見出しリンク。目次は Astro の `headings` から生成

本文中の静止画は `src/assets/` に置き Astro の画像最適化に通す（決定 0001 の例外）。動画は R2。

## 受け入れ条件

- [ ] `astro check` が通る（`astro sync` の生成型を含む）
- [ ] `video` がある sketch は `<video autoplay muted loop playsinline>` で再生され、無いものは `poster` 画像が出る
- [ ] `embedUrl` がある sketch は別タブで開くリンクが出る（v0 では iframe を生成しない）
- [ ] frontmatter の全 mediaKey が `media/manifest.json` に存在することを検査する（`harness check` の `media keys resolve`、ネットワークに触らない）
- [ ] `tech` の全要素が `src/data/tech.ts` の語彙にあることを検査する（`harness check` の `tech vocabulary`）
- [ ] `draft: true` は本番ビルドに出ない / `pnpm dev` では見える

## 範囲外（v0 でやらない）

- 多言語フィールド（`title_en` など）。→ 追加は後方互換で可能。`site-v0.md` の「将来の英語対応」参照
- `series` / `collection`（複数 sketch をまとめる概念）。必要になってから足す
- 作品ごとのレイアウト指定を frontmatter に持たせること（決定 0001 落選案 B の移行性を壊す）

## 未確定事項

- `themes` の語彙を固定するか自由にするか。→ **v0 は自由。** 20 件ほど溜めてから、実際に使った語を見て `src/data/themes.ts` に寄せる
