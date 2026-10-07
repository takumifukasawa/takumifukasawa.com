# content model — Content Collections の schema（唯一の正）

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`

sketch / Works / Notes の frontmatter はここが唯一の正。実装は `src/content.config.ts`（Astro 5 の置き場）で、この doc と 1:1 に対応させる。
**schema を変えたら、この doc を同じ commit で直す。**

## 目的

- 作品の見せ方（interactive / video / still）を 1 つの collection に共存させる。種類ごとに collection を分けない。見せ方は専用フィールドではなく項目の有無から導出する。
- sketch の frontmatter を「書くのに 30 秒で済む量」に抑える。必須は 4 項目だけ（`date` / `title` / `poster` / `tech`）。
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

### 見せ方は frontmatter に持たず導出する

ページの主役スロットに何を描くかは、項目の有無から決まる。`src/lib/collections.ts` に 1 つ関数を置く。

```ts
// interactive: poster + 「実行」ボタン → クリックで iframe（決定 0001）
// video:       <video autoplay muted loop playsinline>（コントロールは出さない）
// still:       <img> 1 枚
function presentation(d) {
  if (d.embedUrl) return 'interactive';
  if (d.video)    return 'video';
  return 'still';
}
```

モバイルで動かない sketch は `embedUrl` を付けず `video` だけ入れる。それで「live は無い、動画で見てもらう」が成立する。
両方あるときは live を主役にする。「両方あるが動画を主にしたい」が実際に出てきたら、その時だけ optional な `prefer` を足す（先回りしない）。

### 設計の意図（変えるときに読む）

- **`tech` と `themes` を分ける。** `tech` は検索・集計の軸（2 年後に「WebGPU を何件やったか」を数える）。`themes` は視覚・感覚の軸で、技術とは直交する。混ぜると両方使えなくなる。
- **`tech` は enum にしない。** enum にすると新しい技術を触るたびに schema 編集が必要になり、sketch の摩擦になる。代わりに表記ゆれを検査で潰す（`three.js` / `ThreeJS` → `threejs`）。許可語彙は `src/data/tech.ts` の 1 ファイルに置き、`harness check` が frontmatter と突き合わせる。**未知の語は検査が落ちる**ので、語彙を足す commit が意識的になる。
- **`core` を持たせる理由。** 「毎作品、最低 1 つは自分で直接触る技術的コア」という制作ルールを frontmatter に残す。v0 では optional だが、`harness check` で**未記入率を警告として出す**（落とさない）。2 年後に「どこを自分で訓練したか」が集計可能になる。
- **`no`（連番）は frontmatter に持たない。** slug（`001-flow-field`）の先頭から導出する。二重管理にしない。並び順は `date` desc → slug desc。
- **frontmatter に持つのは「導出できない情報」だけ。導出できるものは関数にする。** この原則で消えたフィールドが 3 つある: `no`（slug の先頭から導出）、見せ方の `kind`（`embedUrl` / `video` の有無から導出）、モバイル可否のフラグ（`embedUrl` の有無で表現できる）。毎日 frontmatter を書くので 1 フィールド減るのが制作速度に直接効くうえ、**二重に持ったものは必ずいつかズレる**という保守の問題も消える。
- **本文（Markdown 本体）は原則空。** sketch に本文を書き始めると 1 件あたりのコストが上がり、英語対応時の翻訳量も跳ねる。深掘りは Notes に書いて `note` で繋ぐ。
- **「技術の性格」を見せ方の軸に混ぜない。** 当初 `kind` に `technical`（実装解説が主役）を入れていたが、これは見せ方ではなく中身の性格で、別の軸のものを 1 つの enum に混ぜていた。これは `note` が紐付いているかで判定できる（= technical study）。

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

Notes / Works の執筆のために P1 で入れるもの（いずれも設定数行）。

- **Shiki**（Astro 標準）— コードブロックのハイライト。GLSL / WGSL / HLSL も対応言語
- **remark-math + rehype-katex** — `$$` の数式。レイマーチ・ノイズ・座標変換を書くので必須
- **rehype-slug + rehype-autolink-headings** — 日本語見出しの ID と見出しリンク。目次は Astro の `headings` から生成

本文中の静止画は `src/assets/` に置き Astro の画像最適化に通す（決定 0001 の例外）。動画は R2。

## 受け入れ条件

- [ ] `astro check` が通る（`astro sync` の生成型を含む）
- [ ] `presentation()` が `embedUrl` / `video` の有無から interactive / video / still を正しく返す（単体テスト）
- [ ] frontmatter の全 mediaKey が `media/manifest.json` に存在することを検査する（`harness check` の `media keys resolve`、ネットワークに触らない）
- [ ] `tech` の全要素が `src/data/tech.ts` の語彙にあることを検査する（`harness check` の `tech vocabulary`）
- [ ] `draft: true` は本番ビルドに出ない / `pnpm dev` では見える

## 範囲外（v0 でやらない）

- 多言語フィールド（`title_en` など）。→ 追加は後方互換で可能。`site-v0.md` の「将来の英語対応」参照
- `series` / `collection`（複数 sketch をまとめる概念）。必要になってから足す
- 作品ごとのレイアウト指定を frontmatter に持たせること（決定 0001 落選案 B の移行性を壊す）

## 未確定事項

- `themes` の語彙を固定するか自由にするか。→ **v0 は自由。** 20 件ほど溜めてから、実際に使った語を見て `src/data/themes.ts` に寄せる
