# learnings — 踏んだ罠と対処

<!-- 書くのは「コードや git log から導出できないこと」だけ。
     形式は「症状 → 原因 → 対処（再発したらまず X を見る）」。日付は絶対日付。
     プロジェクト非依存のものには [harness候補] を付ける。harness-maintain が昇格を検討する。
     昇格先の優先順位: 検査スクリプト（check.sh）> スキル > AGENTS.core.md の文章 -->

## 2026-10-17 [harness候補] 配布物を gitignore にした後、それより古いブランチへ checkout すると配布物が消える

- 症状: `develop` → `main` → `develop` と切り替えたら、`.harness/bin/harness` や `.harness/scripts/*.sh` が消えて `harness check` が動かなくなった。
- 原因: `3ebf4a6`（harness 1.2.0）で配布物を git の管理から外した（.gitignore）。`main` はそれより古く、まだ管理していた。
  `main` への checkout で手元の ignored ファイルが `main` の版に上書きされ、`develop` に戻るときに「管理から外す」差分を通って git が削除した。
- 対処 / 再発したら: `bash <agent-harness の clone>/bin/harness install`（パスは `.harness/source.local`）。
  `main` が `develop` に追いついた後は起きない。配布物の管理方法を変えたら、デプロイ用ブランチも早めに追いつかせる。

## 2026-10-17 Windows で `git mv lab/wip` が Permission denied になる

- 症状: 公開前の改名 `git mv lab/wip lab/<slug>` が `Permission denied` で失敗する。
- 原因: `pnpm dev:lab wip` の dev サーバーが `lab/wip` を監視していて、Windows ではディレクトリを掴んだまま改名できない。
  前のセッションのサーバーが残っていることもある（`netstat -ano | grep :5173`）。pnpm のタスクを止めても子の node が残ることがある。
- 対処 / 再発したら: dev サーバーを全部止めてから改名する（`taskkill //PID <pid> //F`）。

## 2026-10-17 依存や vite.config.ts を変えると、動いている dev サーバーが真っ黒な画面を返し続ける

- 症状: 依存を足した直後や `vite.config.ts` を書き換えた直後に、dev の画面が真っ黒になる。例外もコンソールのエラーも出ない。
- 原因: Vite が依存を再最適化し、古いハッシュの `node_modules/.vite/deps/three.js` に 504（Outdated Optimize Dep）を返し続ける。
- 対処 / 再発したら: `curl -o /dev/null -w '%{http_code}'` で deps の URL を叩いて 504 なら、dev サーバーを起動し直す。

## 2026-10-17 [harness候補] 検査の出力を grep で絞ると、検査そのものが動いていないことに気付けない

- 症状: `npx tsc --noEmit -p . 2>&1 | grep lab/wip` を「型チェック」として何度も回し、何も出ないので「通った」と報告していた。
  その間に、関数名の付け替え漏れがクリック時の `ReferenceError` として残った。
- 原因: `typescript` が入っておらず、`npx tsc` は別物のパッケージの「This is not the tsc command you are looking for」を出していた。
  grep がそれを捨てたので、検査が動いていないことと、エラーが 0 件であることの区別がつかなかった。
- 対処 / 再発したら: 型検査は `pnpm typecheck`（決定 0010）を使い、**最後の集計行（`- 0 errors`）を見る**。
  「何も出なかった」を pass の根拠にしない。新しい検査を足したら、一度わざと失敗させて、落ちることを確かめる。

## 2026-10-17 pnpm の追加が途中で止まると、symlink だけ残って型が全部消える

- 症状: `pnpm add -D @tweakpane/core` の後、Tweakpane の `Pane` から `addFolder` などのメソッドが全部消えた（型エラー）。
  pnpm は `Done` と出していた。
- 原因: `node_modules/@tweakpane/core` の symlink はあるのに、リンク先の `.pnpm/@tweakpane+core@2.0.5` が無かった。
  直前に中断したインストールの影響と思われる（再現は取っていない）。
- 対処 / 再発したら: まず `ls node_modules/<pkg>/package.json` で中身があるかを見る。無ければ `pnpm install` で直る。
  依存の解決を疑って tsconfig の `paths` などで回避する前に、これを確かめる。

## 2026-10-17 [harness候補] iPhone で 33ms に張り付いたら、まず低電力モードを疑う

- 症状: voxel rain（`lab/wip`）を iPhone の Safari で開くと、debug ペインの `ms` が 33 に張り付き、60fps にならない。
  作品が重いように見える。
