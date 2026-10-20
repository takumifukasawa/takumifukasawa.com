# wip — 叩くと波が伝わり、ぶつかり、残る 3D ボクセル

- 開始: 2026-10-17
- 状態: 進行中（2026-10-17 に「始めて」。タスク 4 は人間の「セルの状態の構成」待ち）
- 関連: `spec/publish-pipeline.md`（撮影の約束）、`decisions/0005`（AI にどこまで書かせるか）、`decisions/0008`（成果物を開く検査）、`lab/core/capture.ts`

## 目的（何ができれば完了か）

3D のボクセル（まず立方体）を表示し、タップしたセルから波が中身を伝わって広がる。波は壁で跳ね返り、
互いにぶつかって干渉し、規則によっては色が残る。ドラッグで形を回転できる。公開まで（`lab:add`）。

## 受け入れ条件

- [ ] WebGPU のあるブラウザで、タップしたセルから波が広がり、反対の面にも遅れて届く
- [ ] 2 か所を叩くと波が干渉し、端で跳ね返る
- [ ] 動きの小さい pointer はタップ、それ以上はドラッグ（回転）として扱われる
- [ ] iPhone 実機で、タップで波が出てドラッグで回る（2026-10-17: 立方体の表示は確認済み）。**タスク 2 の時点で一度開く**（タスク 8 まで待たない）
- [ ] WebGPU の無い環境では、**画面にテキストでエラー文が 1 行**出て止まる。`console.*` には出さない（成果物では `drop_console` で消え、
      `console.error` は `artifacts run` を落とす）。WebGL2 に黙って落ちない（決定ログ参照）
- [x] `artifacts run` が WebGPU の経路（compute と描画）を実際に実行したうえで通る（実 GPU のブラウザ。2026-10-17）
- [ ] 成果物のサイズを記録し、`no large files`（2 MB）に掛からない
- [ ] `?capture` は `../core/capture.ts` を import して動き、`s` で PNG が保存される（コピーしない。handoff の NEXT 1）
- [ ] `harness check`（full）が通る

## 全体の形

```
形の関数 inside(x,y,z)（CPU で 1 回）→ セルの中/外の mask → GPU の buffer
毎フレーム: compute で状態を更新（波 + 残留）。中/外 の mask が壁になる
描画: 表面のセル（隣に空きのあるセル）だけを InstancedMesh で描く。インスタンスごとに固定の cellIndex を持たせ、
      fragment shader で cellIndex から状態を読んで色にする
入力: タップ → Raycaster で当たったインスタンス → cellIndex → そのセルを叩く / ドラッグ → 形を回転
```

## 分担

| もの | 担当 |
|---|---|
| 状態の更新の規則（伝わり方・減衰・跳ね返り・残留）。compute の本体、WGSL（`.wgsl`）。`globalId → (x,y,z)` と近傍のインデックス計算を含む | **人間**（核） |
| セル 1 個が持つ状態の構成と面の数（下の未確定事項） | **人間** |
| タップしたセルの叩き方（入れる値・広がり） | **人間** |
| 状態 → 色（fragment shader の数行） | **人間** |
| 状態 → ボクセルのずれ（`offset.wgsl`。向きと量） | **人間** |
| 形の関数 `inside(x,y,z)`（まず立方体） | **人間** |
| renderer・カメラ・buffer の確保・bind・dispatch・表面セルの instanced 描画の配線 | 共同（エージェントが骨組みを出して確認を取る） |
| タップとドラッグの判定、回転、Raycaster → cellIndex | エージェント |
| エラー文の表示、debug ペイン、撮影モードの配線、ビルド・公開 | エージェント |

エージェントは「人間」の行を書き切らない。骨組みは **bind・dispatch・空の本体（何もしない `fn`、定数の色を返す）まで**で止まる。
インデックス計算は人間（GPU アルゴリズムの入口なので）。

## タスク分解（依存順）

