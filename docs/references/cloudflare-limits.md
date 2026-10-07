# 配信基盤の制限と料金（Cloudflare Pages / R2 / GitHub）

- 取得日: 2026-10-07
- 出典: `https://developers.cloudflare.com/pages/platform/limits/`, `https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits`, `https://docs.github.com/en/billing/concepts/product-billing/git-lfs`, `https://developers.cloudflare.com/r2/pricing/`, `https://developers.cloudflare.com/r2/buckets/public-buckets/`
- 関連: `../decisions/0001-overall-architecture.md`

料金と制限は変わる。**この doc の数値は上記の取得日時点のもの**。判断を変える前に出典を引き直す。

## 製品の役割分担

| | Pages | R2 |
|---|---|---|
| 何か | 静的サイトのホスティング + git 連携の自動ビルド | オブジェクトストレージ（S3 互換） |
| 置くもの | ビルド成果物（HTML / CSS / JS） | ビルドに含めたくないファイル（mp4 / webm / 大きい画像） |
| 更新 | git push → 自動ビルド → デプロイ | wrangler / S3 API で put |
| 境界 | **git に入れるもの** | **git に入れないもの** |

## Pages（無料プラン）

| 項目 | 無料 | 有料 |
|---|---|---|
| 1 サイトのファイル数 | **20,000** | 100,000（`PAGES_WRANGLER_MAJOR_VERSION=4` が必要） |
| 1 ファイルの最大サイズ | 25 MiB | 25 MiB |
| ビルド回数 | **500/月** | 5,000〜20,000/月 |
| 同時ビルド | 1（**アカウント単位**） | 5〜20 |
| ビルドタイムアウト | 20 分 | 20 分 |
| プレビューデプロイ | 無制限 | 無制限 |
| custom domain | 100/project | 250〜500 |
| project 数 | 100/アカウント | 100/アカウント |
| `_headers` | 100 ルール、1 ヘッダ 2,000 文字 | 同 |
| `_redirects` | 静的 2,000 + 動的 100 | 同 |
| 静的アセットの帯域・リクエスト数 | **ドキュメントに制限の記載なし** | — |

Functions（SSR）は Workers のクォータを消費するが、このプロジェクトは静的出力なので関与しない。

## R2

| 項目 | 無料枠（Standard のみ） | 超過分 |
|---|---|---|
| ストレージ | **10 GB-月** | $0.015/GB-月 |
| Class A（put / list などの書き込み系） | **100 万/月** | $4.50/100 万 |
| Class B（get などの読み出し系） | **1,000 万/月** | $0.36/100 万 |
| egress（転送量） | **無料・上限なし** | $0 |

`r2.dev` の公開 URL は**レートリミットがあり本番利用は非推奨**、キャッシュ・WAF・Bot 管理も効かない。
CNAME を `r2.dev` に向けるのは非サポート。**必ず custom domain を張る**（`media.takumifukasawa.com`）。

## このプロジェクトでの見積り（sketch 500 件時点）

| 項目 | 見積り | 無料枠に対して |
|---|---|---|
| R2 ストレージ | 500 ×（poster 150KB + mp4 5MB）≈ **2.6 GB**（1080p60 / 10 秒、mp4 のみ。`../spec/publish-pipeline.md`） | 10 GB の 26%。2 年通して無料枠内 |
| R2 Class A | 2 年で put 1,500 回 | 無視できる |
| R2 Class B | `/lab/` 1 表示で poster 24 枚 → **月 41 万 PV 相当**まで無料枠内 | 十分 |
| Pages ファイル数 | HTML 600 + JS/CSS で数千 | 20,000 の天井に対して余裕 |
| Pages ビルド | 1 日 2 push × 2 project × 30 日 = 120/月 | 500/月 に対して余裕 |

**最初に当たる天井は Pages のファイル数 20,000。** これは件数ではなくページ生成の設計で決まる
（1 件ごとに OG 画像を静的生成し始めると件数 × 2 になる）。動的 OGP を入れるときにここを再計算する。

