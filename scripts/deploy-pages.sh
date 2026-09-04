#!/usr/bin/env bash
# Deploy ArkNexus frontend to Cloudflare Pages.
#
# Prerequisites:
#   * npm install              (one-time)
#   * npm run build            (produces ./dist)
#   * npx wrangler login       (one-time, opens a browser)
#   * CLOUDFLARE_PAGES_PROJECT env var (default: "arknexus")
#
# Usage:
#   CLOUDFLARE_PAGES_PROJECT=arknexus \
#   VITE_API_BASE_URL=https://api.example.com/api/v1 \
#       ./scripts/deploy-pages.sh
#
# The script is idempotent — re-running it updates the existing Pages
# deployment.

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="${CLOUDFLARE_PAGES_PROJECT:-arknexus}"
API_BASE="${VITE_API_BASE_URL:-https://api.example.com/api/v1}"

echo "==> Building frontend with VITE_API_BASE_URL=${API_BASE}"
VITE_API_BASE_URL="${API_BASE}" npm run build

echo "==> Deploying to Cloudflare Pages project '${PROJECT}'"
npx wrangler pages deploy dist \
    --project-name "${PROJECT}" \
    --commit-dirty=true \
    --branch main

cat <<'EOF'

✅ Deploy complete.

Next steps:
  1. Cloudflare Dashboard → Pages → ${PROJECT} → Custom domains: add arknexus.example.com
  2. Cloudflare Dashboard → Pages → ${PROJECT} → Settings → Environment variables:
       VITE_API_BASE_URL = ${API_BASE}
  3. DNS: ensure a CNAME for arknexus.example.com points to ${PROJECT}.pages.dev
  4. Cloudflare Dashboard → Zero Trust → Tunnels → arknexus:
       - Public hostname: api.example.com → service http://gateway:8080
       - Public hostname: smtp.example.com → service tcp://email-service:1025
EOF
