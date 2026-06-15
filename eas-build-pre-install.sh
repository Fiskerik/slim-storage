#!/usr/bin/env bash

echo "=== EAS Pre-Install Hook ==="
echo "Native TrimSwipe build: no WebView/static-server pre-install steps required."
set -e
echo "=== Building mobile web bundle ==="
npm install
npm run build:mobile-spa