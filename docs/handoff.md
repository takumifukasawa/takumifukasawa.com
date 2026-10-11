# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-10-11

## いま何をしているか（1〜3 行）

P0 の配管が**全部つながった**。`takumifukasawa.com` が Cloudflare から応答し（Pages ではなく **Workers Static Assets**）、R2 も配信済み。
sketch 001 は作ったが出さないと決めて `lab-archives/` へ棚上げした（決定 0006）。**いま `lab/greeble/` を作っている最中**で、
同時に **slug から連番を外すリファクタが未コミットで進行中**（下の「進行中の作業」）。`lab:add` の本番初回はまだ通っていない。

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
| 検査 | **`lab build in sync` が落ちている**（`lab/greeble/` が未ビルド。作業中なら正常）。他は pass。すべて pre-commit で走る。**件数は叩いて確かめる**（ここに書くと腐る） | `bash .harness/bin/harness check`、登録内容は `.harness/checks.sh` |
| `pnpm new` / `dev:lab` / `lab:build` / `lab:rebuild --all` | 動作確認済み（`dev:lab --https` は未確認。初回は sudo が要る） | 計画 0-4 / 0-4b / 0-5 |
| `/_shell.js` | 配信・ブラウザでの表示・`?clean` を確認（ローカルの `wrangler dev` + 実ブラウザ）。GA の読み込みもここ経由。**`h` キーのトグルは未確認** | 計画 0-6、決定 0004 |
| Astro（`/` の 1 枚）/ `pnpm dev` / `pnpm preview` | 動作確認済み（http）。`--https` は未確認。`/` は暫定版で、sketch 0 件のいまは**名前だけが出る**（説明文は置かない規律。`AGENTS.md`）。1 件入れば自動でグリッドになることを捨てデータで確認済み | 計画 0-9 / 1-1、`src/pages/index.astro` |
| `pnpm lab:add` | `--dry-run` で全工程、R2 の put / 配信 / delete を `_test/` で確認。**本番の初回（sketch 002）で commit / push まで通すのが残り** | 計画 0-8 |
| Cloudflare DNS | Active（2026-10-08） | 計画の進捗ログ |
| R2 `takumifukasawa-media` / `media.takumifukasawa.com` | 設定済み・確認済み。CORS `*`（GET / HEAD）、r2.dev 無効 | 計画の進捗ログ |
| 配信（**Workers Static Assets**） | 稼働。`/` も `/_shell.js` も 200、http は https へ 301。Pages は新規作成の入口が消えていたため使っていない | `curl -I https://takumifukasawa.com/`、`spec/site-v0.md`、`references/cloudflare-limits.md` |
| デプロイ | push → Workers Builds で自動。PR にはプレビュー URL が出る（Branch Preview は実機確認に便利） | `spec/site-v0.md` の「プレビュー URL」 |
| 計測 | GA4 `G-L3EDWSFJ82`。`/` は `index.astro`、全作品は `_shell.js` 経由。本番のリアルタイムで疎通確認済み。**開発機の Chrome はブロッカーで飛ばない** | `spec/site-v0.md` の「計測」、`learnings.md` |
| `lab/` の中身 | `lab/greeble/`（**未追跡・作業中**）。001-mirror-sphere は `lab-archives/mirror-sphere/` へ棚上げ。番号の扱いは決定 0006 を改訂中 | `git status --short`、決定 0006 |
| 語彙の置き場 | Cosense `poc-input`（public）。公式 plugin + CLI 導入・login 済み。`greeble` / `語彙の書き方` の 2 ページを追加 | `cosense whoami https://scrapbox.io`、下の「解決済」 |
| `src/content.config.ts`（lab の schema） | あり。生成した md が `astro build` を通ることを確認 | `spec/content-model.md` |

## NEXT（依存順。順序制約があれば明記）

1. **進行中のリファクタを畳む**（下の「進行中の作業」）。`lab build in sync` が通るところまで。順序制約: **これを先にしないと、以降の失敗が作品側かリファクタ側か切り分けられない。**
2. **人間: `lab/greeble/` を仕上げる。** 技術的コアは自分で書く（決定 0005）。
3. 録画したら `pnpm lab:add <slug> --video <mp4>`（まず `--dry-run` で中身を見る）。
   **これが `lab:add` の本番初回**なので、AI と一緒に R2 / manifest / md / commit / push を確かめる。**ここが唯一の未検証な一本道。**
4. push が通ったら、作品が本番で動くことと末尾スラッシュ（`curl -I https://takumifukasawa.com/lab/<slug>`）を確かめる。下の実測表の残りもここで埋まる。
5. AI 側で残っているもの: ブラウザでの動作確認（mangle 後の作品、`_shell.js` の `h` キー）。
6. **別 repo の宿題**: `PaleGL/CLAUDE.md` に AI 利用範囲を書く（決定 0005 で「未着手」と明記したまま）。
7. **P0 で作るページは `/` の 1 枚だけ**（`spec/site-v0.md`。2026-10-11 に緩めた）。作り込みは P1。sketch を 5〜10 件積んでから P1 に入る。

## 進行中の作業（2026-10-11 時点で未コミット。AI が書いたものではない）

