# 新しいマシンでのセットアップ

clone しただけでは揃わないもの（git に入れない・マシンごとに要るもの）の一覧。上から順に。
作業マシンを移す・増やすときはここを見る。

| # | やること | 何のため | 無いとどうなるか |
|---|---|---|---|
| 1 | `.node-version` の Node を入れる（下の OS 別） | Node 24（`package.json` の `engines` は `>=24`） | スクリプトの `.ts` が直接動かない |
| 2 | pnpm を `package.json` の `packageManager` と同じ版で用意 → `pnpm install` | 依存の再現性 | |
| 3 | `git config core.hooksPath .githooks` | コミット前に `harness check --fast` を走らせる | **commit は成功するのに検査が走らない** |
| 4 | **`cp .env.example .env` して値を埋める** | R2 の API トークン。**`.env` は git に入らないので、マシンごとに作る** | `pnpm lab:add` が止まる（他のコマンドは動く）。値の出どころは `.env.example` の冒頭 |
| 5 | ffmpeg を入れる（下の OS 別） | `pnpm lab:add` が mp4 の再エンコードと poster の切り出しに使う | `pnpm lab:add` が止まる |
| 6 | 一度だけ `pnpm dev:lab <slug> --https`（昇格を求められる） | mkcert のルート証明書をこのマシンに入れる。`dev` / `preview` の `--https` も同じ証明書を使う | `--https` で起動できない（http なら動く） |
| 7 | 実機で見るなら: `~/.vite-plugin-mkcert/rootCA.pem` を iPhone に送ってインストールし、「設定 → 一般 → 情報 → 証明書信頼設定」で信頼する | LAN 内の iPhone から HTTPS で開く（カメラ・センサーは HTTPS 必須） | iPhone で証明書エラーになる |

`.env` / 証明書は**秘密**なので、マシン間でコピーするときも
git・チャット・クラウドの共有フォルダを通さない（パスワードマネージャーから手で写す）。

## OS 別のコマンド

| # | macOS | Windows |
|---|---|---|
| 1 Node | `nodenv install`（`.node-version` を読む） | 既に Node 24 があればそれでよい（`engines` は `>=24`）。版を管理するなら `winget install Schniz.fnm`（fnm も `.node-version` を読む） |
| 2 pnpm | `corepack enable` → `pnpm install` | **`corepack enable` は admin が無いと失敗する**（`C:\Program Files\nodejs` への書き込みで `EPERM`）。`npm install -g pnpm@<packageManager の版>` で入れてから `pnpm install`（`learnings.md`） |
| 5 ffmpeg | `brew install ffmpeg` | `winget install Gyan.FFmpeg --scope user`。`ffmpeg` / `ffprobe` のエイリアスが `%LOCALAPPDATA%\Microsoft\WinGet\Links` に置かれ、winget がユーザー PATH に登録する。**シェルを開き直すまで PATH に乗らない** |
| 6 証明書 | `sudo` を求められる | UAC の昇格を求められる（**未確認**） |

## 動作確認（セットアップ後に 1 回）

```bash
pnpm test                          # 25 件
bash .harness/bin/harness check    # 8 件（doctor / docs / tests / lab 系 5 件）
pnpm build                         # Astro。P0 の時点ではページ 0 枚で正常
```

Windows での確認済み（2026-10-08）: 上記 3 つと `pnpm new` / `pnpm lab:build` が通る。
`pnpm lab:build` は `<script src="/_shell.js"> ... can't be bundled without type="module"` という Vite の警告を出すが、
**`/_shell.js` は作品にバンドルせずサイト側から配信するものなので、これは期待どおり**（`decisions/0004-lab-shell.md`）。
未確認: `--https`（mkcert）、`pnpm dev:lab` のブラウザでの見た目、`pnpm lab:add` の本番実行。
