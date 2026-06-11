#!/usr/bin/env bash
# Submit all sitemap URLs to IndexNow (Bing, Yandex, Naver, etc.)
# Usage: ./indexnow-submit.sh        (submits every URL in sitemap.xml)
set -euo pipefail
HOST="nosh7.in"
KEY="9d861722dd3c9d64dd74b588ba61d096"
KEY_LOCATION="https://${HOST}/${KEY}.txt"

# Pull URLs from the live sitemap
URLS=$(curl -s "https://${HOST}/sitemap.xml" | grep -oE '<loc>[^<]+' | sed 's/<loc>//')
# Build JSON array
JSON_URLS=$(printf '%s\n' $URLS | sed 's/.*/"&"/' | paste -sd, -)

curl -sS -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"${KEY_LOCATION}\",\"urlList\":[${JSON_URLS}]}" \
  -w "\nHTTP %{http_code}\n"