| # | タスク | 担当 | 状態 | 備考 |
|---|---|---|---|---|
| 1 | `pnpm new wip "<title>"` で雛形を作る | エージェント | 済 | タイトル必須（`scripts/new.ts`）。仮のタイトルでよい |
| 2 | renderer を WebGPU に載せ替え、非対応ならエラー文。カメラと回転操作 | 共同 | ほぼ済（残: `s` で PNG） | 下の「タスク 2 の中身」 |
| 3 | セルの mask（形の関数を呼ぶ側）と、表面セルの instanced 描画。色は定数 | 共同 | 済（人間の確認待ち） | Raycaster が当たるよう instanceMatrix は CPU で持つ（表面セルは形が決まれば固定）。`computeBoundingSphere()` を一度呼ぶ。インスタンスごとに固定の cellIndex 属性 |
| 4 | 状態の buffer と、毎フレーム compute を呼ぶ配線。本体は空 | 共同 | 済（人間の確認待ち） | **着手条件: 未確定事項の「セルの状態の構成」が決まっていること**。bind 済みの空の `.wgsl` の雛形まで |
| 5 | タップ → cellIndex → compute へ渡す（uniform）。叩く本体は空 | エージェント | 済 | |
| 6 | 形の関数・更新の規則・叩き方・色 | **人間** | ほぼ済（`step.wgsl`・`color.wgsl`・`offset.wgsl` は書かれた。`shape.ts` は立方体のまま） | 状態は fragment で読む（決定ログ） |
| 7 | debug ペイン（規則のパラメータ）、`?capture` を `../core/capture.ts` で | エージェント | debug ペインは済（`params.ts` / `params.json` / `debug.ts`、値は uniform で `.wgsl` の引数へ）。`?capture` は未着手 | `captureView` は `msaa` / `captureMsaa` / `autoQuality` を型で要求する。使うなら `params.json` に 3 キーを置き、使わないなら `capture`・`createShutter`・`takeShot` だけ import する。どちらにするかはここで決める |
| 6b | ボクセルを状態で動かす配線: 表面ごとに状態を写す compute、属性で頂点へ、空の `offset.wgsl` | エージェント | 済 | 決定ログ 2026-10-18 |
| 8 | 名前を決めて改名 → poster → `harness check`（full）→ `lab:add` | 共同 | 未着手 | |

### タスク 2 の中身

- renderer は `three/webgpu` の `Renderer` と `WebGPUBackend` を直接組み立てる（`new Renderer(new WebGPUBackend({ canvas }), { canvas })`）。
  `await renderer.init()` が reject したら、画面にテキストでエラー文を出して止まる。起動処理は async にする（雛形の `main.ts` は同期）。
- import は `three/webgpu` と `three/tsl` だけ。`'three'` と混ぜない（WebGLRenderer まで乗る）。
- 雛形の `getContext('2d')` は消す（残すと `TAG_RULES` で `canvas2d` タグが付く）。
- `*.wgsl?raw` の型宣言（`lab/voxel-rain/glsl.d.ts` 相当）を足す。`types pass` は必須（決定 0010）。
- `artifacts run` で WebGPU の中身まで実行する → 済（2026-10-17。決定ログ）。
- 一度ビルドして成果物のサイズを測る。2 MB を超えるなら import の切り方か `scripts/large-files-allow.txt` を相談する。
- `capture.ts` の `createImageBitmap(canvas)` は、init 後の `render()` が同期なので描画直後なら写るはず → 実機で `s` を押して PNG を確かめる。
  `_shell.js` は canvas に触らないので無関係。
- iPhone 実機で一度開く。

## 決定ログ

- 2026-10-17 **状態を持つ方式（B）**。理由: 波がぶつかる・跳ね返る・残るが欲しい。落選: 式だけで描く（A。形を素通りし、干渉・残留ができない）、
  タップ時にボクセルを伝う歩数を数えて式で描く（C。回り込むが、干渉・残留ができない）。