**slug から連番を外すリファクタ。** `git status --short` で見える。畳むまで検査は赤いままになる。

| | |
|---|---|
| 変更済み | docs 13 本 + `scripts/`（`new.ts` / `lab.ts` / テスト 3 本）+ `src/content.config.ts` / `src/lib/media.ts` + `lab/AGENTS.md` |
| ステージ済み | `lab-archives/001-mirror-sphere/` → `lab-archives/mirror-sphere/` のリネーム |
| 未追跡 | `lab/greeble/`（`index.html` / `main.ts` / `vite.config.ts` / `time/`） |
| 検査 | `lab build in sync` が fail（`public/lab/greeble/` が未ビルド） |

**揃っていないように見える点**（次のセッションはここから確かめる）: 改訂後の決定 0006 は
「番号を持つのは `lab/` だけ」「`001-greeble` があれば `001-something-else` も弾く」と書いているが、
`docs/coding.md` は `lab/<slug>/` に書き換わっていて、実際のディレクトリも `lab/greeble/` で番号が無い。
**0006 の本文と実装のどちらが正か**は人間に聞く（下の「未確定事項」）。

### P0 で必ず実測するもの（未確認のまま進めている前提）

| 測るもの | なぜ | 書き戻す先 |
|---|---|---|
| repo サイズ（`du -sh .git` と working tree） | 500 件 ~150 MB の見込みが当たっているか。外れたら Three.js を external にして共有コピー 1 本にする | `decisions/0001` の「repo サイズ」と `learnings.md` |
| ~~デプロイ所要時間と差分アップロード~~ | **済（2026-10-11）。差分アップロードされる**（`Found 1 new or modified static asset to upload`）。初回ビルド 48 秒 | 書き戻し済: `references/cloudflare-limits.md` の「実測」 |
| `base: './'` の成果物が Worker・動的 import・`new URL(..., import.meta.url)` 込みで動くか | (B) への乗り換えを `git mv` だけにする前提（決定 0004） | `decisions/0004-lab-shell.md` |
| `/lab/<slug>`（末尾スラッシュ無し）が `/lab/<slug>/` へリダイレクトされるか（`curl -I`） | 相対パスの成果物はスラッシュ無しで開くと白画面になる。されなければ `_redirects` で 301。**ローカルの `pnpm preview`（`wrangler dev`）では 307 で転送された**。本番は sketch を 1 件公開しないと測れない | `decisions/0004-lab-shell.md` |
| R2 の Class B 実績（Dashboard） | キャッシュヒットがカウントされるかが未確認 | `references/cloudflare-limits.md` の未確認事項 |

## 未確定事項（人間の判断待ち）

- **連番の設計**: 改訂中の決定 0006 の本文と、`coding.md` / 実際のディレクトリ名が食い違っている（上の「進行中の作業」）。どちらが正か
- 「説明の文章を書かない」を agent-harness へ昇格させるか（2026-10-11 保留）。いまはこの repo の `AGENTS.md` のみ。昇格させるなら断定形ではなく条件つき（成果物が「説明の要るもの」か「現物が語るもの」かを先に確認する形）に書き換える
- フォント・配色・レイアウトの方向性（P1 着手時に決める）。グリッドの列数は「デスクトップで 4 列前後、スマホで 2 列」が候補（2026-10-08）。sketch を数件並べてから決める

### 2026-10-11 に決めたことの置き場（本文はそれぞれの doc にある）

| 決めたこと | どこに書いたか |
|---|---|
| 没 sketch の置き場（`lab-archives/`。番号は返さない） | `decisions/0006` |
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
- greeble を次の sketch にするか → **する**（人間の決定、2026-10-11）。AI 側は「`lab:add` の本番初回検証と重い題材を
  同時に走らせると、壊れたとき作品側か配管側か切り分けられない」として軽い題材を勧めたが、採らなかった。
  **懸念自体は残る** — 公開で詰まったら、まず配管（`--dry-run`）と作品を分けて切り分ける
- Cosense の立ち上げ → 済（2026-10-11）。public の `poc-input`、公式 plugin + CLI、login 済み。
  **`docs/setup.md` には書かない** — `cosense` は takumifukasawa.com のビルドにも検査にも要らない（語彙は別の箱）

## 確認したが意図的に更新しなかったもの（次のセッションが同じ確認を繰り返さないため）

- `docs/tech-debt.md` — 2 件とも返済済。行は残してある（新規の負債は無い）
- `docs/roles/` — harness の seed のまま。`task-orchestrate` を回す段階になったら読む
- `docs/rules/README.md` — `lab/AGENTS.md` と `lab/core/AGENTS.md` を登録済み。`lab-archives/` に `AGENTS.md` は置いていない（棚上げしたソースに規律は要らない）
- `docs/architecture.md` / `docs/glossary.md` — Pages → Workers の表記だけ直した。構造は変わっていない
- `.harness/state/` — 使っていない（`task-orchestrate` を回していないため）
- `harness status` — managed の drift 0、`harness diff` も差分なし。`doctor` の WARN 2 件は既知（Codex の deny hook が未信頼、`.harness/source.local` 由来）
