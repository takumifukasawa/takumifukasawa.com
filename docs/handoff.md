# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-10-17

## いま何をしているか（1〜3 行）

P0 の配管が**全部つながった**。`takumifukasawa.com` が Cloudflare から応答し（Pages ではなく **Workers Static Assets**）、R2 も配信済み。
**公開済みの sketch は 3 件**（`greeble-flow` 2026-10-15、`grid-ray-clock` 2026-10-16、**`voxel-rain` 2026-10-17**）。サイトは `/`（作品のグリッド + プロフィールのリンク）と
`/about/`（事実だけ）の 2 ページ。**次の本題は sketch を積むこと**（P1 に入るのは 5〜10 件たまってから）。
棚上げは 2 件（`lab-archives/mirror-sphere/` と `lab-archives/greeble/`。決定 0006）。
**日々の作業は `develop`、デプロイされるのは `main` だけ**（決定 0009）。

## 別の PC で再開するとき（最初にやること）

**`docs/setup.md` を上から順に**やる。clone で揃わないもの（Node・pnpm・`core.hooksPath`・**`.env`**・ffmpeg・mkcert の証明書）の一覧はそこが正。

```bash
git clone https://github.com/takumifukasawa/takumifukasawa.com.git
cd takumifukasawa.com
bash .harness/bin/harness doctor        # ← まずこれ。足りないものを全部教えてくれる
git config core.hooksPath .githooks     # pre-commit を有効化（git config は clone に乗らない）
cp .env.example .env                    # R2 のトークンをパスワードマネージャーから写す（lab:add だけが使う）
```

- `core.hooksPath` を設定しないと **commit は成功するのに検査が走らない**（`learnings.md` の 1 件目）。`doctor` が WARN で教える。
- **`.env` は git に入らない。** 無くても `lab:add` 以外は動く。`lab:add` は無いと直し方を出して止まる。
- `.harness/source.local`（gitignore 対象）が無いので `doctor` が「source が辿れない」と WARN する。
  `harness update` / `harness upstream` を使うときだけ、agent-harness を clone してそのパスを 1 行書く。使わないなら放置してよい。

## 状態

