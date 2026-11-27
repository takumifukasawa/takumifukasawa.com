---
title: "【Javascript】Promiseを直列実行"
date: 2021-03-04T18:51:43+09:00
tags: ["Javascript"]
---

内容は短めですが、よく使うのでそのメモになります。

複雑なアニメーションなど、とあるPromiseがresolveになったら違うPromiseの状態の監視を始めたい場合が頻繁にあります。

thenで繋いでもよいのですが、Promiseが増えるごとにthenの記述も合わせて増えていくため少し冗長です。

そこで以下のような関数を用意し、Promiseを返す関数の配列をreduceして繋いであげることで、記述量を減らすようにしました。

rejectな場合への対応がいらない場合に、順番に実行していきたい時に多用しています。

```javascript
async function execPromiseInSequence (arr) {
  return arr.reduce(
    (chained, func) => chained.then(func),
    Promise.resolve()
  );
};

// ex
async function main() {
  // 上から順に実行される
  await execPromiseInSequence([
    async () => { ... },
    async () => { ... }
    ...
  ]);
}
```
