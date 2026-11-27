---
title: "WebWorkerではプライベートフィールドを渡すことができない"
date: 2021-12-22T21:40:13+09:00
tags: ["Javascript"]
---

ちょっとハマったのでメモです。

WebWorkerのpostMessageでデータを送るとき、渡すことのできるデータとそうでないデータがあります。

これは構造化複製アルゴリズムが適用されているからです。たとえばFunctionオブジェクトは送ることができません。

[構造化複製アルゴリズム - Web API | MDN](https://developer.mozilla.org/ja/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)

その中にプライベートフィールドも含まれていました。

chromeで以下のコードを実行すると Object で `{ hoge: "hogehoge" }` が出力されます。

```javascript
class Hoge {
  hoge;
  #fuga;
  constructor(hoge, fuga) {
    this.hoge = hoge;
    this.#fuga = fuga;
  }
  echo() {
    console.log(this.hoge);
    console.log(this.#fuga);
  }
}

const hoge = new Hoge("hogehoge", "fugafuga");

const worker = new Worker(URL.createObjectURL(new Blob([`
self.onmessage = (e) => {
  console.log(e.data[0]); // Object { hoge: "hogehoge" }
}
`])));

worker.postMessage([hoge]);
```