| 項目 | 状態 | 出典 |
|---|---|---|
| 決定 0001〜0010 / spec 3 本 | 採用・合意済（0001〜0004 は 2026-10-08、0005〜0007 は 2026-10-11、0008 は 2026-10-12、0009 は `develop` で作り `main` で出す、**0010 は TypeScript の型検査を必須にする**（2026-10-17）） | `ls docs/decisions/`, `spec/` |
| 検査 | **全部 pass。件数は叩いて確かめる**（ここに書くと腐る）。`artifacts run` と `types pass`（`astro check`）は `fast` ではない = **pre-commit では走らない**。**`lab:add` の前に必ず `harness check`（`--fast` なし）を通す**（2026-10-17 に飛ばして、起動時に止まるビルドを本番に出した。`learnings.md` 2026-10-13 の追記） | `bash .harness/bin/harness check`、登録内容は `.harness/checks.sh` |
| `pnpm new` / `dev:lab` / `lab:build` / `lab:rebuild --all` | 動作確認済み（`dev:lab --https` は未確認。初回は sudo が要る） | 計画 0-4 / 0-4b / 0-5 |
| `/_shell.js` | 配信・ブラウザでの表示・`?clean` を確認（ローカルの `wrangler dev` + 実ブラウザ）。GA の読み込みもここ経由。**`h` キーのトグルは未確認** | 計画 0-6、決定 0004 |
| サイト（Astro）| **`/` と `/about/` の 2 ページ**。共通の head・ヘッダー（名前 + About / X / GitHub / Shadertoy / Hatena Blog）は `src/layouts/Base.astro`。フォントは M PLUS 1 Code（Google Fonts）。見た目は暫定（P1 で決める）。`/about/` は事実だけ（名前・所属・職種・技術）。作品のカードは**行き先でタブを決める**（このサイトの作品は同じタブ） | `src/layouts/`、`src/pages/`、`spec/site-v0.md` |
| `/` の OGP | `og:image` は最新の公開 sketch の `poster`（いまは `greeble-flow`）、無ければ出さない。`/about/` は画像なし（`summary`）。**トップの URL は人に貼ってよい** | `curl -s https://takumifukasawa.com/ \| grep og:image` |
| `pnpm dev` / `pnpm preview` | 動作確認済み（http）。`--https` は未確認 | 計画 0-9 |
| `pnpm lab:add` | **本番初回を通した（2026-10-15、`greeble-flow`、`59dbc32`）**。R2 の put と md / manifest は自動で通り、git commit だけ pre-commit のテストが index を汚して落ちた（手でコミットして push）。原因はテストの `GIT_INDEX_FILE` 継承で、修正済み（`learnings.md`） | `git log --oneline main`、計画 0-8 |
| Cloudflare DNS | Active（2026-10-08） | 計画の進捗ログ |
| R2 `takumifukasawa-media` / `media.takumifukasawa.com` | 設定済み・確認済み。CORS `*`（GET / HEAD）、r2.dev 無効 | 計画の進捗ログ |
| 配信（**Workers Static Assets**） | 稼働。`/` も `/_shell.js` も 200、http は https へ 301。Pages は新規作成の入口が消えていたため使っていない | `curl -I https://takumifukasawa.com/`、`spec/site-v0.md`、`references/cloudflare-limits.md` |
| デプロイ | push → Workers Builds で自動。PR にはプレビュー URL が出る（Branch Preview は実機確認に便利） | `spec/site-v0.md` の「プレビュー URL」 |
| 計測 | GA4 `G-L3EDWSFJ82`。`/` は `index.astro`、全作品は `_shell.js` 経由。本番のリアルタイムで疎通確認済み。**開発機の Chrome はブロッカーで飛ばない** | `spec/site-v0.md` の「計測」、`learnings.md` |
| `lab/` の中身 | **`voxel-rain`**（**2026-10-17 公開**。`/lab/voxel-rain/`。下の節）、**`greeble-flow`**（公開済み。`/lab/greeble-flow/`）と **`grid-ray-clock`（2026-10-15 着手。`wip` → `grid-line-timer` → `grid-digital-clock` → `grid-ray-clock` と改名。**2026-10-16 公開**。`/lab/grid-ray-clock/`）**。撮影モード `?capture` あり。棚上げは `lab-archives/mirror-sphere/` と `lab-archives/greeble/`。**slug に連番は無く**（決定 0007）、**制作中は `wip`、公開時に本名へ改名**（`spec/publish-pipeline.md`。`greeble-flow` は 2026-10-14 に改名済み） | `ls lab/ lab-archives/`、決定 0006 / 0007 |
| 語彙の置き場 | Cosense `poc-input`（public）。公式 plugin + CLI 導入・login 済み。`greeble` / `語彙の書き方` の 2 ページを追加 | `cosense whoami https://scrapbox.io`、下の「解決済」 |
| TypeScript | **必須**（2026-10-17、決定 0010）。`typescript` は **6 系に固定**（7 は `astro check` が未対応）。対象は `src/`・`scripts/`・`lab/`（`lab-archives/` と `public/` は除外）。書き方は現代的な ES、プロパティのクォートは `mangleProperties = true` の作品だけ（`coding.md`） | `pnpm typecheck`、`tsconfig.json` |
| 制作中の `lab:build` | **制作中は回さない**（dev サーバーで確かめる）。ただし `lab build in sync` が pre-commit で走るので、**`lab/wip` をコミットするときだけ** `pnpm lab:build wip` してから。公開時は `lab:add` が自分でビルドする | `.harness/checks.sh` |
| `src/content.config.ts`（lab の schema） | あり。生成した md が `astro build` を通ることを確認 | `spec/content-model.md` |

## NEXT（依存順。順序制約があれば明記）

1. **撮影モードの共通部分を `lab/core/capture.ts` に出した**（2026-10-17）。`?capture` の判定・`captureView`・`s` で PNG 保存だけ。固定フレームと supersample の配線は作品の `main.ts`（`spec/publish-pipeline.md`）。
   **4 件目の sketch から `../core/capture.ts` を import する**（既存 3 件はコピーのまま）。`quality.ts`・`debug.ts`・`post.ts` のコピーは未判断（作品ごとの差が大きい）。core を変えたときの検査の穴は `tech-debt.md` #4。
2. **次の sketch を作る**。これが本題（評価軸は制作量。`AGENTS.md`）。`pnpm new <slug>`（制作中は `wip`）→ 制作 → 撮影モード（`?capture` → `s`）で poster →
   **`harness check`（full）** → `main` に `develop` をマージして `pnpm lab:add <slug> --poster <png>`（まず `--dry-run`）。撮影の約束は `spec/publish-pipeline.md` の「撮影のときだけ高品質にする」。
   **実装の前に、何を作るかを相談する**（2026-10-16、voxel rain で先に作り始めて止められた）。
3. 動画も出すなら: 録画の仕組みはまだ無い（OBS で画面ごと録るなら `?capture&clean`）。`canvas.captureStream` で撮る仕組みを作るなら、作品 2〜3 件で必要になってから。
4. `_shell.js` の `←` を「直前がこのサイトのトップなら `history.back()`」にする（**提案だけ、未着手**）。カードが同じタブになったので、作品が増えると `href="/"` ではトップのスクロール位置を失う。作品 1 件のいまは実害なし。
5. 公開後の実測の残り: repo サイズ、R2 の Class B（下の実測表）。
6. `[harness候補]` を agent-harness に戻す（`harness-maintain` の手順）: **`tests green` の `FORCE_COLOR`**（雛形の検査そのものの不具合。最優先）、テストの `GIT_INDEX_FILE` 継承（`learnings.md` 2026-10-15）、2026-10-17 の 3 件（検査出力の grep、古いブランチへの checkout で配布物が消える、iPhone の低電力モード）。
8. AI 側で残っているもの: `_shell.js` の `h` キーのトグル確認。
9. **別 repo の宿題**: `PaleGL/CLAUDE.md` に AI 利用範囲を書く（決定 0005 で「未着手」と明記したまま）。
10. `greeble-flow` は完成形（見た目の詰めは再開しない）。保留 3 件（床の読みやすさ / `flowExtent` の自動決定 / CPU→GPU 転送削減）は下の節。