- 原因: 低電力モードの間、iOS の Safari は `requestAnimationFrame` を 30fps に落とす。作品の重さとは関係がない。
- 対処 / 再発したら: まず電池のアイコン（黄色なら低電力モード）を見る。本当に重いときは自動品質が働いて `tier` が 0 より大きくなり、
  `ms` は 33 ちょうどにはならない。実機の速さは、低電力モードを切ってから測る。

## 2026-10-15 `artifacts run` はシェーダーのコンパイル失敗を見逃す（ビルドが three のエラー出力を消している）

- 症状: `lab/wip/grid.ts` の GLSL で予約語 `half` を変数名にして、フラグメントシェーダーのコンパイルに失敗した。
  dev では `THREE.WebGLProgram: Shader Error ... 'half' : Illegal use of reserved word` が出ていたのに、
  `harness check` の `artifacts run` は `wip: ok` で通った。
- 原因: 作品の `vite.config.ts` の terser 設定 `drop_console: true` が、作品のコードだけでなく **three 内部の
  `console.error` まで消す**。three はシェーダーエラーを自前の `error()` で出しているが、ビルド後はその中身が空になる
  （成果物の中では `function N(...t){(t=D(t)).shift()}`）。そのため検査が拾うものがない。全作品に共通の穴。
- 対処 / 再発したら: シェーダーを変えたら、**dev（`pnpm dev:lab`）のコンソールで `Shader Error` を見る**。
  `artifacts run` の ok は、シェーダーがコンパイルできたことの根拠にならない。根本対応は `tech-debt.md` の #3。
- ついでに踏んだもの: シェーダーを JS のテンプレート文字列に直書きしているとき、GLSL のコメントにバッククォートを書くと
  文字列がそこで閉じてビルドが落ちる（こちらはビルドが落ちるので気付ける）。

## 2026-10-12 [harness候補] 自動操作で開いたタブは `requestAnimationFrame` が止まるので、アニメーションが「動いていない」ように見える

- 症状: ブラウザ自動操作でページを開き、数秒待って 2 枚スクリーンショットを撮ると**1 ピクセルも違わない**。
  アニメーションのロジックを疑って延々探すことになる。
- 原因: 自動操作で開いたタブはフォアグラウンドにならない。`document.hidden === true` の間、
  Chrome は `requestAnimationFrame` を止める。描画が 1 フレーム目で凍っているだけで、コードは正しい。
- 対処 / 再発したら: まず `document.visibilityState` を見る（`javascript_tool` で 1 行）。
  **動きの検証はブラウザに頼らず、時間の関数を Node 側で直接サンプリングする**のが速い
  （位相関数なら「周期を N 分割して、動いている要素が 0 の瞬間があるか」を数値で出せる）。
  スクリーンショットで確かめられるのは「静止画として正しいか」までだと割り切る（2026-10-12、greeble で踏んだ）。

## 2026-10-12 [harness候補] Bash ツール経由のヒアドキュメントはバックスラッシュを 1 枚剥がす

- 症状: スクリプトでソースを生成すると、書いたはずの「バックスラッシュ + n」が**実際の改行**になってファイルに入り、
  `Unterminated string` や `Unterminated regexp literal` でビルドが落ちる。生成元のコードを何度見ても正しい。
  **この項目自体、最初に書いたとき同じ理由で壊れた。**
- 原因: `<<'PY'` のようにクォートしたヒアドキュメントでも、Bash ツールに渡る途中でバックスラッシュが 1 枚畳まれる。
  Python / Node 側が受け取る時点で既にエスケープが 1 段落ちている。
- 対処 / 再発したら: **生成するコードにバックスラッシュを含めない**。
  正規表現は `new RegExp('...')` を避けて書き換える（例: 先頭のパス区切りを削るなら
  `while (s.startsWith('/') || s.startsWith(sep)) s = s.slice(1)`）。
  どうしても要るなら `chr(92)` / `String.fromCharCode(92)` で組み立てる。
  書いた直後に `sed -n '<行>p'` で**その 1 行だけ目視する**と、ビルドまで行かずに気付ける（2026-10-12）。

## 2026-10-12 three の組み込みマテリアルを使う sketch は property mangling を切る（dev では出ない）

- 症状: `pnpm dev:lab` では完璧に動くのに、**ビルド成果物だけが真っ黒**になる。コンソールに
  `TypeError: Cannot read properties of undefined (reading 'replace')` が 1 行だけ出て、スタックは
  mangle 済みで読めない。作品のコードを疑って延々探すことになる。
- 原因: 作品の `vite.config.ts` の `mangleProperties`（terser の `mangle.properties`）。
  three は `#include <common>` のチャンク名を**シェーダーの文字列から取り出して** `ShaderChunk[name]` で引く。
  mangle はオブジェクト側のキーだけを書き換えるので、文字列側と食い違って `undefined` になり、
  最初のフレームの前に `.replace` で落ちる。`keep_quoted: true` は**ソースで引用されている名前しか**守らないので効かない。
