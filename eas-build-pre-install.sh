#!/bin/bash
mkdir -p dist/client
touch dist/client/index.html
npm install
npm run build
npx cap add ios
npx cap sync ios