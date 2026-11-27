---
title: "【React】timeout を管理する様々な custom hooks"
date: 2020-11-05T10:22:25+09:00
tags: ["React"]
---

ここ3ヶ月ぐらいはずっと Nextjs SSR x typescript なフロントエンド開発を行っていました。

hooksが導入されてからのReactは初めてでしたが、hooksはロジックを分離するのにとてもいい方法だと感じました。

Reactのデザインパターンは、コンポーネントをどれぐらいの粒度で細分化させるか（Atomic Designなど）や、ロジックとview部分をどう分けるかが議論のポイントだったように思っていたのですが、hooksの登場によりcomponentが直接hooksを参照する形でロジックを利用することができるようになったので、後者に関しては解決される部分が大きいのかなと思いました。

ロジックを小さい単位で切り出すことができていれば他のプロジェクトでもそのまま使うことができ、レシピ集的に使うことのできる点は嬉しいです。

### useTimeout.ts

timeoutを管理するだけのロジックも、一度切り出してしまえばcomponent間で使い回すことができます。同一componentでも複数呼び出すことができます。

```typescript
import { useEffect, useRef } from "react";

/**
 * manage window timeout hooks
 *
 * ex)
 *
 * const [beginTimer, clearTimer] = useTimeout(() => { ... }, ms);
 *
 * useEffect(() => {
 *   beginTimer();
 * }, [deps1]);
 *
 * useEffect(() => {
 *   clearTimer();
 * }, [deps2]);
 *
 * @export
 * @param {() => void | null} exec
 * @param {number} ms
 * @returns
 */
export default function useTimeout(
  exec: (() => void) | null,
  ms: number
): [() => void, () => void] {
  const timerId = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerId.current) {
      window.clearTimeout(timerId.current);
      timerId.current = null;
    }
  };

  const beginTimer = () => {
    clearTimer();
    timerId.current = window.setTimeout(() => {
      if (exec) {
        exec();
      }
      clearTimer();
    }, ms);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  return [beginTimer, clearTimer];
}
```

[https://gist.github.com/takumifukasawa/3785ae0f80845f76eb9664b45784e28b](https://gist.github.com/takumifukasawa/3785ae0f80845f76eb9664b45784e28b)

### useKeepAliveTimer.ts

とあるhooksにさらに機能を持たせたい場合、そのhooksを拡張するのではなく、hooksを呼び出すhooksを作ることで機能拡張ができるのも良いなと思いました。

例えば「一定時間フラグを立たせておく」ロジックを実現したい場合は、前述のuseTimeout.tsを呼び出すhooksを作ることで実現できます。

```typescript
import { forEach } from "lodash";
import { DependencyList, useEffect, useState } from "react";
import useTimeout from "./useTimeout";

/**
 * 一定時間trueなflagを保持するhooks
 *
 * - activeを呼ぶとflagを立て直す
 * - depsは何かしらの値が入っている場合はflagを立てる、とみなす
 *   - 例えばhoverのstateを入れた場合、hoverしたらflagは一定時間trueになる
 *
 * @export
 * @param {number} ms
 * @param {DependencyList} [deps=[]]
 * @returns {[boolean, () => void]}
 */
export default function useKeepAliveTimer(
  ms: number,
  deps: DependencyList = []
): [boolean, () => void] {
  const [flag, setFlag] = useState<boolean>(false);

  const [beginTimer] = useTimeout(() => {
    setFlag(false);
  }, ms);

  const active = () => {
    setFlag(true);
    beginTimer();
  };

  useEffect(() => {
    if (deps.length < 1) {
      return;
    }
    // 何かしらのdepsが存在していたらflagを立てる
    forEach(deps, (dep) => {
      if (dep) {
        active();
      }
    });
  }, deps);

  return [flag, active];
}
```

[https://gist.github.com/takumifukasawa/40772ef1e29c9a80c7028dfd8e715cdb](https://gist.github.com/takumifukasawa/40772ef1e29c9a80c7028dfd8e715cdb)