- 対処 / 再発したら: その sketch の `vite.config.ts` で `const mangleProperties = false;`。
  **2026-10-12 以降、雛形の既定が `false` になった**（決定 0008）ので、新しい sketch で踏むのは
  自分で `true` に戻したときだけ。
  **`reserved` で塞ごうとしないこと。** 一度試して 3 回壊れた: `ShaderChunk[include]`（予約できる）→
  `ShaderLib[shaderID]`（予約できる）→ `shaderIDs[material.type]`（**export されていない**）。
  4 つ目を事前に列挙する手段が無く、公開 API の範囲では閉じられない。
  **dev では絶対に再現しない。** `harness check` の `artifacts run` が成果物を実際に開いて捕まえる
  （2026-10-12、greeble で踏んだ）。

## 2026-10-11 [harness候補] JSR のパッケージに依存した npm install は `@jsr` スコープの設定が無いと 404 で落ちる

- 症状: `/plugin install` や `npm install` が
  `npm error 404 Not Found - GET https://registry.npmjs.org/@jsr%2f<scope>__<name>` で落ちる。
  パッケージ名が実在しないように見えるので、プラグインや依存の指定が壊れていると誤診する。
- 原因: JSR（jsr.io）のパッケージは npm から使うとき `@jsr/<scope>__<name>` という名前になり、
  **npmjs.org には存在しない**。JSR の npm 互換レジストリ `https://npm.jsr.io` にしか無い。
  `@jsr` スコープの向き先が未設定だと npm が npmjs.org を見て 404 になる。
- 対処 / 再発したら: `npm config set @jsr:registry https://npm.jsr.io`（`~/.npmrc` に 1 行。
  戻すのは `npm config delete @jsr:registry`）。**先に `npm view @jsr/<scope>__<name> version --registry https://npm.jsr.io`
  で実在と版を確かめる**と、設定を変える前に原因が確定する。
  404 のパッケージ名が `@jsr/` で始まっていたらこれ（2026-10-11、Cosense の MCP プラグインで踏んだ）。

## 2026-10-11 [harness候補] 映像を見る前に推定で分析の枠組みを作ると、枠組みごと捨てることになる

- 症状: 他人の作品（Unity 6 の起動画面）の手法を特定する作業で、映像を入手する前に
  「フィラメント系（curl noise / strange attractor）だろう」と推定して分析の型を組んだ。
  ユーザーの「立方体が建物みたいににょきにょき出る」の一言で**型を全部捨てた**。
- 原因: 推定を先に置くと、枠組みがその推定に専用化される。外れたときに枠組みだけ残らない。
- 対処 / 再発したら: 順序を固定する。**一次資料を入手 → 分解の枠組みを宣言 → 開いて当てはめる**。
  枠組みは「何を見るか」の軸（例: 足元の割り方 / 高さの決め方 / タイミングの配り方）と、
  「静止画で分かること / 動画が要ること / **原理的に不可能なこと**」の層に分ける。
  3 層目を先に宣言するのが効く（今回は「VFX Graph か Compute Shader かは映像から判別不能」と
  先に認めたので、判別できる所に集中できた）。見ずに語ると外れる。

## 2026-10-11 [harness候補] X の投稿を一次資料として取りに行くと HTTP 402 で弾かれる

- 症状: 作者本人のポストと添付動画を一次資料として取りたいのに、`x.com` / `twitter.com` へのリクエストが
  **402 Payment Required** で返る。ログイン前提の UI なのでスクレイピングもできない。
- 原因: X は認証なしの取得を塞いでいる（公式 API は有料）。
- 対処 / 再発したら: 認証不要の公開ミラー API を使う。
  `https://api.fxtwitter.com/<user>/status/<id>`（代替: `api.vxtwitter.com`）が JSON を返し、
  本文とメディアの直 URL が取れる。URL から mp4 を落として ffmpeg にかける。
  **第三者のミラーなので、消えたら同種の別ミラーを探す**（この手順自体が腐る前提で書いている）。

## 2026-10-11 [harness候補] ffmpeg の `-ss` を `-i` より前に置くと、真っ黒なフレームを掴む

- 症状: 動画の特定の瞬間を切り出したのに、出てきた画像が真っ黒（または狙いと違う絵）。
  指定した秒数は合っているのに中身が違うので、動画の方がおかしいと誤診する。
- 原因: `-ss` を `-i` の**前**に置くと入力シーク（近傍のキーフレームへ飛ぶ）になり、
  指定時刻そのものではなくキーフレームの絵が出る。暗転やフェードを挟む映像では真っ黒を引く。
