---
title: "【typescript】ファイルの容量を元に適切なファイルサイズの数値と単位を返す関数"
date: 2020-11-06T19:00:00+09:00
tags: []
---

ファイルアップローダーを作成する際、ファイルサイズを表示する場合にデザイン的に以下のあたりに気を使うことが多いのかなと思っています。

-   ファイルの容量に応じて適切な単位に切り替える
-   小数点以下第何位まで表示するか

例えば約3MBのファイルをアップする際、3000KBのようにKB表記にしてしまうとわかりづらく、一方で表記をMB合わせにして約30KBのファイルをアップする場合、0.03MBと表記するとこちらもあまり直感的ではありません。

つまり、ファイルの容量に応じて自動で単位を切り替えるようになっているのが理想です。

macのfinderでは適切なファイルサイズがKBの場合は `166KB` と表記し、MBの場合は `1.6MB` のような表記になっています。つまり、単位によって表示する小数点以下の位が変わっています。

![](../../assets/blog/get-file-size-with-unit/20201106162205.png)

![](../../assets/blog/get-file-size-with-unit/20201106162218.png)

今後使い回すことのできるように、そのあたりを関数にまとめてみました。 作成した関数では小数点以下の位の数は統一するようにしていますが、macのfinderのように単位によって切り替える場合はこの関数の中身を調整してあげればよさそうです。

`const units = ["Byte", "KB", "MB", "GB"];` のように単位を列挙し、その数に応じて表記を調整しています。

GBまでの表記が必要なければ配列の中身をByte,KB,MBの3つにすると、どれだけファイル容量が大きくてもMB基準の表記となります。

```typescript
const units = ["Byte", "KB", "MB", "GB"];

/**
 * ファイルサイズに応じて、ファイル容量の数値と単位を取得
 * 多めに表示するためにceilしている
 *
 * @export
 * @param {number} size
 * @param {number} [floating=1]
 * @returns
 * @returns {([number, string] | [])}
 */
export default function getFileSizeWithUnit(
  size: number,
  floating: number = 1
): [number, string] | [] {
  for (let i = 0; i < units.length; i += 1) {
    if (size < 1024 ** (i + 1)) {
      const floatingBase = 10 ** floating;
      const num =
        Math.ceil((size * floatingBase) / Math.max(1, 1024 ** i)) /
        floatingBase;
      return [num, units[i]];
    }
  }
  console.error("[getFileSizeWithUnit]: too large file size");
  return [];
}
```

[https://gist.github.com/takumifukasawa/971668e0d36c20f1e78dc36a693f8de7](https://gist.github.com/takumifukasawa/971668e0d36c20f1e78dc36a693f8de7)