- 2026-10-17 **WebGPU（three.js の WebGPU 系 renderer）、compute は TSL の `wgslFn` で WGSL を書く**。理由: compute が素直に書け、描画・カメラ・撮影は
  three のまま使える。落選: 素の WebGPU（骨組みが重い）、WebGL2 の ping-pong（3D グリッドだと面倒）、WebGL で描画して compute だけ WebGPU
  （GPU のメモリを共有できず、毎フレーム CPU を経由する）。
- 2026-10-17 **波は中身を伝わる（3D グリッドの 6 近傍）**。落選: 表面だけ（表面セル同士の繋がりを別に作る手間）。
- 2026-10-17 **WebGPU が無い環境は、画面にテキストでエラー文 1 行**。落選: WebGL 版を別に作る（制作量に見合わない）、`console` に出す（成果物では消える）。
- 2026-10-17 **renderer は `Renderer` + `WebGPUBackend` を直接組み立てる**。理由: `WebGPURenderer` は WebGPU が無いと warn だけ出して WebGL2 に
  黙って落ちる（three r186 `src/renderers/webgpu/WebGPURenderer.js` の `getFallback`）。そこで WGSL が壊れ、エラー文の経路に入らない。
  直接組み立てれば fallback が無く、`init()` の reject をそのままエラー文に流せる。WebGL の backend がバンドルから落ちる見込みもある。
  落選: `WebGPURenderer` のまま `init()` 後に `backend.isWebGPUBackend` を見る（fallback の分バンドルが重い）、`navigator.gpu` の有無だけで判定する
  （`navigator.gpu` はあるのに adapter が null の環境がある。2026-10-17 にヘッドレス Chrome で実測）。
- 2026-10-17 **状態は fragment shader で読む**。理由: three は WebGPU の互換モード（`featureLevel: 'compatibility'`）で adapter を取り、
  GLES 系の Android では vertex stage で storage buffer を読めない可能性がある。fragment なら互換モードでも読める。
- 2026-10-18 **ボクセルを状態で動かす。向きはまず「中心へ」**（人間）。セルごとに中心への向き × `u`。状態の構成は変えない。
  落選: 視線の向きを 1 つだけ持つ（別の角度で叩くと前の波の向きまで変わる）。視線の向きを波に持たせる（`u`・`v` を vec3 に、1 セル vec4 × 2）は、
  中心への向きで物足りなければ次に試す（頂点側の配線はそのまま使える）。
- 2026-10-18 **頂点へは、表面ごとに状態を写す小さい compute を足し、属性として読む**（`toAttribute()`）。上の「fragment で読む」と同じ互換モードの理由で、
  頂点から storage を直接読まない。色も同じ写しを読む（読み口を 1 つにする）。落選: 頂点で `latest()` を直接読む（互換モードの Android で動かない恐れ）。
  当たり判定は動く前の位置（instanceMatrix）のまま。
- 2026-10-20 **箱の縁は角を丸めて出す**（人間）。`RoundedBoxGeometry`（`bevelRadius` / `bevelSegments` のノブ。変えると箱を作り直す）と、
  ハイライトが乗るよう `MeshStandardNodeMaterial`（`roughness` / `metalness`）。落選: fragment で縁だけ色を変える（縁の判定を自分で書く案。
  今回は見え方を先に試したい）、後処理で輪郭を検出（形の外周にも線が出て、重い）。`RoundedBoxGeometry` は `'three'` から import するが、
  core は `three/webgpu` と同じ `three.core.js` で、バンドルは +2 KB だった。
- 2026-10-20 **当たり判定は、描かない幅 1 の立方体で取る**（人間）。描いている箱は 0.9 で角も丸いので、レイが隙間を抜けて空洞を渡り、裏側の面に当たっていた
  （グリッド 32・ランダム 1 万回で、幅 1 の立方体と違うセルに当たるのが 18〜34%、裏側まで抜けるのが 1.1〜3.0%。丸みが大きいほど多い）。
  `voxels.ts` の `hit` が `mesh` と instanceMatrix を共有する。落選: 描いている箱のまま（隙間が埋まらない）、グリッド DDA（いまの規模では Raycaster で足りる）。
