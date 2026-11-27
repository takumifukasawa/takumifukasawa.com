---
title: "【Rider】Windowsで.ideavimrcが読み込まれないとき"
date: 2022-08-11T22:15:32+09:00
tags: ["Rider", "Windows"]
---

おそらく特殊な状況だったと思うのですが、メモしておきます。

経緯としては、IdeaVimのアラート音を消したいためにideavimrcを編集していたのですが反映されない現象に出くわしていました。

* * *

RiderでVimのキーバインドを使う場合、IdeaVimを使うことになります。 設定は~/.ideavimrcに書くことで適用されます。

Windowsの場合は `C:Users/{username}/.ideavimrc` に置くことになります。 しかし、.ideavimrc に設定を書いても読み込まれることはありませんでした。

よくよく `C:Users/{username}/` を見てみると、.vimrcが存在していませんでした。

<strong>そこで、空の.vimrcを作成し.ideavimrcから読み込むようにすることで、設定が反映されました。</strong>

ファイルの中身は以下のようになりました。

* * *

.ideavimrc

```
﻿source ~/.vimrc
set visualbell
set noerrorbells
```

.vimrc は空