## `voxel-rain` の現在地（2026-10-16 着手、2026-10-17 公開。旧 `wip`）

ボクセルの世界に雨が降り、床に波紋が広がる。床は 2D の波動方程式で、波の高さで光り、上下し、強いところほど大きくなる。
雨は粒ごとに柱を等速で落ち、尾の明るさは頭からの距離で出す（**3D の配列は持たない**。状態は床の波と粒の一覧だけ）。

人間と合意した仕様（2026-10-16〜17）:
- 積もらない雨。セルが一瞬光る。波紋は波動方程式で、形は平ら・振幅で光る。空のセルは格子点だけ（床の 1 層だけ。天井は床と見間違えるので消した）。
- 床は**読み込み時に画面を覆う大きさ**で作る。マス数は `floorCells` の予算で固定し、ボクセルの大きさは自動。スマホは `minCellPx` でボクセルを大きく保つ。リサイズは考慮しない（余白 `floorMargin` で吸収）。
- 雨は**画面のランダムな点の下の柱**に降らせる（`rainRate` は画面全体の粒数）。遠くはフォグで背景に溶かし、床もフォグの先までは作らない。
- カメラは上から（`camPitch` 41）。下から見上げる構図（`camPitchBelow`）も作り、`camView` で切り替えられる。**作品の顔は上から**（人間の判断）。
- クリック / ドラッグで雨（高さ固定の面に raycast して、そこから落とす）。出た場所に暖色の光の粒。軽い色収差。
- **訪問者向けのつまみ**（`controls.ts`。閉じた小さな pane）: view・雨の量・色 2 つ・波紋の速さ / 寿命 / 明るさ。出すかは作品ごとに決める（`spec/publish-pipeline.md`）。
- **AI との分担: 今回も全部 AI が書く**（人間の明示的な許可、2026-10-16「今回も全部 AI」）。greeble-flow / grid-ray-clock と同じく例外で、方針変更ではない。

撮影（poster は人間が実機で `?capture` → `s` で撮った 1 枚）:
- 撮影モードでもクリックで雨を落とせる（光の粒は出さない）。`d` で画面中央の下に 1 粒。スクリプトからは `window.voxelRain.drop(x, y)` と `window.voxelRain.params`。
- **ヘッドレス（swiftshader）で `?capture` を撮ると、色収差 + MSAA の組み合わせで真っ黒になる**。実機の GPU では正常。ヘッドレスで撮るなら `captureMsaa` を 0 にする。
- ヘッドレスで `s`（ダウンロード）を続けて押すと途中から保存されない。`Page.captureScreenshot` で撮る。

## `grid-ray-clock` の現在地（2026-10-15 着手。旧 `wip` / `grid-line-timer` / `grid-digital-clock`）

グリッドの上のデジタル時計。時計は常に点いていて、毎秒**変わる桁だけ、その桁の新しい数字の全セグメント**が画面外からグリッド線に沿って縦横に曲がりながら来て、
秒の境目ちょうどに着く。その桁の古い数字はその場でフェード。bloom あり。カメラは常にゆっくり動く（yaw と pitch を割り切れない周期で揺らす）。three.js（カメラを少し斜めにするため。pixi は落選）。

人間と合意した仕様（2026-10-15）:
- 24 時間・ローカル時刻。**`HH:MM:SS`**（最初は `HH:MM` だったが「秒がないと毎秒来る意味がない」で秒を足した）。
- 1 桁 ＝ 1×2 セル、セグメント ＝ セルの辺。グリッドは薄く見せる。
- 配置は `layout` ノブ（`auto` / `row` / `column`）。`auto` は横長で `HH MM SS` 横並び（桁間 1 セル・組間 2 セル）、縦長で 3 段（段間 1 セル）。
  **PC も縦積みにするかは実物を見て決める**（未決）。カメラは時計の外接矩形が画面の `camFit` を占めるように引く。
- **変わる桁を丸ごと入れ替える**（2026-10-15。最初は毎秒全セグメント →「目にうるさい」で変わるセグメントだけ →
  `8→9` が棒が 1 本消えるだけでバグに見えるので桁単位に。桁の繰り上がりがそのまま演出の強弱になる）。
  毎分 0 秒に全部飛ばし直す案は入れていない。短い尾。線同士の重なりは許す。