- 対処 / 再発したら: **正確さが要るときは `-ss` を `-i` の後に置く**（出力シーク。デコードするので遅い代わりに正確）。
  速度が要る長尺の頭出しだけ前に置く。
  見どころの特定には輝度の平均を出すのが速い:
  `ffmpeg -i <in> -vf "fps=2,signalstats,metadata=print:file=-" -f null -` で明るいフレームを探してから切る。

## 2026-10-11 [harness候補] Windows で CRLF のまま保存すると、数行の変更が全書き換えの差分になる

- 症状: 3 箇所しか直していないファイルの `git diff` が、全行削除 + 全行追加になる。レビューで変更点が埋もれ、
  コミットすると履歴にも残り続ける。
- 原因: ファイルを書き換えたツールが **CRLF で保存**した。repo は LF で、`.gitattributes` は
  `.harness/` などハーネス管理のパスしか押さえていないので、他のファイルは素通りする。
- 対処 / 再発したら: **コミット前に `git diff --stat` を見る。** 直した量に対して行数が不釣り合いなら改行コードを疑い、
  `file <path>` で確かめて LF に戻してからコミットする。全体を `* text=auto eol=lf` で縛る手もあるが、
  既存ファイルの一括変換が要るので採っていない（2026-10-11 時点）。

## 2026-10-11 Astro / Vite で `import.meta.dirname` + `readFileSync` はビルド後の位置を指す

- 症状: ページから `readFileSync(join(import.meta.dirname, '..', '..', 'media', 'manifest.json'))` で読むと、
  `pnpm dev` では通るのに `astro build` が `ENOENT: ... dist\media\manifest.json` で落ちる。
- 原因: ビルドでモジュールが `dist/.prerender/` に出力されるので、`import.meta.dirname` はソースの場所ではなく
  **出力の場所**になる。相対パスの基準がビルド前後で変わる。
- 対処 / 再発したら: **JSON は `readFileSync` ではなく `import` する**（`import manifest from '../../media/manifest.json'`）。
  Vite がビルド時に解決して埋め込むので、パスの基準が動かず、ブラウザにも送られない。
  「dev では通るのに build で落ちる」パス問題を見たら、まず `import.meta.dirname` を使っていないか探す。

## 2026-10-11 自分のブラウザで計測を確認しようとすると、入っていても「届いていない」ように見える

- 症状: GA を入れて動作確認したが、`collect` のリクエストが飛ばず、`_ga` クッキーも付かない。
  実装が間違っているように見える。
- 原因: 開発機の Chrome に計測ブロッカー拡張が入っていた（`chrome-extension://.../google-analytics_analytics.js`
  というスタブが読まれているのが手がかり）。`gtag/js` の取得と `gtag('config')` までは成功するので、
  **タグの実装が正しいことと、ヒットが届くことは別々に確認する必要がある**。
- 対処 / 再発したら: **計測の疎通確認は開発機でやらない。** 実機かブロッカーの無いブラウザで開いて
  GA の「リアルタイム」を見る。手元のブラウザで見るのはタグが読まれているか（`gtag/js` が 200、`window.gtag` が関数）
  までに留める。詳細は `spec/site-v0.md` の「計測」。

## 2026-10-11 シェーダーを直したら、まずブラウザのコンソールを見る

- 症状: シェーダーを編集したらメッシュが丸ごと消えた。画面は普通に動いていて、JS のエラーも無い。
- 原因: GLSL のコンパイルエラー。three は `THREE.WebGLProgram: Shader Error ... Vertex shader is not
  compiled` を**コンソールに出すだけ**で、例外は投げない。該当マテリアルのメッシュが描かれなくなる。
  今回は変数の二重宣言（角度の `a` と方向ベクトルの `a`）と、存在しない識別子の参照。
- 対処 / 再発したら: **シェーダーを編集した直後にコンソールを見る。** エラーには行番号と該当行が
  出るので即座に分かる。見ないと「ロジックが間違っている」と誤診して何往復も無駄にする。
  sed / perl でシェーダーを部分置換したときは特に起きやすい（前後の変数名との衝突が見えない）。

## 2026-10-11 Vite の dev サーバーが古いモジュールを配り続け、変更が画面に出ない

- 症状: コードを直しても画面が変わらない。エラーも出ない。デバッグ用の表示を足しても出てこず、
  uniform を足して値を入れても効かない。**「実装が間違っている」ようにしか見えないので、
  存在しないバグを何十分も探すことになる。**
