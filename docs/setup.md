# 新しいマシンでのセットアップ

clone しただけでは揃わないもの（git に入れない・マシンごとに要るもの）の一覧。上から順に。
作業マシンを移す・増やすときはここを見る。

| # | やること | 何のため | 無いとどうなるか |
|---|---|---|---|
| 1 | nodenv で `.node-version` の Node を入れる（`nodenv install`） | Node 24 | スクリプトの `.ts` が直接動かない |
| 2 | `corepack enable` → `pnpm install` | pnpm は `package.json` の `packageManager` の版が使われる | |
| 3 | `git config core.hooksPath .githooks` | コミット前に `harness check --fast` を走らせる | 検査を通らないコミットが入る |
| 4 | **`cp .env.example .env` して値を埋める** | R2 の API トークン。**`.env` は git に入らないので、マシンごとに作る** | `pnpm lab:add` が止まる（他のコマンドは動く）。値の出どころは `.env.example` の冒頭 |
| 5 | `brew install ffmpeg` | `pnpm lab:add` が mp4 の再エンコードと poster の切り出しに使う | `pnpm lab:add` が止まる |
| 6 | 一度だけ `pnpm dev:lab <slug> --https`（sudo を求められる） | mkcert のルート証明書をこのマシンに入れる。`dev` / `preview` の `--https` も同じ証明書を使う | `--https` で起動できない（http なら動く） |
| 7 | 実機で見るなら: `~/.vite-plugin-mkcert/rootCA.pem` を iPhone に送ってインストールし、「設定 → 一般 → 情報 → 証明書信頼設定」で信頼する | LAN 内の iPhone から HTTPS で開く（カメラ・センサーは HTTPS 必須） | iPhone で証明書エラーになる |

`.env` / 証明書は**秘密**なので、マシン間でコピーするときも git・チャット・クラウドの共有フォルダを通さない（パスワードマネージャーから手で写す）。
