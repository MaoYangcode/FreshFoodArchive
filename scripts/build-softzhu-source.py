#!/usr/bin/env python3
"""
软著源代码：前/后各一段，按「整文件」边界截取；文件之间不插入 //[src] 路径等标记行。
保留各源文件中的原有空行与缩进；不在段末人为补空行。
仅将 CRLF 规范为 \\n，避免排版异常。
已排除：Prisma、basket.service、ingredient-image、含 emoji 页、ai.service（大段）、store、
菜谱相关页与 home 等；其余在 FILE_ORDER 中尽量多收录以抬高总行数。
"""
from __future__ import annotations

import os
import sys

# 选取整文件时的下限（行数按原文含空行计）；约 30 页 × 50 行
TARGET_LINES = 1500

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "软著材料")
OUT_FRONT = os.path.join(OUT_DIR, "源代码-前30页-整文件边界.txt")
OUT_BACK = os.path.join(OUT_DIR, "源代码-后30页-整文件边界.txt")

FILE_ORDER: list[str] = [
    "server/src/main.ts",
    "server/src/app.module.ts",
    "server/src/app.controller.ts",
    "server/src/app.service.ts",
    "server/src/common/user-context.ts",
    "server/src/ingredients/ingredients.module.ts",
    "server/src/ingredients/ingredients.controller.ts",
    "server/src/ingredients/ingredients.service.ts",
    "server/src/shelf-life/shelf-life.module.ts",
    "server/src/shelf-life/shelf-life.controller.ts",
    "server/src/shelf-life/shelf-life.service.ts",
    "server/src/basket/basket.module.ts",
    "server/src/basket/basket.controller.ts",
    "server/src/profile/profile.module.ts",
    "server/src/profile/profile.controller.ts",
    "server/src/profile/profile.service.ts",
    "server/src/expiry-reminder/expiry-reminder.module.ts",
    "server/src/expiry-reminder/expiry-reminder.controller.ts",
    "server/src/expiry-reminder/expiry-reminder.service.ts",
    "main.js",
    "App.vue",
    "pages.json",
    "api/request.js",
    "api/modules/ai.js",
    "api/modules/basket.js",
    "api/modules/ingredients.js",
    "api/modules/recipes.js",
    "api/modules/shelf-life.js",
    "api/modules/profile.js",
    "api/modules/expiry-reminder.js",
    "utils/current-user.js",
    "utils/shelf-life.js",
    "utils/category-options.js",
    "utils/smart-purchase.js",
    "components/bottom-nav.vue",
    "components/fridge-view-controls.vue",
    "components/ingredient-icon.vue",
    "components/location-icon.vue",
    "pages/fridge/shelf-life.vue",
    "pages/profile/index.vue",
    "pages/profile/expiry-reminder.vue",
    "pages/profile/takeout-records.vue",
    "pages/profile/profile.vue",
]


def block_for(rel: str) -> str:
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        body = f.read()
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    if body and not body.endswith("\n"):
        body += "\n"
    # 不插入 //[src] 路径 等标记行，与仓库源码一致，仅顺序拼接
    return body


def line_count(s: str) -> int:
    if not s:
        return 0
    return s.count("\n") + (0 if s.endswith("\n") else 1)


def main() -> int:
    blocks = [block_for(rel) for rel in FILE_ORDER]
    counts = [line_count(b) for b in blocks]
    total = sum(counts)
    if total < 2 * TARGET_LINES + 1:
        print(
            f"错误：合并全文仅 {total} 行，无法在不重叠情况下各取整文件 ≥{TARGET_LINES} 行。请增加 FILE_ORDER。",
            file=sys.stderr,
        )
        return 1

    s = 0
    i = 0
    while i < len(blocks) and s < TARGET_LINES:
        s += counts[i]
        i += 1
    if s < TARGET_LINES:
        print("错误：从前向后累加整文件仍不足目标行数。", file=sys.stderr)
        return 1
    front_end = i

    s = 0
    k = len(blocks) - 1
    while k >= 0 and s < TARGET_LINES:
        s += counts[k]
        k -= 1
    back_start = k + 1

    if back_start < front_end:
        print(
            "错误：按整文件选取时前段与后段重叠。\n"
            f"  前段 [0, {front_end}) 约 {sum(counts[:front_end])} 行\n"
            f"  后段 [{back_start}, {len(blocks)}) 约 {sum(counts[back_start:])} 行\n"
            "请增加 FILE_ORDER 或调整 TARGET_LINES。",
            file=sys.stderr,
        )
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    front_body = "".join(blocks[:front_end])
    back_body = "".join(blocks[back_start:])

    with open(OUT_FRONT, "w", encoding="utf-8") as f:
        f.write(front_body)
    with open(OUT_BACK, "w", encoding="utf-8") as f:
        f.write(back_body)

    lf = line_count(front_body)
    lb = line_count(back_body)
    mid = sum(counts[front_end:back_start])
    print("已生成（整文件边界、无 //[src] 路径标记；保留原文空行；段末不补空行）：")
    print(f"  - {OUT_FRONT}")
    print(f"  - {OUT_BACK}")
    print(f"前段 {lf} 行，后段 {lb} 行，中间未打印约 {mid} 行。")
    print("前段文件：")
    for rel in FILE_ORDER[:front_end]:
        print(f"  - {rel}")
    print("后段文件：")
    for rel in FILE_ORDER[back_start:]:
        print(f"  - {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