- 原因: dev サーバーのプロセスを何度か kill / 再起動する過程で watcher が壊れ、ファイルの変更を
  拾わなくなっていた。ブラウザをリロードしても、サーバー側が古い変換結果を返すので変わらない。
- 対処 / 再発したら: **「直したのに画面が変わらない」と思ったら、まず dev サーバーを再起動する。**
  デバッグを始める前にやる。見分け方は「新しく足した console.log も出ない」こと — 出ないなら
  コードの問題ではなくサーバーの問題。
  なお `pnpm lab:build` は毎回新しいプロセスなので影響を受けない。**疑わしいときはビルドして
  成果物を見るのが確実**（docs/coding.md の「mangle の破損はビルド済みの成果物で確かめる」と
  同じ理由で、成果物を見る習慣は二重に効く）。

## 2026-10-08 Windows では `corepack enable` が admin 無しで失敗する

- 症状: `corepack enable` が `EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpx.ps1'` で落ちる。
  pnpm が入らないので `pnpm install` 以降が全部進まない。
- 原因: corepack はシムを **Node 本体のインストール先**（`C:\Program Files\nodejs`）に書く。ここは admin 権限が要る。
- 対処 / 再発したら: admin を使わずに済ませる。`npm install -g pnpm@<package.json の packageManager の版>` で入れる
  （npm のグローバルは `%APPDATA%\npm` でユーザー書き込み可）。版を合わせておけば `packageManager` と食い違わない。
  OS 別の手順は `setup.md` の「OS 別のコマンド」。

## 2026-10-08 pre-commit の実行ビットが git index 上で落ちて、フックが黙って無視される（Windows）

- 症状: `harness init` 直後は `doctor` が OK だったのに、`git add -A` を挟んだ後の `doctor` が
  「`.githooks/pre-commit` が実行できない状態（git index 上の mode が 100644）」で FAIL した。
  **commit は成功するのに検査が走らない**ので、気づく手段が `doctor` しかない。
- 原因: Windows は実行ビットを持たないため、`git add` でファイルモードが 100644 として index に入りうる。
  git は実行できないフックを**黙って無視する**。
- 対処 / 再発したら: `chmod +x .githooks/pre-commit && git update-index --chmod=+x .githooks/pre-commit`。
  **commit する前に `bash .harness/bin/harness doctor` を回す**習慣にすると、この種の「静かに効かなくなる」状態を拾える。

## 2026-10-08 ビルド成果物を複数ディレクトリにコミットしても、git blob は共有されない

- 症状: 「Vite は依存を content-hash 付き vendor チャンクに分けるので、同じバージョンなら同じファイル =
  git は 1 つの blob を共有する」という前提で repo サイズを ~20 MB と見積もったが、検算で崩れた。
- 原因: 2 段ある。(1) Vite は**単一エントリのアプリビルドで vendor チャンクを自動分割しない**
  （公式 build ドキュメントに自動分割の記述が無く、`build.rolldownOptions.output.codeSplitting` 等で明示設定する前提）。
  (2) より決定的なのは **tree-shaking** — 作品ごとに使うライブラリの範囲が違うので、仮に vendor チャンクを
  分けても中身が作品ごとに異なり、content hash も変わる。
- 対処 / 再発したら: 見積りは「1 件あたりのバンドルサイズ × 件数」で出す（Three.js を使う作品で 400〜600 KB）。
  本当に 1 コピーにしたいなら、依存を `external` にして共有ファイルを 1 本置き、各作品がそれを import する。
  詳細は `decisions/0001-overall-architecture.md` の「repo サイズ」。

## 2026-10-08 [harness候補] scaffold 時に「未来の URL」を埋める設計では、URL に時刻依存の要素を入れてはいけない

- 症状: 作品の雛形を作る時点で `og:image` に R2 の URL（`lab/<YYYY>/<slug>/poster.webp`）を書き込む設計にしていた。
  12 月に雛形を作って 1 月に画像をアップロードすると**年が変わって URL が食い違い、`og:image` が 404 のまま残る**。
  X はカードをキャッシュし、Card Validator が廃止されているので**取り返しがつかない**。
- 原因: 「URL が予測可能だから先に書ける」という利点に乗ったが、予測の材料に**実行時刻**が混ざっていた。
- 対処 / 再発したら: 予測 URL に使う材料は、**scaffold 時と公開時で必ず同じ値になるもの**（slug）だけにする。
  日付・年・タイムスタンプは入れない。この件では R2 の key から年を外した（`lab/<slug>/...`）。

## 2026-10-08 macOS で大文字小文字だけ違うファイル名へ「書いてから旧名を rm」すると新しいファイルが消える [harness候補]

