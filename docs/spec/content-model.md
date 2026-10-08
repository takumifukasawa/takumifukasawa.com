# content model — Content Collections の schema（唯一の正）

- 状態: 草案
- 関連: `../decisions/0001-overall-architecture.md`

sketch / Works / Notes の frontmatter はここが唯一の正。実装は `src/content.config.ts`（Astro 5 の置き場）で、この doc と 1:1 に対応させる。
**schema を変えたら、この doc を同じ commit で直す。**

## 目的

- 実行できる作品・映像・静止画を 1 つの collection に共存させる。種類ごとに collection を分けず、見せ方のフィールドも持たない（「あるものを出す」だけ）。
- sketch の frontmatter を「書くのに 30 秒で済む量」に抑える。必須は 5 項目（`date` / `title` / `medium` / `poster` / `tags`）で、**人間が書くのは `title` だけ**。残りは script が埋める。
- 制作方針（毎作品 1 つは自分で直接触るコアを持つ）は schema に**持たない**。毎回書く義務にすると続かないので、ルールは `AGENTS.md`（AI との分担）に置く。

## Astro 5 の collection 定義

Astro 5 ではローカルファイルの collection も **`loader` が必須**。schema だけでは動かない。

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lab = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lab' }),
  schema: /* 下記 */,
});
```

## 共通: メディア参照

メディアは R2 の **key 文字列**で参照する。URL を frontmatter に書かない（決定 0001）。

```ts
// key は media/manifest.json のキー。例: "lab/001-flow-field/poster.webp"
const mediaKey = z.string().regex(/^[a-z0-9][a-z0-9/_.-]*$/);
```

解決は `src/lib/media.ts` の `resolveMedia(key) => { url, width, height, bytes, durationSec? }` に閉じる。
`url` は `import.meta.env.PUBLIC_MEDIA_BASE_URL`（例: `https://media.takumifukasawa.com`）+ key。

## lab

```ts
const lab = z.object({
  // --- 必須 5 項目。人間が書くのは title だけ（残りは script が初期値を入れる） ---
  date: z.coerce.date(),                 // 制作日。並び順の第一キー
  title: z.string(),
  medium: z.enum(['runtime', 'video', 'image']), // 媒体の種別。明示的に持つ
  poster: mediaKey,                      // グリッドのサムネ。常に必須
  tags: z.array(z.string()).min(1),      // 技術と意図を混ぜた 1 本のタグ列

  // --- 任意 5 項目 ---
  description: z.string().optional(),    // 空のまま運用してよい。長さ制限は付けない
  video: mediaKey.optional(),            // mp4
  externalUrl: z.string().url().optional(), // 独立 repo の作品だけ。通常は使わない（下記）
  repo: z.string().url().optional(),     // 導出しない。`lab/` 配下に無いもの（独立 repo のもの）や repo が無いものがある
  draft: z.boolean().default(false),     // 何らかの理由で落としたい時のため。notes / works と同じ扱い
});
```

`medium` は script が初期値を入れる（`--video` だけなら `video`、`lab` repo に `index.html` があれば `runtime`）。
**導出に頼らず明示フィールドとして持つ**ので、推測が違う場合（WebGL で作ったが live は公開せず録画だけ出した等）に直せる。

### 持たないフィールドと、その代わり

v0 で意図的に落としたもの。判断基準は「**後から足せるか**」で、すべて通る。

| 持たないもの | 代わり |
|---|---|
| `embedUrl` | **導出する。** 同じ repo なので `public/lab/<NNN-slug>/index.html` の有無で判定でき、URL は `/lab/<NNN-slug>/` で決まる。さらに `z.string().url()` は相対パスを拒否するので、絶対 URL を書くしかなくなり「ホスト名を frontmatter に書かない」（決定 0001）と矛盾していた。独立 repo の作品（決定 0003）だけ `externalUrl` で上書きする |
| `videoWebm` | **mp4 だけ。** H.264 は全ブラウザ・全モバイルで再生でき、webm を併せ持つとエンコード時間・アップロード・R2 容量が 2 倍になる。長尺の動画作品は YouTube 等に置く可能性があるので、その時に考える |
| `x`（投稿 URL） | 持たない。投稿は `lab:add` の**後**なので script が埋められず、md を再編集する摩擦になる |
| `note`（Notes への参照） | **`notes` 側の `relatedLab` に一本化する。** 両方向にリンクを持つと必ず片方が腐る。「この sketch に記事があるか」はサイト側で notes を走査すれば分かる |
| `featured` | 持たない。10 件の時点では全部見えるので無意味。50 件を超えてから足す |
| `no`（連番） | slug（`001-flow-field`）の先頭から導出する |
| `core`（自分が書いた部分） | 毎回 1 文書く義務にすると続かない。ルールは `AGENTS.md`（AI との分担）に書く |

### 表示は「あるものを出す」だけ

```
グリッド（/）  poster を正方形にトリミングして並べる（object-fit: cover）
               カードに title / date / tags
クリック先     public/lab/<slug>/index.html があれば /lab/<slug>/（実物が動く）
               externalUrl があればそこ（独立 repo の作品）
               無ければ video の mp4（ブラウザのプレイヤー）
               無ければ poster の画像
```

全部「**別タブで原寸を開く**」という同じ挙動なので、JS が要らない（決定 0001）。

### 「重さ」のカテゴリは持たない

重い技術検証と軽いスケッチを分けるフィールド（`depth` のようなもの）は持たない。
**解説記事（`notes`）を書いたかどうかが「重め」の実質的な指標**で、自己申告の `depth: heavy` より客観的。
2 年後に「technical study を何件やったか」を数えるのも、`notes` 側の `relatedLab` を数えれば済む。

