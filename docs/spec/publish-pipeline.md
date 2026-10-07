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
#   1. ffmpeg で mp4 を再エンコード（H.264 / 1080p / ~8s / 音声なし）+ webm + poster.webp を生成
#   2. R2 に put（Cache-Control: immutable）
#   3. media/manifest.json に key/寸法/サイズを追記
#   4. src/content/lab/001-flow-field.md を frontmatter 込みで生成（date は今日、embedUrl は lab の URL）
#   5. 開くべきファイルのパスを出力する
...title / summary / tech / themes / core を書く（30 秒）...
git add -A && git commit && git push      # → takumifukasawa.com に自動 deploy
```

X への投稿は手でやる（動画は X に直接アップロードする。サイトの OGP 画像ではなく動画そのものが伸びるため）。
`pnpm lab:add` は最後に**投稿用テキストの雛形**（title / 1 行 / 作品 URL / ハッシュタグ候補）を標準出力に出す。

## 各ステップの約束

| ステップ | 約束 |
|---|---|
| 雛形生成 | lab 側の雛形は「canvas と requestAnimationFrame が動く最小」。ライブラリは作品ごとに import する（共通 bootstrap を最初に作らない） |
| R2 の key | `lab/<YYYY>/<NNN-slug>/{poster.webp,clip.mp4,clip.webm}`。一度 put した key は上書きしない |
| manifest | `media/manifest.json` は生成物だがコミットする。これが無いとビルドが落ちる（意図的: メディアの実在をオフラインで検査するため） |
| frontmatter | 必須 4 項目（`date` / `title` / `poster` / `tech`）は script が埋める。人間が書くのは `summary` / `themes` / `core` |
| 失敗したとき | script は冪等。同じ `slug` で再実行したら、既存 key は put をスキップし manifest と md を更新する |

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
- [ ] `--video` を省略し `--poster <path>` だけでも通る（静止画の sketch / Houdini のレンダリング用）
- [ ] lab repo のビルドが壊れていても、サイトのビルドと deploy は成功する

## 範囲外（当面やらない）

- X API での自動投稿（アカウント凍結リスクと API コストに見合わない。テキスト雛形の出力までで止める）
- AI による `summary` / `tech` / `themes` の自動生成 → P3。入れるときは `pnpm lab:add --ai` で**生成して frontmatter に入れるが、人間が必ず上書きできる**形にする（生成文をそのまま公開しない）
- 録画の自動化（ブラウザ内 MediaRecorder での自動キャプチャ）→ 必要になったら lab 側の共通 util として入れる

## 未確定事項

- 録画の既定フォーマット（長さ・解像度・fps）→ X の表示とサイト両方で使える値を sketch 3 件目までに固定する