- 症状: `TimeAccumulator.ts` を `timeAccumulator.ts` にリネームするつもりで、新しい名前で書き込んだ後に `rm TimeAccumulator.ts` したら、
  ディレクトリが空になった。エラーは出ず、後のビルドが `Could not resolve './time/timeAccumulator.ts'` で落ちて初めて気づいた。
- 原因: macOS（APFS の既定）は大文字小文字を区別しない。2 つの名前は同じファイルを指していて、書き込みは上書き、`rm` はその 1 つを消した。
- 対処: 大文字小文字だけのリネームは `git mv Old.ts old.ts`（未追跡なら `mv Old.ts tmp && mv tmp old.ts`）で行い、旧名を `rm` しない。
  **再発したらまず**、リネーム後に `ls` で新しい名前の実体があるかを見る。

## 2026-10-08 R2 の custom domain は、拡張子によって CDN にキャッシュされない

- 症状: `media.takumifukasawa.com` に置いた `.txt` は `Cache-Control: immutable` を付けても毎回 `cf-cache-status: DYNAMIC`（キャッシュされない）。
  同じ場所の `.webp` は 1 回目 `MISS`、2 回目から `HIT` になった。
- 原因: Cloudflare は既定で**拡張子の許可リスト**に入るファイルだけを CDN にキャッシュする。`.mp4` / `.webp` は入っているが、入っていない拡張子もある
  （どれが入っているかは公式の「Default cache behavior」の一覧を見る）。Cache-Control ヘッダーだけでは決まらない。
- 対処 / 再発したら: 作品で R2 から `.glb` / `.hdr` / `.ktx2` / `.bin` などを読むようになったら、まず `curl -sI` で `cf-cache-status` を見る。
  `DYNAMIC` なら Cloudflare の Cache Rules で `media.takumifukasawa.com` を「Eligible for cache」にする（無料プランで可）。
  確かめるときは R2 の `lab/` 以下ではなく `_test/` に置いて、終わったら消す（`lab/` の key は上書きしない約束なので試し書きに使わない）。

## 2026-10-13 terser の `booleans_as_integers` が three の HDRLoader を壊す（dev では出ない）

- 症状: `lab/wip` のビルド成果物が `artifacts run` で落ちる。`[console] THREE.Error: THREE.HDRLoader: Bad File Format:
  missing image size specifier`。`pnpm dev:lab wip` では正常。`minify: false` にすると通る。
- 原因: `booleans_as_integers: true` は `true`/`false` を `1`/`0` に書き換える。HDRLoader は Radiance ヘッダを
  行単位で読み、行の終端を boolean の同一性比較で判定しているので、整数になると一致しなくなり
  画像サイズ指定子に到達する前に抜ける。**この作品のコードは無関係**で、`mangleProperties` を切ったのと同じ理由。
- 対処 / 再発したら: 作品が three の**ローダー**（HDRLoader / EXRLoader / GLTFLoader ...）を使い、
  dev で動いて成果物が落ちるなら、**まず `lab/<slug>/vite.config.ts` の `booleans_as_integers` を false にする**。
  それで直らなければ compress オプションを二分探索する（`minify: false` で通ることを先に確認してから。
  オプションを 1 つずつ戻してビルド → `node scripts/check-artifacts.ts <slug>` を回す）。
  この手の壊れ方は dev では絶対に出ないので、判定は必ず成果物側で行う（決定 0008）。
- 2026-10-17 に Tweakpane でも踏んだ: 訪問者向けのペイン（`lab/voxel-rain/controls.ts`）が `getContext('2d', { willReadFrequently: true })` を
  呼び、`1` になった値をブラウザが拒否して、作品が起動時に止まった。**公開してから** `harness check` の `artifacts run` で気付いた
  （`lab:add` の前に full の check を回していなかった）。雛形の既定を `false` にした。公開の前に必ず `harness check`（full）を通す。

## 2026-10-14 [harness候補] Windows では `strictPort` が古い dev サーバーを検知せず、同じポートに 2 本立つ

- 症状: `pnpm dev:lab <slug>` が正常に起動して URL まで出すのに、`http://localhost:5173/` が **404**。
  `index.html` も `main.ts` も 404 で、`/_shell.js` だけ 200 なので「成果物の構成が壊れた」ように見える。
  別のポート（`--port 5175`）で同じ sketch を立てると 200 で動く。
- 原因: 前のセッションの dev サーバーが生き残っていた。`--host` 無しで立てた古い方は `[::1]:5173`（localhost 限定）に
  バインドし、新しい方は `--host` で `0.0.0.0:5173` / `[::]:5173` にバインドする。**Windows ではワイルドカード bind と
  `[::1]` 限定 bind が衝突しない**ので `strictPort: true` が EADDRINUSE を出さず、2 本が同じポート番号で共存する。
  `localhost` は `::1` を先に引くため、ブラウザは**古い方**に繋がる。古い方の root（改名前の `lab/wip`）は
  既に存在しないので、全部 404 になっていた。
