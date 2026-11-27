---
title: "【Node.js】画像群を一括圧縮するスクリプト"
date: 2021-03-06T18:00:00+09:00
tags: ["Node.js"]
---

画像圧縮をする際、jpegminiやimagealphaなどのアプリを使ったりPCにインストールしたcli経由で行うことが多かったのですが、これらの方法だと画像圧縮の方法がプロジェクトの各人に依存してしまうという問題があります。 そこで、画像圧縮ツールもnpmで管理する形だと人に依存しない & スクリプトを使い回すことができるなと思ったので、nodeスクリプトを作成してみました。

ディレクトリ指定をするとそのディレクトリ以下を再帰的に、単一ファイル指定だとそのファイルのみを圧縮するようにしました。pngとjpgに対応しています。

圧縮には imagemin を用いました。ファイルにもよりますが、100近いファイルを圧縮したところ全体で3分の1ぐらいまでに減りました。

[imagemin/imagemin](https://github.com/imagemin/imagemin)

```javascript
// ------------------------------------------------------------------------------
//
// ディレクトリ以下の画像、もしくは単一ファイルを一括圧縮するバッチスクリプト
//
// usage:
// $ node minify-images.js [src_path]
//
// ------------------------------------------------------------------------------

const fs = require("fs");
const imagemin = require("imagemin");
const imageminJpegtran = require("imagemin-jpegtran");
const imageminPngquant = require("imagemin-pngquant");
const path = require("path");

if (!process.argv[2]) {
  console.error('command: "node minify-images.js [src_path]"');
  process.exit(1);
}

const srcPath = process.argv[2];

/**
 * base: https://gist.github.com/victorsollozzo/4134793
 * ファイルパスを再帰的に取得
 *
 * @param {*} base
 * @param {*} extensions
 * @param {*} files
 * @param {*} result
 * @returns
 */
function recursiveFindByExtensions(base, extensions, files, result) {
  const tmpFiles = files || fs.readdirSync(base);
  let tmpResult = result || [];

  tmpFiles.forEach(function (file) {
    const newBase = path.join(base, file);
    if (fs.statSync(newBase).isDirectory()) {
      tmpResult = recursiveFindByExtensions(
        newBase,
        extensions,
        fs.readdirSync(newBase),
        tmpResult
      );
      return;
    }

    for (let i = 0; i < extensions.length; i += 1) {
      const ext = extensions[i];
      if (file.substr(-1 * (ext.length + 1)) === `.${ext}`) {
        tmpResult.push(newBase);
        return;
      }
    }
  });
  return tmpResult;
}

/**
 * promiseを直列実行
 *
 * @param {*} arr
 * @returns
 */
function execPromiseInSequence(arr) {
  return arr.reduce((chained, func) => chained.then(func), Promise.resolve());
};

/**
 * 単一ファイルを圧縮する
 *
 */
async function compressImage(srcFile) {
  const destination = path.dirname(srcFile);
  console.log("----------------------------------------------------");
  console.log(`minify: ${srcFile}`);
  await imagemin([srcFile], {
    destination,
    plugins: [
      imageminJpegtran(),
      imageminPngquant({
        quality: [0.6, 0.8],
        speed: 1,
      }),
    ],
  });
  console.log("succeeded.");
}

/**
 * 実行関数
 *
 */
async function main() {
  const isDir = fs.lstatSync(path.join(process.cwd(), srcPath)).isDirectory();

  const srcFiles = isDir
    ? recursiveFindByExtensions(path.join(process.cwd(), srcPath), [
        "png",
        "jpg",
      ])
    : [srcPath];

  await execPromiseInSequence(
    srcFiles.map((srcFile) => async () => compressImage(srcFile))
  );
}

main();
```

[https://gist.github.com/takumifukasawa/4c502098c62317987798f4ba57583dbb](https://gist.github.com/takumifukasawa/4c502098c62317987798f4ba57583dbb)
