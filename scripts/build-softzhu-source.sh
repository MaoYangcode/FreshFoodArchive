#!/usr/bin/env bash
# 软著源代码：前/后各约 30 页，按「整文件」边界截取（保证函数/类不被从中截断）。
# 实现见 build-softzhu-source.py（FILE_ORDER 与规则均在该文件中维护）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/build-softzhu-source.py"
