#!/bin/sh
npm run test:ci > /dev/null
curl -X POST \
  -H "Content-Type: application/json" \
  -d @discord_results-summary.json $DISCORD_WEBHOOK_URL