- **AI との分担: 今回は全部 AI が書く**（人間の明示的な許可、2026-10-15「今回も一旦全部あなたが書く感じで」）。greeble-flow と同じく例外で、方針変更ではない。

構成: `clock.ts`（7 セグ表と配置）/ `route.ts`（経路。セグメントから逆向きに歩いて画面外へ出す。秒ごとに seed 固定）/
`lines.ts`（秒ごとのバッチと instanced quad）/ `grid.ts` / `post.ts`（bloom: `bloomScale` 0.5 + MSAA 4 + 動的解像度）。
`quality.ts` / `capture.ts` / `debug.ts` は greeble-flow からのコピー（2 件目。**3 件目で `lab/core/` を判断**）。

**2026-10-16 公開済み**（`b3acc73`）。PC は横並び・縦長は 3 段の `layout: auto` で確定。
公開後に足したもの: マウス / ドラッグでカメラ（離しても戻らない）、クリック・タップで波紋、秒ごとの 2 音交互の「ピッ」
（既定 on・最初の操作で鳴る・右上ミュート・タブ非表示で停止・iOS は `audioSession = 'playback'`。約束は `spec/publish-pipeline.md` の「音のある作品」）。
撮影は `?capture&time=23:59:55` のように開始時刻を指定できる。
途中で `grid-digital-clock` として一度 `lab:add` してしまい、数分後に取り下げた（決定 0007 末尾の記録。R2 に孤立した poster が 1 つ残る）。

## `greeble-flow` の現在地（2026-10-14。旧 `wip`）

**2026-10-14、人間の判断で現状を完成形とした。** 見た目の詰めはここで止める。
`params.json` の **`flowGlow` が `0`（= 発光オフ）は意図どおり**（`flow.ts:450` が `> 0` で短絡する）。上げ忘れではないので戻さない。
下の「流れの発光」の実装はそのまま残してあり、使うかどうかはノブの値だけで決まる。
**残っていた 3 件（床の読みやすさ / `flowExtent` の自動決定 / CPU→GPU 転送削減）は未着手のまま保留**。完成形の判断に含めない。

**方向**: ポインタの周りの板が隆起し、横から流れてくる粒（リボンの尾 + 先端の円）がそれを川のように避けて渡る。
船体（UV に貼る案）からは 2026-10-13 に作り替えた（`ea2ffa7`）。下の「2026-10-12 の 2 回目」の `wip` の記述は**歴史**。

| 項目 | 状態 | 出典 |
|---|---|---|
| bloom のちらつき / 箱のエッジ | コミット済（`3732c56`）。合成先の MSAA、`bloomScale` 1、エッジは `edge.glsl` | `lab/greeble-flow/post.ts`, `edges.ts`, `edge.glsl` |
| `dev:lab --host` / `--port` | コミット済。`--host` は LAN と Tailscale（`*.ts.net`）で http 配信 | `scripts/dev-lab.ts`, `spec/publish-pipeline.md` |
| 流れ: `flowExtent`（範囲をノブに）、粒同士の分離、粒ごとのばらつき、川の回り込み、曲がると光る | コミット済（2026-10-14） | `lab/greeble-flow/flow.ts` |
| **撮影モード `?capture`**（2026-10-15）: `http://localhost:5173/?capture` で開き **`s` で PNG 保存**（`&clean` は画面ごと録画するときだけ）。1920×1080 固定を 2 倍で描いて縮小（＝AA）、MSAA 8、動的解像度オフ、ポインタは画面中央に固定（床が中央で隆起）。値は `params.json` の `capture*` ノブ。`captureBloomScale` 1 が画面で詰めた bloom の広がりと同じで、上げると細かくなるが広がりも縮む。動画の録画も同じモードを使う前提（録画の仕組み自体はまだ無い） | コミット済（2026-10-15） | `lab/greeble-flow/capture.ts`、`main.ts`、`pointer.ts` |
| **`pixelRatio` ノブがシーンに効いていなかった**のを直した（2026-10-15）。EffectComposer が生成時の pixel ratio（=1）を握ったままだった。**画面でもシーンが実際に `min(DPR, 1.5)` 倍で描かれるようになり、見た目が細かく・重くなった**。前の見た目に戻すなら `pixelRatio` を 1 | コミット済（2026-10-15） | `lab/greeble-flow/post.ts`、`learnings.md` |
| デバッグ画面（Tweakpane）を **`?debug` のときだけ出す**ように変えた（2026-10-14。既定は非表示。dev も同じ＝`http://localhost:5173/?debug`）。雛形のコメントと spec も直した | コミット済（2026-10-15） | `lab/greeble-flow/debug.ts`、`scripts/templates/sketch/main.ts`、`spec/publish-pipeline.md` |

