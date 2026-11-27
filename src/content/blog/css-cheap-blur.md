---
title: "【CSS】filterやcanvasを使わずにテキストにぼかし処理をかけたように見せる"
date: 2020-02-29T10:00:00+09:00
tags: ["CSS", "HTML"]
---

動的にテキストにぼかし（ブラー）をかける場合、cssのfilterプロパティを使ったり、Context2DやWebGLで画像処理的にブラーをかける方法が考えられます。

[filter](https://developer.mozilla.org/ja/docs/Web/CSS/filter)

今回は、それ以外の方法であたかもブラー処理を施しているかのように見せる手法を考えてみました。

<strong>text-shadowとcolorのみを操作します。</strong>

こちらがデモになります。

<div class="embed" data-embed-src="https://codepen.io/takumifukasawa/embed/rPWjrv?default-tab=html%2Cresult&amp;theme-id=dark" style="height: 304px"><button type="button" aria-label="Easy Text Blur を読み込む">▶</button><a href="https://codepen.io/takumifukasawa/pen/rPWjrv" target="_blank" rel="noopener">Easy Text Blur</a></div>

text-shadowは`横のオフセット`,`縦のオフセット`,`ぼかしのサイズ`,`色`の4つの値を指定することができます。

colorをtransparentにしてベタ塗りをなくし、text-shadowで縦横のオフセットを0にし中心を基準に影を広げることがポイントです。

```css
p {
  font-size: 18px;
  line-height: 1.6em;
  letter-spacing: 0.07em;
  color: transparent;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
}
```

[text-shadow](https://developer.mozilla.org/ja/docs/Web/CSS/text-shadow)

## 余談

text-shadowのブラー処理のロジックが気になったので調べてみました。

W3Cのドラフトにはこう書かれていました。

[https://drafts.csswg.org/css-text-decor-3/#propdef-text-shadow](https://drafts.csswg.org/css-text-decor-3/#propdef-text-shadow)

```
This property accepts a comma-separated list of shadow effects to be applied to the text of the element. Values are interpreted as for box-shadow [CSS-BACKGROUNDS-3]. (But note that spread values and the inset keyword are not allowed.) 
```

つまり、text-shadowの要素はbox-shadowとして解釈されるようです。

* * *

続いてbox-shadowの項目を見てみます。

[https://www.w3.org/TR/css-backgrounds-3/#propdef-box-shadow](https://www.w3.org/TR/css-backgrounds-3/#propdef-box-shadow)

box-shadowのblurについて説明しているshadow-blurの項目にはこう書かれていました。

[https://www.w3.org/TR/css-backgrounds-3/#shadow-blur](https://www.w3.org/TR/css-backgrounds-3/#shadow-blur)

```
Note this means for a long, straight shadow edge, the blur radius will create a visibly apparent color transition approximately the twice length of the blur radius that is perpendicular to and centered on the shadow’s edge, and that ranges from almost the full shadow color at the endpoint inside the shadow to almost fully transparent at the endpoint outside it.
```

ロジックを理解できたわけではないのですが、どうやらいわゆるカーネルを用いた画像処理的な方法ではなく、独自の複雑な処理を施しているのでしょうか。

もし詳しい方がいらしたらぜひご教授いただきたいです。
