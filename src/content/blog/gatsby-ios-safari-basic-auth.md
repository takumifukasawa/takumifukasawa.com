---
title: "【GatsbyJS】Basic認証下でiOS safariからページを開くとリロードする度に認証を求められる場合の対処法"
date: 2020-06-06T20:10:33+09:00
tags: ["Javascript", "GatsbyJS", "iOS Safari"]
---

先日、GatsbyJSでサイトを構築していた際、Basic認証がかけられた開発環境用のサーバーにビルドしたファイル群を置くと、表題のようにページをロードする度にBasic認証の入力を求められてしまう現象が発生しました。iOS13 safariでは発生し、PC Chrome では発生しませんでした。Androidは不明です。

その時にあれこれ試行錯誤したのでメモとして残しておきます。

（対策を調べていても同じ現象が発生したひとは見当たらなかった & GatsbyJSをBasic認証下で開発する際に毎回同じ現象が起こるとは少し考えづらいので、環境次第の可能性がありそうです）

## 原因

**GatsbyJSで生成されたプリロード用のタグ（ページ情報のjsonを読み込んでる）がBasic認証に必ず引っかかる**ことがわかりました。GatsbyJSのビルドではhtmlに以下のようなタグが生成されています。

`<link rel="preload" as="fetch" href="~~~~~~~.json">`

具体的には `preaload` がBasic認証に引っかかっていました。

まずは対策を書いていきます。

## 対策

preloadそのものはあくまでもリソースの先読みに関するものでGatsbyJSの機能には影響しないと考えました。

そこで、**preloadをprefetchに変える or タグごと消す**のどちらかを行うと、この現象が起こらなくなりました。

ビルドするたびに手動で行うのは手間なので、書き換え用のnodeのスクリプトをGatsbyJSのビルドの後に自動的に実行するようにします。

↓ npm-scriptsでgatsbyのビルド後にスクリプトを実行します。

```json
...
  "build": gatsby build --prefix-paths && node replace-link-preload-props.js",
...
```

↓ replace-link-preload-props.js: 書き換え用のスクリプト。タグごと消して上書き保存する形になっています。

```javascript
const path = require("path")
const glob = require("glob")
const { map } = require("lodash")

// specify html files by magic path
const htmlFilePath = "public/**/*.html"

function readFile(path, encode = "utf-8") {
  return new Promise((resolve, reject) => {
    fs.readFile(path, encode, (err, data) => {
      if (err) reject()
      resolve(data)
    })
  })
}

function writeFile(fileName, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, data, err => {
      if (err) reject()
      resolve()
    })
  })
}

async function getFileList(pattern) {
  return new Promise((resolve, reject) => {
    glob(pattern, (err, res) => {
      if (err) reject(err)
      resolve(res)
    })
  })
}

async function replaceTag(fileName) {
  const content = await readFile(fileName)

  // pattern_1. replace preload to prefetch
  // const regex = /as=\"fetch\"\ rel=\"preload\"/g
  // const replacedContent = content.replace(regex, 'as="fetch" rel="prefetch"')

  // pattern_2. remove code
  const regex = /<link as=\"fetch\" rel=\"preload\" href=\".*\.json\" crossorigin=\"anonymous\"\/><link as=\"fetch\" rel=\"preload\" href=\".*\.json\" crossorigin=\"anonymous\"\/>/g
  const replacedContent = content.replace(regex, "")
  await writeFile(fileName, replacedContent)
}

async function main() {
  const htmlFiles = await getFileList(
    path.join(__dirname, htmlFilePath)
  )

  return Promise.all(
    _.map(htmlFiles, async fileName => {
      console.log(`replace tag: ${fileName}`)
      await replaceTag(fileName)
    })
  )
}

main()
```

[https://gist.github.com/takumifukasawa/a035112fdd16891608a4677b5c2f1201](https://gist.github.com/takumifukasawa/a035112fdd16891608a4677b5c2f1201)

## preload

preloadは今まで使ったことがなかったので調べたのですが、結局Basic認証に引っかかる理由はわからずでした・・・。

> `<link rel="preload">` を使用してフェッチされたリソースが 3 秒以内に現在のページで使用されない場合、Chrome デベロッパー ツールのコンソールに警告が表示されるので注意してください。

とのことで、実際、Basic認証が求められて3秒以上経つと警告が表示されていたので、少なくともBasic認証が求められたタイミングは、リソースの要求が行われた後のようです。

[rel="preload" によるコンテンツの先読み](https://developer.mozilla.org/ja/docs/Web/HTML/Preloading_content)

[リソースの優先度付け - ブラウザの有用性を高める  |  Web Fundamentals  |  Google Developers](https://developers.google.com/web/fundamentals/performance/resource-prioritization?hl=ja)

[Preload](https://www.w3.org/TR/preload/)