- **流れのモデルは「避ける」のまま**。渦（curl / stream function）に書き換えた版は**人間が却下**（2026-10-14。「タップしたところに磁場みたいに渦巻く」。避ける動きの方が良い）。再提案しない。
- 川の回り込みは、障害物へ向かう成分だけを消す、回る向きを粒ごとに固定する、押し出しは障害物の上だけ、上流成分を最後に消す、の 4 つ。
  障害物の近くで逆走 16% → 1%、停止 31% → 4%、向きの振れ 21° → 4°/frame（Node で実測。マウス静止）。
- 発光は向きの変化率（rad/s）で決める。障害物が無いと光らない（先端が 1.5 倍を超える粒が 1% 未満）。

**AI との分担について**: `edge.glsl`（エッジの核）と `flow.ts` の上記の振る舞いは、**人間の明示的な許可**
（2026-10-14「今回は全部書いてok」ほか）で AI が書いた。greeble と同じく例外であって方針変更ではない。

## 2026-10-12 の 2 回目のセッションで動いたもの

- **greeble を仕上げた**: 発光トレース / ライティング / bloom・色収差・被写界深度 / ループするカメラ。
  実機で重さを測るための `perf`（フレーム時間）と `pixelRatio` のノブも入れた
- **`artifacts run` 検査を足した**（決定 0008）。ビルド成果物をヘッドレス Chrome で開いてコンソールエラー 0 を見る。
  **property mangling は既定で切った** — three の `ShaderChunk` / `ShaderLib` / `shaderIDs` が文字列キーで壊れる
- **`wip` へ方向転換**: greeble が Unity の起動画面に似すぎるので、同じ核を**メッシュの UV に貼る**方向へ。
  `surface.ts` だけが変わり、`subdivide` / `height` / `growth` は契約そのままで動いた。
  メッシュは Blender MCP（**公式** `lab/blender_mcp`）で作っている（`lab/wip/hull.blender.py` + `hull.glb`）
- **制作中の slug を `wip` にする規約**を入れた。`pnpm lab:add` が `wip*` を拒否する
- **板（BSP の祖先）で高さと時刻を決める**ようにした。葉ごとだと scatter に見えるため
- **一次形状を滑らかな莢 → 面で構成された船体に替えた**。SF 船の階層（一次=塊 / 二次=パネル割り /
  三次=greeble）に合わせたもので、**面が平らだと greeble が「場」としてまとまる**のが原理。
  滑らかな凸の塊には大きな斜めの平面が無いので、どうやっても模様に潰れる

### 当時の `wip`（船体案。2026-10-13 に床 + 流れへ作り替えたので歴史）

**技術的には通っている。だが「既存の手法の忠実な再現」で止まっていて、作る理由が無い**（人間の判断、2026-10-13）。

残っている一番大きな未使用資産は **BSP が「木」であること**。ILM の模型は静止した部品、Geometry Nodes の
scatter は階層の無い点の集合で、**どちらも分割の木を持たない**。いまの実装は木を一度平らに潰して
葉だけ並べているので、持っているものを使っていない。

提案した方向（未着手）:
- **A: 木の深さを時間で動かす。** `plateSize` を位相関数で振ると、大きな板が細部に解けてまた戻る。
  静止した模型には原理的にできず、scatter には階層が無いのでできない。**ほぼ既存のコードで動く**
- B: 分割が外部の場（光・動き）に応答する。分割器をセンサーとして使う
- C: 外に押し出す代わりに内へ沈める＝侵食

**没にするのも正しい**（決定 0006）。`greeble`（床版）は完成していて公開できる状態なので、
そちらを `lab:add` の本番初回に使い、`wip` は棚上げ、という畳み方がある。
→ **実際は逆になった**: `wip` が残って `greeble-flow` として完成し、`greeble` が没になった（2026-10-14）。

## greeble（2026-10-14 に没。`lab-archives/greeble/`）

**出さないと決めた**（人間の判断、2026-10-14）。決定 0006 の手順どおり `lab-archives/greeble/` へ移し、
`public/lab/greeble/` と `lab/.build-meta/greeble.json` を消した（`harness check` は pass=9 fail=0）。
以下は**歴史**。戻すときは `git mv` を逆にして `pnpm lab:build greeble`。

| ファイル | 役割 |
|---|---|
| `subdivide.ts` | 再帰矩形分割（BSP）。長辺を 85% の確率で切り、切り位置を中央からずらし、確率で早期打ち切り / セルを落とす |
| `height.ts` | セルごとのハッシュ。小セルの一部だけをマストとして突出させる |
| `growth.ts` | 位相オフセット（放射状 + ハッシュ）と ease-out-back。両端が 0 なのでループが厳密に閉じる |
| `hash.ts` | 上 2 つが共有する 32bit ミックス |
| `params.json` | **ノブの値はここだけ。`.ts` に値は 1 つも無い** |
| `params.ts` | スキーマ（キー・範囲・フォルダ）。型も検証も pane もここから導出 |
| `blocks.ts` / `main.ts` / `debug.ts` | 配線（three の scene、instancing、行列詰め、Tweakpane） |

