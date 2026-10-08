# decisions — 決定記録

1 決定 = 1 ファイル。`NNNN-kebab-title.md`。書き換えず、覆す時は新しい決定を足して旧決定に「superseded by NNNN」を書く。

| # | タイトル | 状態 | 日付 |
|---|---|---|---|
| [0001](0001-overall-architecture.md) | 全体構成 — 1 repo / 1 ドメイン / media は R2 | 草案 | 2026-10-08 |
| [0002](0002-naming-lab-sketch.md) | tier 1 の命名 — 場所は `lab`、1 件は `sketch` | 草案 | 2026-10-08 |
| [0003](0003-code-placement.md) | コードの置き場 — 既定は `lab` repo、独立 repo は条件つき昇格 | 草案 | 2026-10-08 |

## テンプレート

```markdown
# NNNN: タイトル

- 日付: YYYY-MM-DD
- 状態: 採用 / 廃止（superseded by NNNN）

## 背景
## 採用案
## 落選案と落選理由
## 影響・やり直す条件
```
