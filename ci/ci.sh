#!/bin/sh
export RUN_ID=$(node generate-id.js)
echo "Run id: $RUN_ID"
npm run launch:services
npm run test:ci
