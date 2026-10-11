# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-10-11

## いま何をしているか（1〜3 行）

P0 の配管が**全部つながった**。`takumifukasawa.com` が Cloudflare から応答し（Pages ではなく **Workers Static Assets**）、R2 も配信済み。
sketch 001 は作ったが出さないと決めて `lab-archives/` へ棚上げした（決定 0006）。**次は人間が sketch 002 を作り、`lab:add` で公開まで 1 本通す番**（0-11）。
未検証の一本道はそこだけ。

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
| 決定 0001〜0006 / spec 3 本 | 採用・合意済（0001〜0004 は 2026-10-08、0005 / 0006 は 2026-10-11） | `decisions/`, `spec/` |
| 検査 | 8 件 pass（テスト 30 件 + lab 系 5 件 + docs / doctor）。すべて pre-commit で走る | `bash .harness/bin/harness check`、`.harness/checks.sh` |
| `pnpm new` / `dev:lab` / `lab:build` / `lab:rebuild --all` | 動作確認済み（`dev:lab --https` は未確認。初回は sudo が要る） | 計画 0-4 / 0-4b / 0-5 |
| `/_shell.js` | 配信まで確認。**ブラウザでの見た目・`h` キー・`?clean` は未確認** | 計画 0-6、決定 0004 |
| Astro（`/` の 1 枚）/ `pnpm dev` / `pnpm preview` | 動作確認済み（http）。`--https` は未確認。`/` は暫定版（sketch 0 件なので「まだ何も置いていない」が出る。1 件入れば自動でグリッドになることを捨てデータで確認済み） | 計画 0-9 / 1-1 |
| `pnpm lab:add` | `--dry-run` で全工程、R2 の put / 配信 / delete を `_test/` で確認。**本番の初回（sketch 002）で commit / push まで通すのが残り** | 計画 0-8 |
| Cloudflare DNS | Active（2026-10-08） | 計画の進捗ログ |
| R2 `takumifukasawa-media` / `media.takumifukasawa.com` | 設定済み・確認済み。CORS `*`（GET / HEAD）、r2.dev 無効 | 計画の進捗ログ |
| 配信（**Workers Static Assets**） | 稼働。`takumifukasawa.com` が応答し、`/_shell.js` が 200 + `max-age=300`。`/` は 404（P0 はページ 0 枚なので正常）。Pages は新規作成の入口が消えていたため使っていない | 計画 0-7、`spec/site-v0.md`、`references/cloudflare-limits.md` |
| `lab/` の中身 | **sketch 0 件。** 001-mirror-sphere は `lab-archives/` に棚上げ（番号は返さないので次は 002） | 決定 0006 |
| `src/content.config.ts`（lab の schema） | あり。生成した md が `astro build` を通ることを確認 | `spec/content-model.md` |

## NEXT（依存順。順序制約があれば明記）

1. **人間: sketch 002 を作る（計画 0-11）。** `pnpm new 002-<slug> "<title>"` → `pnpm dev:lab 002-<slug>`。技術的コアは自分で書く（決定 0005）。
2. 録画したら `pnpm lab:add 002-<slug> --video <mp4>`（まず `--dry-run` で中身を見る）。
   **これが `lab:add` の本番初回**なので、AI と一緒に R2 / manifest / md / commit / push を確かめる。**ここが唯一の未検証な一本道。**
3. push が通ったら、作品が本番で動くことと末尾スラッシュ（`curl -I https://takumifukasawa.com/lab/002-<slug>`）を確かめる。下の実測表の残りもここで埋まる。
4. AI 側で残っているもの: ブラウザでの動作確認（mangle 後の作品、`_shell.js` の見た目・`h`・`?clean`）。
5. **P0 で作るページは `/` の 1 枚だけ**（`spec/site-v0.md`。2026-10-11 に緩めた）。作り込みは P1。sketch を 5〜10 件積んでから P1 に入る。

### P0 で必ず実測するもの（未確認のまま進めている前提）

