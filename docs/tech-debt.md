# tech-debt — 既知の負債

<!-- 負債は高金利のローン。溜めて一括返済するより、小さく継続的に返す。
     `harness gc` はここに載っている項目の放置日数を報告する。返済したら行を消さず「返済済 (コミット)」にする。 -->

| # | 内容 | 影響範囲 | 起票日 | 状態 |
|---|---|---|---|---|
| 1 | `workers.dev` の本番 URL が塞がれていない。`takumifukasawa-com.takumifukasawa.workers.dev` が `takumifukasawa.com` と同じ中身を返す | 検索エンジンに重複 URL として拾われうる | 2026-10-11 | **返済済（2026-10-11、PR #1 / `a444ac2`）**。`wrangler.jsonc` に `"workers_dev": false` + `"preview_urls": true`。PR #1 自体で「プレビュー URL が生きたまま本番 URL だけ塞がる」ことを実機確認した（本番 workers.dev は Cloudflare の error 1042 を返すようになった）。詳細は `spec/site-v0.md` の「プレビュー URL」 |
| 2 | `http://takumifukasawa.com/` が 200 を返す（HTTPS へリダイレクトされない） | 平文で配信される。`_shell.js` が混在コンテンツ扱いになる余地 | 2026-10-11 | **返済済（2026-10-11）**。zone 設定 **SSL/TLS → Edge Certificates → Always Use HTTPS** を on。`http://.../_shell.js` が 301 → https で 200 になることを確認。**git に残らない設定**なので、ゾーンを作り直したら再設定が要る |
| 3 | 作品のビルド（terser の `drop_console: true`）が three 内部の `console.error` まで消すので、`artifacts run` がシェーダーのコンパイル失敗を検知できない（`learnings.md` 2026-10-15） | 全作品。壊れたシェーダーが検査を素通りして公開されうる | 2026-10-15 | 未着手。案: `drop_console` をやめ `pure_funcs: ['console.log', 'console.info', 'console.debug']` にして error / warn を残す（雛形 `scripts/templates/sketch/vite.config.ts` と既存作品。`docs/coding.md` の「公開版では console.* が消える」も直す）。成果物が変わるので `lab:rebuild --all` の扱いと合わせて人間が判断する |
| 4 | `lab build in sync` のハッシュ（`scripts/lib/lab.ts` の `sourceHash`）は `lab/<slug>/` の中しか見ない。`lab/core/` を import する作品は、core を変えても検査が再ビルドを求めない | `lab/core/` を使う作品（4 件目以降）。公開済みの成果物はもともと固定なので実害は「core を変えたら使っている作品を自分で `lab:build` し直す」を忘れること | 2026-10-17 | 未着手。core を使う作品が出て、core を実際に変えたときに考える（core を import している作品だけ core のファイルもハッシュに入れる、など） |