**AI との分担について**: 決定 0005 では核（procedural logic）を人間が書くことになっているが、
**この sketch については人間の明示的な指示（「一旦作り切ってみてほしい」）で AI が書き切った**。
例外であって方針変更ではない。3 本は独立したファイルなので、任意の 1 本だけ自分で書き直せる形にしてある。

### 確認できていなかったこと（没にしたので宿題ではない）

- **動いているところを人間が見ていない。** ロジックは Node で数値的に検証した（ループ誤差 6.7e-15、
  周期を 240 分割して静止する瞬間が 0%）が、自動操作で開いたタブは `requestAnimationFrame` が止まるので
  画面での確認は取れていない（`learnings.md` 2026-10-12）
- **保存ボタンを pane から押していない。** エンドポイントは `curl` で検証済み（正常系・不正な POST の 400 とも）だが、
  ボタン → fetch → Vite のリロードという一連は未確認
- 参照元（Unity 6 の起動画面）の発光バー・被写界深度・色収差は入れた（2026-10-12 の 2 回目）。速度方向ストレッチのパーティクルは greeble には入れていない

## P0 で必ず実測するもの（未確認のまま進めている前提。greeble の節とは独立）

| 測るもの | なぜ | 書き戻す先 |
|---|---|---|
| repo サイズ（`du -sh .git` と working tree） | 500 件 ~150 MB の見込みが当たっているか。外れたら Three.js を external にして共有コピー 1 本にする | `decisions/0001` の「repo サイズ」と `learnings.md` |
| ~~デプロイ所要時間と差分アップロード~~ | **済（2026-10-11）。差分アップロードされる**（`Found 1 new or modified static asset to upload`）。初回ビルド 48 秒 | 書き戻し済: `references/cloudflare-limits.md` の「実測」 |
| `base: './'` の成果物が Worker・動的 import・`new URL(..., import.meta.url)` 込みで動くか | (B) への乗り換えを `git mv` だけにする前提（決定 0004） | `decisions/0004-lab-shell.md` |
| ~~`/lab/<slug>`（末尾スラッシュ無し）が `/lab/<slug>/` へリダイレクトされるか~~ | **済（2026-10-15）。本番で 307 → `/lab/greeble-flow/` が 200**。301 にはしていない（理由は決定 0004） | 書き戻し済: `decisions/0004-lab-shell.md` |
| R2 の Class B 実績（Dashboard） | キャッシュヒットがカウントされるかが未確認 | `references/cloudflare-limits.md` の未確認事項 |

## 未確定事項（人間の判断待ち）

- 「説明の文章を書かない」を agent-harness へ昇格させるか（2026-10-11 保留）。いまはこの repo の `AGENTS.md` のみ。昇格させるなら断定形ではなく条件つき（成果物が「説明の要るもの」か「現物が語るもの」かを先に確認する形）に書き換える
- **`AGENTS.md` の「このプロジェクトの目的」の書き方**（2026-10-15 に提案、返事待ち）: いまの「作品を束ねるハブ」だと、サイトに載せるものを作品に限ると読める
  （AI が実際にそう読み違えた）。本人の意図は「作品・ブログ・プロフィールを束ねる個人のページ。ただし評価軸は制作量で、サイトの作り込みは下位」
- `/about/` に PaleGL へのリンクを載せるか（spec にはあった。2026-10-15 時点で未定）。受賞歴は「いったん無し」で確定（枠だけある）
- `greeble` を没にした理由（docs には「人間の判断」とだけある。`lab-archives/` は見返す棚なので一言あると効く）
- **撮影モードを `lab/core/` に出すか**（3 件目で判断する約束。NEXT の 1）
- `voxel-rain` の訪問者向けペインの `view`（上から / 下から）の切り替えを残すか（2026-10-17 に質問して返事なし。いまは残してある）
- フォント・配色・レイアウトの方向性（P1 着手時に決める。フォントだけ M PLUS 1 Code に先行決定）。グリッドの列数は「デスクトップで 4 列前後、スマホで 2 列」が候補（2026-10-08）。sketch を数件並べてから決める

### 2026-10-11〜12 に決めたことの置き場（本文はそれぞれの doc にある）

| 決めたこと | どこに書いたか |
|---|---|
| 没 sketch の置き場（`lab-archives/<slug>/`） | `decisions/0006`（番号の節は 0007 で廃止） |
| sketch の識別子から連番を外す（`lab/<slug>/`） | `decisions/0007` |
| ビルド成果物をヘッドレスで開く検査 / property mangling を既定で切る | `decisions/0008`、`coding.md`、`architecture.md` の不変条件表 |
| AI にどこまで書かせるか（線は「道具か主題か」） | `decisions/0005` |
| 配信を Pages → Workers Static Assets | `decisions/0001` の「やり直す条件 2」に発動を追記。設定値は `spec/site-v0.md`、制限と実測は `references/cloudflare-limits.md` |
| `_shell.js` が計測も載せる（発火条件は導線の表示条件と別） | `decisions/0004` の 2026-10-11 の追記 |
| 計測を GA4 に（P1 → P0 に前倒し） | `spec/site-v0.md` の「計測」 |
| P0 でも `/` の 1 枚は作る | `spec/site-v0.md`（理由と落選案つき） |
| 説明の文章を書かない | `AGENTS.md` の「やらないこと」 |
| プレビュー URL の使い分け（Branch / Commit） | `spec/site-v0.md` の「プレビュー URL」 |

