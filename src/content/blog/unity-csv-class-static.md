---
title: "【Unity】CSVを読み込むC#クラス"
date: 2020-03-17T22:24:47+09:00
tags: ["Unity", "CSV", "C#"]
---

CSVファイルを読み込んでパースするクラスを、MonoBehaviourではなくC#クラスとして欲しい場面があったので作成してみました。

まず、コードの全文はこちらです。

`Assets/Resources/` 以下に入っているCSVファイルを読み込みます。

例えば `Assets/Resources/test.csv` が

```csv
a, b, c, d
e, f, g, h
```

というデータになっている場合、 `CSVReader.getPath("test")` を呼ぶことで読み込むことができます。結果はこのようになります。

```
// 文字列の配列のリスト
[
  ["a", "b", "c", "d"],
  ["e", "f", "g", "h"]
]
```

string.Split 関数を呼ぶ時に `System.StringSplitOptions.RemoveEmptyEntries` を指定することで空白の文字列を削除していますが、こちらは扱いたいデータに応じて変えたり、引数で分割方法を指定できるようにするなどの使用方法も有りうると思います。
