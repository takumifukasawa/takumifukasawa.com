---
title: "YoutubeのIFrame Playerでcontrolsをオフにすると自動再生がされない"
date: 2020-07-01T19:18:45+09:00
tags: ["Javascript", "検証"]
---

## 追記（2020/07/05）

解決法を発見しました。

**onPlayerReadyで`setVolume(0)`か`mute()`を呼んで明示的に音声をオフにしてからplayVideoを呼ぶ**と自動再生されました。

↓ 検証コードはこちらになります

<div class="embed" data-embed-src="https://codepen.io/takumifukasawa/embed/mdVqZzR?default-tab=js%2Cresult&amp;theme-id=dark" style="height: 300px"><button type="button" aria-label="Youtube: Original UI Test を読み込む">▶</button><a href="https://codepen.io/takumifukasawa/pen/mdVqZzR" target="_blank" rel="noopener">Youtube: Original UI Test</a></div>

ただ、自動再生後に音量をスライダーなどで変えてsetVolumeを呼ぶと再生が停止されてしまいます。

どうやら自動再生時にオリジナルのUIによる動作を完全に制御するには、iframe内の要素を一度はクリックする必要があるようです。

## 元内容

javascriptでのYoutubeのIFrame Player API埋め込みを使って、 独自UIによるYoutube Iframeの制御の挙動を調査していたときに発見しました。

APIを使った埋め込みとiframeのembedのどちらも試した結果同じ挙動になっていたので、おそらくバグではなくYoutubeの仕様と思われます。

↓ 検証コードはこちらになります

<div class="embed" data-embed-src="https://codepen.io/takumifukasawa/embed/OJMOOgm?default-tab=js%2Cresult&amp;theme-id=dark" style="height: 300px"><button type="button" aria-label="Youtube: autoplay param is not working when disable controls. を読み込む">▶</button><a href="https://codepen.io/takumifukasawa/pen/OJMOOgm" target="_blank" rel="noopener">Youtube: autoplay param is not working when disable controls.</a></div>

## controls オプション

controlsを0にするとYoutubeのUIを非表示にすることが可能なのですが、 その場合にautoplayを1にしても自動再生が効かなくなるようです。

controlsのオプションはこのような仕様になっており、特に自動再生との兼ね合いは書いてありませんでした。

```
動画プレーヤーのコントロールを表示するかどうかを指定します。
controls=0 – プレーヤー コントロールを表示しません。
controls=1（デフォルト）– プレーヤー コントロールを表示します。
```

[YouTube 埋め込みプレーヤーとプレーヤーのパラメータ  |  YouTube IFrame Player API](https://developers.google.com/youtube/player_parameters?hl=ja)

また、APIで埋め込んだiframeは**最初に手動で動画をクリックして再生するまではplayVideoメソッドが効かない**という挙動もありました。

そのため、**独自UIと自動再生の両立が難しそう**です。

YoutubeのAPIを触るのは3年ぶりぐらいだったのですが、 もともとできないようになっていたのか、いつからか出来ないようになったのかまではわかりませんでした。
