# tech-debt — 既知の負債

<!-- 負債は高金利のローン。溜めて一括返済するより、小さく継続的に返す。
     `harness gc` はここに載っている項目の放置日数を報告する。返済したら行を消さず「返済済 (コミット)」にする。 -->

| # | 内容 | 影響範囲 | 起票日 | 状態 |
|---|---|---|---|---|
| 1 | `workers.dev` の本番 URL が塞がれていない。`takumifukasawa-com.takumifukasawa.workers.dev` が `takumifukasawa.com` と同じ中身を返す | 検索エンジンに重複 URL として拾われうる。いまはサイトが 404 なので実害は無い | 2026-10-11 | 未着手。`wrangler.jsonc` に `"workers_dev": false` を足す。ただし**PR のプレビュー URL が workers.dev のサブドメインを使う**ので、`"preview_urls": true` を同時に明示し、実際に PR を 1 本出してプレビューが生きていることを確かめてから入れる（確かめずに入れるとプレビューを失う）。**P1 で `/` に中身が載る前に返す** |
| 2 | `http://takumifukasawa.com/` が 200 を返す（HTTPS へリダイレクトされない） | 平文で配信される。`_shell.js` が混在コンテンツ扱いになる余地 | 2026-10-11 | 未着手。Cloudflare の zone 設定 **SSL/TLS → Edge Certificates → Always Use HTTPS** を on にするだけ（人間のダッシュボード作業） |