| 測るもの | なぜ | 書き戻す先 |
|---|---|---|
| repo サイズ（`du -sh .git` と working tree） | 500 件 ~150 MB の見込みが当たっているか。外れたら Three.js を external にして共有コピー 1 本にする | `decisions/0001` の「repo サイズ」と `learnings.md` |
| ~~デプロイ所要時間と差分アップロード~~ | **済（2026-10-11）。差分アップロードされる**（`Found 1 new or modified static asset to upload`）。初回ビルド 48 秒 | 書き戻し済: `references/cloudflare-limits.md` の「実測」 |
| `base: './'` の成果物が Worker・動的 import・`new URL(..., import.meta.url)` 込みで動くか | (B) への乗り換えを `git mv` だけにする前提（決定 0004） | `decisions/0004-lab-shell.md` |
| `/lab/<slug>`（末尾スラッシュ無し）が `/lab/<slug>/` へリダイレクトされるか（`curl -I`） | 相対パスの成果物はスラッシュ無しで開くと白画面になる。されなければ `_redirects` で 301。**ローカルの `pnpm preview`（`wrangler dev`）では 307 で転送された**。本番は sketch を 1 件公開しないと測れない | `decisions/0004-lab-shell.md` |
| R2 の Class B 実績（Dashboard） | キャッシュヒットがカウントされるかが未確認 | `references/cloudflare-limits.md` の未確認事項 |

## 未確定事項（人間の判断待ち）

- sketch 002 の題材（001 は棚上げ済み）
- フォント・配色・レイアウトの方向性（P1 着手時に決める）。グリッドの列数は「デスクトップで 4 列前後、スマホで 2 列」が候補（2026-10-08）。sketch を数件並べてから決める

### 2026-10-11 のセッションでやったこと

- **sketch 001 を棚上げした。** 出さないと決めたので `lab-archives/001-mirror-sphere/` へ移し、成果物（`public/lab/` と `.build-meta`）を消した。決定 0006 で置き場を定義し、`numberOwner()` で番号の再利用を防いだ（001 は永久に埋まる）
- **決定 0005**（AI にどこまで書かせるか）を記録。線は「ライブラリか自作か」ではなく**「道具か主題か」**。`PaleGL/CLAUDE.md` に AI 利用範囲を書くのは**未着手**
- **配信を Pages から Workers Static Assets に変えた。** ダッシュボードに Pages の新規作成の入口が無く、決定 0001 の逃げ道 2 がそのまま発動。`wrangler.jsonc` 1 枚と `pnpm preview` の 1 行で済んだ。**静的アセットのリクエストは無料・無制限**なので「バズっても構造的に $0」は維持（`references/cloudflare-limits.md`）
- **`takumifukasawa.com` が応答するようになった。** 旧 A レコードを消してから向き先が無く NXDOMAIN だった状態の解消
- CRLF で保存されていた 5 ファイルを LF に戻してからコミットした（直さないと差分が全書き換えに見える）
- **tech-debt を 2 件とも返済した。** Always Use HTTPS を on（http が 301 で https へ）、`workers_dev: false` で本番 workers.dev を塞いだ（PR #1 で「プレビュー URL は生きたまま本番だけ塞がる」ことを実機確認してから merge）
- **`/` に暫定のトップページを置いた**（`src/pages/index.astro` + `src/lib/media.ts`）。`spec/site-v0.md` の「P0 ではページを 1 枚も作らない」を緩めた。sketch が入れば自動で一覧になる
- **プレビュー URL の使い方が分かった**（`spec/site-v0.md`）。Branch Preview URL はブランチ名で安定するので、**スマホでの実機確認はこれが一番楽**。`X-Robots-Tag: noindex` も付く

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

## このセッションで触らなかったが確認したもの

- `docs/tech-debt.md` は 2 件とも返済済（行は残してある）
- `docs/roles/` は harness の seed のまま。`task-orchestrate` を回す段階になったら読む
- `docs/rules/README.md` に `lab/AGENTS.md` と `lab/core/AGENTS.md`（3 回ルール）を登録済み