- 対処 / 再発したら: **`netstat -ano | grep LISTENING | grep :5173` で LISTENING が 2 行無いかを見る。**
  あれば `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>' | Select-Object -ExpandProperty CommandLine"`
  でどの sketch のサーバーか確かめ、古い方を `taskkill //PID <pid> //F` で落とす。
  見分け方は「`/_shell.js` だけ 200」— これは `dev-lab.ts` の middleware なのでどのサーバーでも返る。
  **`--host` の有無でバインド先が変わるので、同じポートに立て直すときは `--host` を揃える**（揃えていれば衝突して
  `strictPort` が止めてくれる）。`dev-lab.ts` のコメントにある「古いサーバーが 5173 を掴んで別の sketch を見てしまう」の
  変種で、**`strictPort` が守ってくれない**のがこちら（2026-10-14、`wip` → `greeble-flow` の改名後に踏んだ）。

## 2026-10-15 [harness候補] `.env.example` に後から足した行は、既に `.env` を作ったマシンに伝わらない

- 症状: `.env` はある（`doctor` も OK）のに、ある機能を使った瞬間だけ環境変数が無いと言われる。
  このプロジェクトでは `PUBLIC_MEDIA_BASE_URL` で、sketch を 1 件公開した直後に
  `pnpm dev` / `pnpm build` が `media keys cannot become URLs` で落ちる形になる。
  **`.env` を作った日には存在しなかった行**なので、手元を見ても「書き忘れ」に見えない。
- 原因: `.env` は gitignore なので、`cp .env.example .env` は**その時点のコピー**でしかない。
  後から `.env.example` に行が増えても既存の `.env` は変わらず、差分を知らせるものが何も無い。
  この repo では `.env`（2026-10-08 作成）と `PUBLIC_MEDIA_BASE_URL` の追加（2026-10-11）で 3 日ずれていた。
- 対処 / 再発したら: **`.env.example` の鍵の一覧と `.env` を比べる**。
  `diff <(grep -oE '^[A-Z_]+=' .env.example | sort) <(grep -oE '^[A-Z_]+=' .env | sort)`（値は出さない）。
  足りない行を `.env.example` から写す。秘密でない値（公開ドメインなど）はそのまま使える。
  `.env.example` に行を足した側は、**同じコミットで `docs/setup.md` に「既存の `.env` にも足す」を書く**
  （本人の別マシンが必ず踏む）。検査にするには `.env` を読む必要があり、CI には `.env` が無いので、
  機械化するなら「`.env` があるときだけ鍵の差分を WARN する」形になる（まだ足していない）。

## 2026-10-15 three の EffectComposer は生成時の pixel ratio を握ったまま、`renderer.setPixelRatio` に追従しない

- 症状: `pixelRatio` ノブ（と動的解像度の段）を変えても、シーンの細かさが変わらない。重さもほとんど変わらない。
  canvas の `width` は確かに大きくなっているので、効いているように見える。
- 原因: `new EffectComposer(renderer, target)` はコンストラクタで `renderer.getPixelRatio()` を 1 回読んで保持し、
  以降の `composer.setSize(w, h)` はその値で中間ターゲットを確保する。`createPost` が `renderer.setPixelRatio` より
  先に走っていたので 1 のまま固定され、**シーンは常に CSS サイズで描かれ、最後の OutputPass だけが大きい canvas に引き伸ばしていた**。
- 対処 / 再発したら: リサイズのたびに `composer.setPixelRatio(renderer.getPixelRatio())` してから `composer.setSize`
  （`lab/greeble-flow/post.ts`）。確かめ方は `composer.renderTarget1.width` と `canvas.width` が一致するかを見る。
  **post を使う sketch を作ったら最初に見る**。`?capture` の supersampling を入れようとして見つけた。

## 2026-10-15 [harness候補] pre-commit から走るテストが、一時 repo の `git add` で本物のコミットの index を汚す

- 症状: `pnpm lab:add` の本番初回で、R2 への put と md の書き込みまで済んだあと
  `error: invalid object 100644 ... for 'public/lab/alpha/texture.png'` / `Error building trees` で git commit が落ちた。
  `texture.png` も `alpha` もこの repo には無い（テストのデータ）。普段の `git commit` では一度も起きていなかった。
