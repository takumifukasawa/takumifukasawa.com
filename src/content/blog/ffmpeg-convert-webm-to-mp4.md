---
title: "【ffmpeg】ディレクトリ内の複数webmファイルを一括でmp4に変換"
date: 2021-09-04T14:15:45+09:00
tags: ["ffmpeg"]
---

`$ for i in *.webm; do ffmpeg -i "$i" "${i%.*}.mp4"; done`

を叩くことで一括変換できます。

もし `mov` にしたい場合は `mp4` を `mov` に変更すればフォーマットが `mov` になります。
