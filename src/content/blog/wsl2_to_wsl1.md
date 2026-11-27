---
title: "WSL2をWSL1に変更する"
date: 2023-11-17T00:00:00+09:00
tags: ["Windows", "WSL"]
---

## きっかけ

WSL2でviteを使って開発していたのですが、しばらく立ち上げているとHMRが応答せずWSLを落とさなければならない、ということが頻発していました。

開発環境としては、

-   ファイルそのものはWindowsOS側で管理
-   エディターはVSCodeやRiderなどWindowsOS側のアプリケーション
-   しかし、vite自体はWSLで動作させたい

という状態です。つまり、WindowsOS側とWSLでファイルを相互に見合っていました。

改めて調べてみると「ファイルを相互に見合う状態」はWSL1を使った方がよいというユースケースに当てはまりそうなため、WSL1に戻すことを試してみました。

[WSL バージョンの比較](https://learn.microsoft.com/ja-jp/windows/wsl/compare-versions)

## WSL2からWSL1にバージョンを落とす

まずWSLのバージョンを確認します。

```
$ wsl -l -v

NAME            STATE           VERSION
* Ubuntu-22.04    Running         2
```

WSL2になっていますね。

WSLのデフォルトバージョンと、変更したいディストリビューションをそれぞれ WSL1 にします。

```
$ wsl --set-default-version 1
$ wsl --set-version [ubuntu_name] 1
=> 自分の環境では $ wsl --set-version Ubuntu-22.04 1
```

再起動します。

```
$ wsl
```

本来はこの時点で無事WSL1になった状態で立ち上がるようですが、自分の場合は以下のエラーが出てうまくいきませんでした。

```
<3>WSL (11) ERROR: CreateProcessEntryCommon:577: execvpe /home/linuxbrew/.linuxbrew/bin/zsh failed 14
```

どうやらzshが影響していそうです。

ということでWSL2に戻してから shell を bash にし、改めてWSL1に変更します。

```
...

先ほどのWSL1にした手順と同様にバージョンを2にする

...

$ sudo chsh $USER -s $(which bash)

...

先ほどのWSL1に変更する手順をもう一度実行

...

$ wsl
```

これで無事起動しました。

ただ、WSL1になった状態でshellをzshに変更するとまた同様のエラーが出たので、bashのままにしています。

* * *

WindowsにおけるWebフロントエンド開発は「ファイルをWindowsOSとWSLで相互に見合う」状態になることは珍しくないと思うので、WSL2においてファイルシステム管理の問題が残り続ける限りはWSL1のままにしておくのが安全そうです。