### 2026-10-08 の 2 回目のセッションで直したもの

- 検算の修正が他の doc に伝わっていなかった 11 件を直した（0001/0003 の「~20 MB」、`note` フィールドの残骸、OGP の「今年」、0002 の日付密度グリッドが P1 になっていた件、site-v0 の詳細ページ前提の受け入れ条件など）
- 作品ページからトップへの導線を決定 0004 として追加。iframe で包む案（B）と比べ、iOS Safari のカメラ・センサーの不確実さから**作品をそのまま配信する（A）**を選んだ。作品には `<script src="/_shell.js" defer>` の 1 行だけ焼き込み、見た目はサイト側の 1 ファイルで後から決める。`base: './'` で (B) への乗り換えを `git mv` だけにしてある

### 検算（2026-10-08、double-check）で直したもの

- **repo サイズ見積り ~20 MB は機構ごと誤りだった** → ~150 MB（working tree）に修正。Vite は vendor チャンクを自動分割せず、tree-shaking で作品ごとに中身が変わるので blob 共有は起きない（`learnings.md`）。本当に共有する逃げ道も決定 0001 に明記
- **`embedUrl` は導出可能だった** → 落として `public/lab/<slug>/index.html` の有無から導出。`z.string().url()` が相対パスを拒否するので絶対 URL を書くしかなく、「ホスト名を frontmatter に書かない」と矛盾していた。独立 repo の作品だけ `externalUrl` で上書き
- **R2 key の年が年末年始に OGP を壊す** → key から年を外した（`learnings.md`）
- `.build-meta.json` を `public/` の外（`lab/.build-meta/`）へ。`public/` 配下は配信されるので内部メタデータが公開され、`emptyOutDir` で消える危険もあった
- `media/manifest.json` の空 `{}` を P0 の最初にコミットすると明記
- Cloudflare Pages の設定値の表を `spec/site-v0.md` に追加
- Astro 5 の collection は `loader` が必須という記載を `spec/content-model.md` に追加
- **「Pages は差分アップロードする」は未確認に格下げ**（公式ドキュメントに記述が無い）

### 解決済（記録のため残す。再提案されたら理由を読む）

- `lab` か `labs` か → `lab`（単数）。決定 0002 の採用（2026-10-08）で確定
- 作品の URL → `takumifukasawa.com/lab/<slug>/`。サブドメインは使わない。実装は「作品を手元でビルドして `public/lab/<slug>/` にコミットする」方式で、Cloudflare 側のビルドは Astro だけを走らせる（決定 0001）
- `daily` という命名 → 頻度を構造に埋めるため廃止。`lab` / `sketch` に（決定 0002）
- 重め / 軽めの住み分け → 一緒くた。`experiments` という箱は作らず「重さ」のカテゴリも持たない（決定 0003 の一覧表）
- sketch の詳細ページ → 作らない。直リンクで足りる（`spec/site-v0.md`）
- タグを 2 本に分けるか → 分けない。`tech` と `themes` を 1 本の `tags` に統合（`spec/content-model.md`）
- `core`（自分が書いた部分）→ frontmatter に持たない。ルールは `AGENTS.md` の「AI との分担」に書いた
- GIF → 使わない。mp4 のみで `autoplay muted loop playsinline`（webm も作らない。決定 0003）
- R2 を使わない選択肢 → 使わない方が先に課金される（Git LFS の帯域）か品質が落ちる（`references/cloudflare-limits.md`）
- GitHub Pages → しない。帯域 100 GB/月のソフト上限でバズ時に止まる側に倒れる（決定 0001 落選案 E）
- バズった時のコスト → 構造的に $0。実際に効くのは R2 Class B のみで 1 件に月 41 万 PV 相当まで無料枠内
- 録画の既定 → 横 1920×1080 / 縦 1080×1920 / 60fps / 8〜12 秒ループ / 音なし / mp4
- モバイル対応 → 基本はモバイルで動くように作る。専用フィールドは持たない
- `themes` の語彙 → 固定しない。検査は既知語の表記ゆれだけで未知語は通す
- Cloudflare Pages → **使えない**。2026-10-11 時点でダッシュボードに新規作成の入口が無い。Workers Static Assets を使う（決定 0001 の逃げ道 2）
- 計測を Cloudflare Web Analytics にするか → GA4 にした（2026-10-11）。Cookie と third-party リクエストを払って、流入元とリアルタイムを取る（`spec/site-v0.md` の「計測」）
- 作品ページに計測を入れる手段 → `_shell.js` に載せる。作品は成果物をコミットする方式なので、直接足すと全件の再ビルドが要る
- カスタムドメインを `wrangler.jsonc` の `routes` に書くか → 書かない。CI のトークンに zone の編集権が無く deploy が落ちる
- トップページに説明文を置くか → 置かない（`AGENTS.md`）。sketch 0 件のときは名前だけが正しい状態
- 語彙（手法の名前）の置き場 → **この repo には持たない。Cosense 側**。`docs/` は「このプロジェクトの永続事実」に絞る
  （`greeble` のような語は世界の事実で、PaleGL / UE / Houdini と**複数 repo を跨ぐ**）。Markdown の表だと 20 行で連想が引けなくなる。
  repo に残すのは AI が実行する作業の道具と罠だけ（`learnings.md` の 2026-10-11 の 3 件）。
  Obsidian は落選。連想（2 hop リンク）が手張り頼みで、張り忘れた語が死ぬ。フォルダがあるぶん分類で止まる。
  **Settings → Page Data の Export / Import（JSON）があるので移行は取り返しがつく。**
  語彙 20 件まで溜めた時点で「2 hop が実際に効いているか」を見て、効いていなければ Obsidian へ移す
