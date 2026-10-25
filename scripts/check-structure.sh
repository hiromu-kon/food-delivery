#!/bin/sh
status=0

# 「何であるか」を言わないディレクトリ名は置き場所が一意に決まらず、何でも入る箱になるため禁止する。
found=$(find apps packages -type d \( -name utils -o -name helpers -o -name common -o -name shared -o -name misc \) \
  -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.expo/*')
if [ -n "$found" ]; then
  echo "forbidden directory name found (utils/helpers/common/shared/misc):"
  echo "$found"
  status=1
fi

# API は apps/api に一本化する。Next.js の Route Handler に業務処理が分散するのを防ぐ。
if [ -d apps/web/src/app/api ]; then
  echo "Next.js Route Handler (apps/web/src/app/api) is not allowed. Add the endpoint to apps/api instead."
  status=1
fi

exit $status
