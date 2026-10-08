# coding — コードの書き方の規約

人もエージェントも、コードを書く前にここを読む。置き場の規律（どこに何を置くか）は各ディレクトリの `AGENTS.md`、
設計の決定は `decisions/` にある。ここは「どう書くか」だけ。

## lab（ブラウザに配る作品のコード）

`lab/<NNN-slug>/` のコード。成果物は `public/lab/<NNN-slug>/` に固定されて配信される（決定 0001）。
**バンドルを小さく保つ**ことを優先する。

### class を使わない

状態はプレーンなオブジェクト、操作は個別の関数にする（`createX` / `startX` / `execX` の形）。

```ts
// ○
export type TimeSkipper = { targetFPS: number; callback: Callback; lastTime: number };
export const createTimeSkipper = (targetFPS: number, callback: Callback): TimeSkipper => ({ targetFPS, callback, lastTime: -Infinity });
export const execTimeSkipper = (skipper: TimeSkipper, time: number) => { /* ... */ };

// ×
export class TimeSkipper { exec(time: number) { /* ... */ } }
```

- 理由: class のメソッドや、オブジェクトに詰めたクロージャは、使わないものまでバンドルに残る。個別の関数なら tree-shaking で落ちる。
- 見本は雛形の `scripts/templates/sketch/time/timeAccumulator.ts`。

### 文字列で参照されるプロパティはクォートする

ビルドは terser で**プロパティ名まで mangle** する（雛形の `vite.config.ts`。PaleGL と同じ方針）。
名前を文字列で引くものは、オブジェクトリテラルでクォートしないと壊れる。

```ts
// ○ Tweakpane は 'speed' を文字列で引く
const params = { 'speed': 1 };
pane.addBinding(params, 'speed');

// × params.speed は params.a に縮むが、文字列の 'speed' は残る
const params = { speed: 1 };
```

- 該当するもの: Tweakpane のバインディング、three.js の uniform 名、JSON のキー、`postMessage` のペイロードなど。
- クォートした名前は `keep_quoted` によりバンドル全体で mangle されなくなる。
- DOM と組み込みの名前（`width` / `fillRect` / `requestAnimationFrame` など）は terser が自動で除外するので気にしなくてよい。

### mangle の破損はビルド済みの成果物で確かめる

dev（`pnpm dev:lab`）は minify しないので、mangle で壊れても見えない。公開前にビルドした成果物で動作を確かめる。
どうしても守れない作品は、その作品の `vite.config.ts` で `mangleProperties = false` にする（作品ごとのコピーなので他に影響しない）。

### その他

- `/` から始まる絶対パスを書かない。相対パス、`new URL('./x.png', import.meta.url)`、`import.meta.env.BASE_URL` を使う（決定 0004）。
- `?clean` が付いている時は debug UI（Tweakpane）を出さない（録画用。決定 0004）。
- shader は `import frag from './frag.glsl?raw'` で読む（プラグイン不要）。
- 公開版では `console.*` が消える（terser の `drop_console`）。