- 2026-10-20 **色とライトをノブにする**（人間）。`color.wgsl` の 3 色は引数に（計算は変えていない。置き換えはエージェント、人間が了承）、
  背景・環境光・平行光（色・強さ・向き）は `main.ts` が毎フレーム params から入れる。色は voxel-rain と同じ「メモリでは 0xRRGGBB、JSON では "#rrggbb"」。
- 2026-10-17 **形はまず立方体だけ**。切り替え方（キー / ペイン / 時間で移る）は形を増やすときに決める。
- 2026-10-17 **タップとドラッグは押した場所ではなく動き方で分ける**。落選: ボクセル以外を触ったら回転（スマホで掴む場所が無い）、
  ボクセルを押して動かしたら回転（外を触ったときの意味が別に要る）。
- 2026-10-17 **タップ判定は three.js の Raycaster**（`InstancedMesh` への総当たり。renderer に依存しない CPU 処理で、タップ時だけなので数万個なら数 ms の見込み）。
  重ければグリッド DDA に替える。
- 2026-10-17 **セルの状態は `vec4f(u, v, paint, spare)`、2 面の ping-pong**（人間。あとで変えてよい）。交互の方式は compute を 2 本作って交互に呼ぶ
  （`state.ts`。parity で中で選ぶ案より、`step.wgsl` が「prev を読み next に書く」だけで済む）。面の数や 1 セルの大きさを変えるときは `state.ts` と
  `.wgsl` の引数を直す。落選: ① `u` だけ 3 面、② `vec2(u, v)`、④ `vec3` の波 × 2（色つきは ③ の `paint` を色にする形で後から足せる）。
- 2026-10-17 **WGSL は `.wgsl` ファイルに分けて `?raw` で読む**。理由: `lab:add` のタグの自動推定（`scripts/lib/content.ts` の `TAG_RULES`）に
  `webgpu` と `wgsl` が付く。voxel-rain の `.glsl` と同じ形。落選: `wgslFn` に文字列で直書き（`'three/webgpu'` の import は `webgpu` の規則に掛からず、どちらのタグも付かない）。
- 2026-10-17 **`artifacts run`: 成果物に `console.error` を残し、WebGPU の作品は実 GPU のブラウザでも開く。adapter が無ければ SKIPPED**（人間）。
  検算（`/double-check`）で、先に決めていた SwiftShader の WebGPU 案は正常な作品でも落ちる誤検知と分かり、取り下げた。
  詳細と落選案は `decisions/0008` の 2026-10-17 の追記、罠は `learnings.md` 2026-10-17 の 2 件。

## 進捗ログ

- 2026-10-20 角の丸み・Standard マテリアル・色とライトのノブ（決定ログ）。グリッドの大きさを比べるため dev だけ `?grid=N` で上書きできる
  （大きさが決まったら外す）。成果物 964,462 B。`harness check` pass=11（`wip (WebGPU)` ok）。
- 2026-10-19 `post.ts`（three の `bloom` → `chromaticAberration`、`RenderPipeline`。つまみは `post` フォルダ）。止まっている色が純色だと色収差が見えないので
  全チャンネルを持つ色に、波の色は `glow` 倍で 1 を超えて波だけ光る。波は「叩いた所は速く、周りへは弱く」に寄せた（`k` を下げ `anchor` を上げ、
  `damping` を下げ、`knockStrength` を上げる。`anchor` の上限を 0.2 に）。値は仮（人間が色と一緒に詰める）。