力を入れたものが埋もれる心配は**構造ではなく表示で解く**（50 件を超えたら `featured` を足す、代表作は `works` に出す）。
箱もカテゴリも増やさない（決定 0003）。

### 設計の意図（変えるときに読む）
- **タグは 1 本（`tags`）にまとめる。** 技術（`threejs` / `glsl` / `webgpu`）と意図（`density` / `silence` / `erosion`）を分けない。2 本あると**書くたびに「これは技術か意図か」を考えることになり**、しかも境界が曖昧なものが必ず出る（`feedback` はどちらか）。1 本なら考えない。「`webgpu` が何件あるか」は 1 本でも数えられ、技術タグだけの一覧が欲しければ `src/data/tech.ts`（技術タグの正規名リスト）と交差を取れば導出できる。
- **検査は「既知語の表記ゆれ」だけ。未知語は自由に通す。** `three.js` / `ThreeJS` → `threejs` のような alias に引っかかったら落とす。語彙そのものをゲートにすると、新しい語を書くたびに語彙ファイルを編集することになり、**一番摩擦が嫌な軸に摩擦を置く**ことになる。
- **`core`（自分が直接書いた部分）は frontmatter に持たない。** 「毎 sketch 1 つは自分で触る」ルールを毎回 1 文書く義務の形にすると続かない。ルールは `AGENTS.md`（AI との分担）に書き、守れているかは自分の感覚で判断する。
- **`description` は任意で、空のまま運用してよい。** 用意だけしておき、書きたい作品にだけ書く。長さ制限は付けない（カードでは CSS で行数を切り、`og:description` は先頭を使う）。
- **`no`（連番）は frontmatter に持たない。** slug（`001-flow-field`）の先頭から導出する。二重管理にしない。並び順は `date` desc → slug desc。
- **frontmatter に何を持つかは 2 段で判断する。** (1) 導出できるもの → **持たない**（後からいつでも計算できる。`no` は slug の先頭から、表示は項目の有無から）。(2) 導出できず、後から遡って埋めるのが高いもの → **最初から持つ**（`medium` / `tags` / `description` がこれ。500 件溜まってからでは埋められない）。(3) 導出できず、今も後も要らないもの → 持たない。
  二重に持ったものは必ずいつかズレるので (1) は徹底する。一方 (2) を「先回りしない」と言って省くと、取り返しがつかなくなる。
- **本文（Markdown 本体）は原則空。** sketch に本文を書き始めると 1 件あたりのコストが上がり、英語対応時の翻訳量も跳ねる。深掘りは Notes に書き、notes 側の `relatedLab` で繋ぐ。
- **「技術の性格」を軸に混ぜない。** 当初 `kind` に `technical`（実装解説が主役）を入れていたが、これは媒体でも見せ方でもなく中身の性格だった。これは notes の `relatedLab` から参照されているかで判定できる（= technical study）。軸は `medium`（媒体）と `tags`（技術と意図）の 2 つ。

## works

sketch の superset。`src/content/works/<slug>.mdx`。本文（concept / process / technology）を MDX で書く。

**`works` には `kind` を残す。** `installation`（URL も動画も無い実物）や `library`（PaleGL のようなコード資産）は項目の有無から導出できず、
かつ 4〜6 件しかないのでフィールド 1 つのコストが無視できる。`lab` と判断が違うのは件数と導出可能性の差であって、不統一ではない。

```ts
const works = z.object({
  title: z.string(),
  year: z.number().int(),
  date: z.coerce.date(),                 // 公開日（並び順）
  description: z.string(),               // works は必須。一覧と OGP で使う
  role: z.array(z.string()).default([]),  // 'concept' | 'programming' | 'graphics' | 'sound' | ...
  kind: z.enum(['interactive', 'video', 'installation', 'library']),
  poster: mediaKey,
  gallery: z.array(mediaKey).default([]),
  video: mediaKey.optional(),
  externalUrl: z.string().url().optional(),
  repo: z.string().url().optional(),
  tags: z.array(z.string()).min(1),
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
  description: z.string(),
  tags: z.array(z.string()).default([]),
  relatedLab: z.array(z.string()).default([]),   // この記事が扱う sketch の slug。lab→notes の逆リンクは持たない（片方が腐るため）
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
- [ ] `public/lab/<slug>/index.html` がある sketch は `/lab/<slug>/` への別タブリンクが出る（v0 では iframe を生成しない）
- [ ] frontmatter に `embedUrl` を持たない（存在から導出する）
- [ ] frontmatter の全 mediaKey が `media/manifest.json` に存在することを検査する（`harness check` の `media keys resolve`、ネットワークに触らない）
- [ ] `tags` に既知語の表記ゆれ（`three.js` / `ThreeJS` など）が無いことを検査する（`harness check` の `tag normalization`）。**未知語は通す**
- [ ] `draft: true` は本番ビルドに出ない / `pnpm dev` では見える（`lab` / `works` / `notes` すべて）

## 範囲外（v0 でやらない）

- 多言語フィールド（`title_en` など）。→ 追加は後方互換で可能。`site-v0.md` の「将来の英語対応」参照
- `series` / `collection`（複数 sketch をまとめる概念）。必要になってから足す
- 作品ごとのレイアウト指定を frontmatter に持たせること（決定 0001 落選案 B の移行性を壊す）

## 未確定事項

（なし。決まり次第ここに書き、本文へ移して消す）