- 原因: パスを指定したコミット（`git commit -- <paths>`。`lab:add` がこれ）では git が一時 index を作り、
  フックに**絶対パスの `GIT_INDEX_FILE`** を渡す。pre-commit のテストは一時ディレクトリの repo で `git add` するが、
  `cwd` を変えても `GIT_INDEX_FILE` は引き継がれるので、**テストの blob のエントリが本物のコミットの index に書かれ**、
  blob 本体は一時 repo 側にしか無いので壊れる。パス指定なしのコミットでは表に出ない。
- 対処 / 再発したら: テストから git を呼ぶときは **`GIT_*` の環境変数を全部外す**（`scripts/lib/checks.test.ts` の `scratchEnv`。
  テスト対象のコードが自分で git を呼ぶなら `process.env` からも消す）。
  フックの中で落ちる・フックの中でだけ挙動が変わるテストを見たら、まず `env | grep ^GIT_` を疑う。
  確かめ方は、そのテストを含む変更を `git commit -m x -- <path>` のパス指定でコミットしてみること。

## 2026-10-15 [harness候補] 環境に `FORCE_COLOR` があると、`tests green` が「テストが 0 件」で落ちる

- 症状: テストは全部通る（`pnpm test` で 63 件 pass）のに、pre-commit の `tests green (>0)` が
  「テストが 0 件。0 件で green は不合格」で落ちてコミットできない。直前まで同じ検査が通っていた。
- 原因: セッションの環境に `FORCE_COLOR=3` が入っていた（Claude Code のセッションを作り直したタイミングで付いた）。
  `node --test` は `FORCE_COLOR` があると、`$(...)` で受けていても要約行に ANSI の色コードを付ける。
  検査は `grep '^ℹ tests'` で件数を読むので、行頭が `ESC[34m` になると 1 行も拾えず 0 件と判定する。
- 対処 / 再発したら: 検査の側で `FORCE_COLOR=0 node --test ...` と色を明示的に切る（`.harness/checks.sh`。`NO_COLOR` は
  `FORCE_COLOR` に負けるので効かない）。**出力を grep する検査は、色が付く可能性を先に潰す**。
  「通るはずのテストが 0 件と言われる」を見たら、まず `env | grep -i color` と、出力を `od -c` で見て行頭に `033[` が無いか。

## 2026-10-17 成果物の `drop_console: true` で、シェーダーのエラーが消えて `artifacts run` が素通りしていた

- 症状: わざと壊した WGSL でビルドした成果物を `artifacts run` が `ok` と判定した。WebGL の作品も同じで、成果物の bundle には
  `console.` が 1 件も無かった（4 件とも）。`page-problems.ts` の `SKETCH_PHRASES`（`Shader Error` 等）は成果物ではもう出てこない文言だった。
- 原因: three はシェーダーやパイプラインの失敗を API で検知し（WebGPU は `pushErrorScope` / `getCompilationInfo`、WebGL は
  `checkShaderErrors`）、`console.error` で知らせる。terser の `drop_console: true` がそれごと消す。例外は投げないので、検査に何も届かない。
  Chrome 自身も WebGPU の検証エラーは **warning** でしか出さない。
- 対処 / 再発したら: 作品の `vite.config.ts` は `drop_console: ['log', 'info', 'debug']`（雛形もこれ。`error` / `warn` を残す）。
  検査は文言を見ず「`console.error` が 1 件でもあれば失敗」のまま。**消す設定を足すときは、壊れたシェーダーで検査が落ちることを確かめる**。
  2026-10-17 より前にビルドした作品（greeble-flow / grid-ray-clock / voxel-rain）は消したままだが、公開済みで動いている WebGL の作品なので
  作り直さない（2026-10-17、人間の判断）。作り直すときに雛形の設定に合わせる。

## 2026-10-17 ヘッドレス Chrome の WebGPU は、実 GPU でしか検査に使えない

- 症状: `--use-angle=swiftshader` 等のいまのフラグでは WebGPU の adapter が null で、WebGPU の作品は「WebGPU が無い」経路を通って
  黙って `ok` になる（壊れた WGSL でも）。`--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` を足すと adapter は取れるが、
  **正常な作品でも** `Invalid Texture … CreateView` から Device Lost まで出て落ちる。`--disable-gpu` だけ外しても、ANGLE が SwiftShader の
  あいだは adapter が null のまま。
- 対処 / 再発したら: WebGPU の作品だけ、フラグなし（実 GPU）のブラウザでもう一度開く（`scripts/lib/chrome.ts` の `ChromeMode`、
  `check-artifacts.ts`）。adapter が取れないマシンでは `SKIPPED` と出る。WebGPU の作品が `ok` なのに中身が動いていない気がしたら、
  まず出力に `<slug> (WebGPU): ok` の行があるか（`SKIPPED` になっていないか）を見る。