- 2026-10-18 タスク 6b。`state.ts` に `shown`（表面ごとの状態の写し、`toAttribute()`）と写す compute を向き別に 2 本、`voxels.ts` は色もずれも `shown` を読み、
  `cellPosition` 属性と `positionNode = positionLocal + cellOffset(...)`、`offset.wgsl` は空のスタブ。スタブを一時的に「赤いセルを上へ 3」にして、
  叩くと箱が面から飛び出すことを dev で確かめ、空に戻した。`harness check` pass=11（`wip (WebGPU)` ok）。
- 2026-10-17 `artifacts run` の穴を塞いだ: 雛形と wip の `drop_console` を `['log', 'info', 'debug']` に、`chrome.ts` に `ChromeMode`（software / gpu）と
  `evaluate`、`check-artifacts.ts` が WebGPU の作品を実 GPU で開き直す（adapter が無ければ SKIPPED）。判定の方針は `chrome.ts` から
  `page-problems.ts` に分けた。壊した WGSL で `wip (WebGPU)` が落ち、正常では 4 件 + `wip (WebGPU)` が ok、adapter 無しで SKIPPED を確認。
- 2026-10-17 タスク 4・5。`state.ts`（`instancedArray` × 2 + solid、`wgslFn(step.wgsl)` を向き別に 2 本、`current` の uniform で fragment が最新を読む、
  `knock` は次の 1 ステップだけ `tap` に入る）、`step.wgsl` / `color.wgsl` は空のスタブ。fixedUpdate（60 Hz）で 1 ステップ。
  スタブを一時的に「叩いたセルを 1 にして赤く塗る」にして、叩く → compute → ping-pong → fragment で読む、がつながることを dev で確かめ、空に戻した。
- 2026-10-17 Chrome と iPhone 実機で表示を確認（人間）。実機は Tailscale Serve の https 経由: `pnpm dev:lab wip --host --port 5175` +
  `tailscale serve --bg --https=8443 http://127.0.0.1:5175` → `https://<machine>.<tailnet>.ts.net:8443/`（WebGPU は secure context が要るので、
  Tailscale の http の URL ではエラー文になる。tailnet で Serve を一度有効にする必要があった）。
- 2026-10-17 タスク 1〜3 と 5 の前半。`lab/wip/`: `shape.ts`（人間。いまは全部 true = 立方体のスタブ）、`cells.ts`、`voxels.ts`（Lambert の仮の見た目、
  箱 0.9、cellIndex 属性）、`pointer.ts`（6 px でタップ/ドラッグ、ワールド軸で形を回す）、`main.ts`（64³、初期の傾き π/6・-π/4 は仮）。
  `Renderer` を直接組むと `renderer.library` が空で、ライトのノードが見つからず真っ黒になる（`WebGPURenderer` が足している `StandardNodeLibrary` を自分で入れる）。
  成果物 791,670 B（voxel-rain 732,925 B）。ヘッドレスで確かめた: いまのフラグ → エラー文の経路、`--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` を足す →
  canvas が残りエラー 0（ただし swiftshader の絵はスクリーンショットでも画素読み出しでも空で、描けているかは確かめられていない）、実 GPU → 立方体が描ける。
  dev で タップ（中央 → cellIndex が出る / 外 → 何も出ない）とドラッグ（回る・タップにならない）を CDP の入力で確かめた。`harness check` pass=10。
- 2026-10-17 相談して計画を書いた。別のモデル（Fable）にレビューしてもらい、指摘（WebGL2 への黙った fallback、ヘッドレスの WebGPU、エラー文は DOM、
  状態の構成をタスク 4 の着手条件に、fragment で読む、バンドルの大きさ、iPhone 実機、細かいツールの食い違い）を反映した。実装は未着手。

## 未確定事項（人間の判断待ち）

- グリッドの大きさ（たたき台は 64³。表面は約 2.4 万セル）と、1 フレームに compute を何回回すか
  （2026-10-20: 64 だと箱が小さすぎて縁が見えないかもしれない。dev で `?grid=32` などを比べている）
- 回転に慣性を付けるか、どの軸で回すか（形を回す / カメラを回す）
- タップとみなす移動量の閾値（たたき台は数 px）