- Cosense を AI から触る手段 → **公式の `cosense` CLI + Agent Skill**（`helpfeel/cosense-cli`。PAT 認証で
  `connect.sid` を使わない）。第三者製 MCP（`worldnine/scrapbox-cosense-mcp`）は落選: 認証が
  `connect.sid`（ログインセッションそのもの。scope も revoke も無い）で、土台の API も
  **公式が「あくまで内部 API です。API は予告なく変更を行います」と明言**しているもの。
  公式 CLI には `list2hopLinks` / `browseRelatedPages` があるので、**2 hop は人間だけでなく AI 側からも引ける**
  （Cosense を選んだ理由がそのまま AI にも効く）。`previewEdit` → `submitEdit` の dry-run 二段は `lab:add` と同じ流儀
- greeble を次の sketch にするか → **した**（人間の決定、2026-10-11）。**ただし 2026-10-14 に没**（`lab-archives/greeble/`）。以下は当時の記録。AI 側は「`lab:add` の本番初回検証と重い題材を
  同時に走らせると、壊れたとき作品側か配管側か切り分けられない」として軽い題材を勧めたが、採らなかった。
  **懸念自体は残る** — 公開で詰まったら、まず配管（`--dry-run`）と作品を分けて切り分ける
- Cosense の立ち上げ → 済（2026-10-11）。public の `poc-input`、公式 plugin + CLI、login 済み。
  **`docs/setup.md` には書かない** — `cosense` は takumifukasawa.com のビルドにも検査にも要らない（語彙は別の箱）

## 確認したが意図的に更新しなかったもの（次のセッションが同じ確認を繰り返さないため）

- **2026-10-15 の決定（`/about/` の中身・カードのタブ・フォント・撮影モード）は決定ファイルを作らなかった**。どれも spec の変更として`spec/site-v0.md` / `spec/publish-pipeline.md` に理由ごと書いた。決定 0001 には「タブは行き先で決める」の追記だけ
- `docs/README.md`（索引）— 新しい doc は足していない。`docs/architecture.md` — 構造の変更なし（`src/layouts/` はサイトの内側の話）

- `docs/tech-debt.md` — 2 件とも返済済。行は残してある（新規の負債は無い）
- `docs/roles/` — harness の seed のまま。`task-orchestrate` を回す段階になったら読む
- `docs/rules/README.md` — `lab/AGENTS.md` と `lab/core/AGENTS.md` を登録済み。`lab-archives/` に `AGENTS.md` は置いていない（棚上げしたソースに規律は要らない）
- `docs/architecture.md` — 2026-10-12 に不変条件の表へ `artifacts run` を 1 行足しただけ。構造は変わっていない
- `docs/decisions/` — 2026-10-14〜15 の決定（`greeble` の没 / `?debug` / `/` の OGP）は**新しい決定ファイルを作らなかった**。没は決定 0006 の手順の適用、残り 2 つは spec（`publish-pipeline.md` / `site-v0.md`）の変更なので、理由と落選案は`plans/active/site-and-lab.md` の決定ログに置いた
- `docs/glossary.md` — `<NNN-slug>` → `<slug>` の置換のみ（決定 0007）
- `docs/spec/` 3 本 — 同上。連番の置換と `no`（連番）フィールドの扱いだけ。仕様そのものは変えていない
- `.harness/state/` — 使っていない（`task-orchestrate` を回していないため）
- `harness status` — managed の drift 0（2026-10-17 時点。`harness install` で配り直した直後）。`doctor` の WARN 2 件は既知（Codex の deny hook が未信頼、`.harness/source.local` 由来）
- **`.harness/checks.sh` は seed なので、`artifacts run` の追加は drift にならない**（プロジェクトが編集する領域）
