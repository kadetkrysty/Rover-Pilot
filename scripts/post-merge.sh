#!/usr/bin/env bash
set -Eeuo pipefail

npm ci --no-audit --no-fund
npm run build
