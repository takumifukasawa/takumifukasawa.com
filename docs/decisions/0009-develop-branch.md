# 0009: `develop` で作り、`main` で出す

- 日付: 2026-10-13
- 状態: 採用
- 関連: `0001-overall-architecture.md`（push で deploy される）, `0007-no-sketch-numbering.md`, `../spec/publish-pipeline.md`

## 背景

これまで `main` 1 本だった。push すると Workers Builds が本番に出す（決定 0001）ので、
**作りかけを別の PC と共有するだけで本番が動く**。

当初はこれで困らないと判断していた。未公開の sketch は content collection にエントリが無いので
索引に出ず、URL を知っている人しか来ない。実際、制作中のものを外から確認する手段としてそのまま使っていた。

崩れたのは 2 点。

1. **複数の端末で作る**（`handoff.md` の「別の PC で再開するとき」）。共有ブランチは実需であって、
   「公開」とは別の目的。1 本しか無いと、同期のたびに公開が起きる
2. **制作中の確認は Tailscale とローカル Wi-Fi で足りている**。本番に出す必要がそもそも無かった

さらに、`wip` という制作中スラグの規約（`../spec/publish-pipeline.md`）には穴があった。
`pnpm lab:add` は `wip*` を拒否するが、**それは索引に載せることを止めるだけ**で、
`public/lab/wip/` は commit されて配信されるので `/lab/wip/` には到達できてしまう。

## 採用案: `develop` が作業ブランチ、`main` だけが deploy される

| | `develop` | `main` |
|---|---|---|
| 日々の commit / 端末間の同期 | **ここ** | しない |
| Cloudflare が配信する | されない | **される** |
| 確認の手段 | Tailscale / ローカル Wi-Fi / Branch Preview URL | 本番 URL |

**公開は `develop` を `main` にマージする行為**になる。`pnpm lab:add` は push まで自動なので、
`main` 以外から実行すると「成功したように見えて何も配信されていない」状態になる。
これは URL を開くまで気付けないので、**`lab:add` が `main` 以外では止まる**
（`PRODUCTION_BRANCH` / `scripts/lib/lab.ts`。拒否メッセージにマージ手順が入っている。`--dry-run` は通す）。

### 確認の手段は減らない

`develop` に push すると Workers Builds が **Branch Preview** を作る
（`develop-takumifukasawa-com.<subdomain>.workers.dev`。`../spec/site-v0.md`）。
ブランチ名で安定した URL なので、Tailscale が使えない場所からでも見られる。**本番には出ない。**

### 公開に手数が増えることについて

これは当初この案を退けた理由だった。いまは**それが正しい**と考える。公開は年に数百回の作業ではなく、
1 sketch につき 1 回で、しかも `lab:add` の実行とセットになる。
一方で端末間の同期は毎日起きる。**頻度の高い方を軽くするべき**で、順序が逆になっていた。

## 落選案と落選理由

| 案 | 落選理由 |
|---|---|
| `main` だけ（これまで） | 作りかけの同期と公開が同じ操作になる。未リンクだから実害が無い、は「索引に出ない」だけの話で、URL は実在してしまう |
| `public/lab/wip/` をコミットしない | `lab build in sync` 検査に `wip*` の例外が要る。検査に例外を足すのは、検査を弱める方向の変更なので避けたい（`../../AGENTS.md`） |
| 作業ブランチを sketch ごとに切る（feature branch） | 1 人で、端末間の同期が目的なら、常設の 1 本の方が軽い。PR を挟む相手もいない |
| `develop` も deploy して別ドメインに出す | ドメインと設定が増える。Branch Preview が同じことを設定ゼロでやる |

## 影響・やり直す条件

- `pnpm lab:add` は `main` 以外で止まる（`--dry-run` を除く）。`currentBranch()` / `PRODUCTION_BRANCH`
- `docs/handoff.md` の「別の PC で再開するとき」は `develop` を見るように直す
- **やり直す条件**: マージを忘れて「出したつもり」が続くなら、`lab:add` にマージまでやらせるか、
  この決定を捨てて `main` 1 本に戻す。手数を足した結果、公開そのものが止まるなら本末転倒
