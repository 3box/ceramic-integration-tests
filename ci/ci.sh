#!/bin/sh
export RUN_ID=$(node generate-id.js)
echo "Run id: $RUN_ID"
npm run launch:services
sleep 5 # Give time for services to finish starting up before starting tests
npm run test:ci
exit_code=$?;
node export-logs.js
if [[ $exit_code != 0 ]]; then node report-exit.js; fi