アクセス数が伸びて壊れる箇所・請求が跳ねる箇所は無い。Pages の静的配信は帯域制限の記載が無く、
R2 は egress が構造的に $0。ストレージが 100 GB まで膨らんでも月 $1.5。

## GitHub Pages（比較対象）

出典: `https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits`（2026-10-07 取得）

| 項目 | 値 |
|---|---|
| 公開サイトの容量 | **1 GB** |
| 帯域 | **100 GB/月（ソフト上限）** |
| ビルド | **10/時（ソフト上限）** |
| サイト数 | 1 アカウント 1 ユーザーサイト + 1 repo 1 project サイト |
| `_headers` / `_redirects` 相当 | **無い**（Cache-Control / CSP / リダイレクトを設定できない） |
| PR プレビュー | 無い |
| 禁止用途 | 商用ビジネス / EC の運営、SaaS の提供、パスワードやカード番号などの機密データの処理 |

Cloudflare Pages との差で効くのは帯域。`lab` 側の Three.js バンドルが 1 MB なら **10 万回で 100 GB** に達し、
超えると警告 → throttle されるため、**バズった時に「止まる側」に倒れる**。
また R2 の custom domain は同じ Cloudflare アカウントのゾーンにしか張れないので、
R2 を使う時点で Cloudflare DNS が前提になる（= Pages を使わない積極的な理由が残らない）。
→ 決定 `../decisions/0001-overall-architecture.md` の落選案 E。

## 「R2 を使わない」選択肢との比較

R2 は追加コストではなく、**repo を軽く保つための無料の置き場**。使わない構成のほうが先に課金されるか品質が落ちる。

| 案 | 配信コスト | 詰まる場所 |
|---|---|---|
| **R2（採用）** | -e（egress 無料） | 無料枠内。実際に効くのは Class B のみで、1 件に月 41 万 PV 相当まで持つ |
| メディアをサイト repo に入れて Pages で配る | -e | repo が 2.6 GB（clone・ビルドが毎回運ぶ）／git 履歴は消せない／Pages の 1 ファイル 25 MiB 上限で 1〜2 分の動画が入らない／20,000 ファイル上限を 3 倍速く消費 |
| 同上 + Git LFS | -e | **GitHub Free の LFS 無料枠はストレージ 10 GiB / 帯域 10 GiB/月**（`https://docs.github.com/en/billing/concepts/product-billing/git-lfs`、2026-10-07 取得）。Pages はビルドごとに repo を clone するので帯域が先に尽きる（2.6 GB × 月 120 ビルド = 312 GiB） |
| YouTube / Vimeo | -e | 埋め込みが重い／UI が自分のものにならない／関連動画に他人の作品が並ぶ／ループが汚い。ポートフォリオとしてのコントロールを失う |
| Cloudflare Stream | 有料（保存 + 配信） | 8 秒のループには過剰 |

### 課金が始まる順番

| 順 | 何 | いつ | いくら |
|---|---|---|---|
| 1 | R2 ストレージ 10 GB 超 | 2 年目後半、動画を長く・高画質にしたら | 20 GB で月 -e.30 |
| 2 | Pages ビルド 500/月 超 | 1 日 16 push 以上 | Workers Paid /月 |
| 3 | R2 Class B 1,000 万/月 超 | 1 件に月 41 万 PV | 100 万あたり -e.36 |

どれも超えても数ドル。egress は構造的に -e のまま。

## 未確認事項

- **キャッシュヒットが R2 の Class B にカウントされるか**は公式ドキュメントに明記が無い。
  custom domain 経由では Cloudflare Cache が効くので、`immutable` を付ける設計ならほぼキャッシュヒットになり
  課金上はさらに軽くなる見込みだが、断定できない。→ 運用開始後に Dashboard の実測で確認し、この doc を更新する。
- **無料プランの利用規約で CDN 経由の動画大量配信が制限されるか**。R2 は egress 無料の object storage として
  提供されている製品なので、動画を Pages の静的アセットではなく R2 に置くのは規約面でも素直と考えているが、
  規約本文は未確認。→ 動画の配信量が増える前に Self-Serve Subscription Agreement を確認する。
