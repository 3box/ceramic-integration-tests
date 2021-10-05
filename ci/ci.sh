#!/bin/sh
export RUN_ID=$(node generate-id.js)
echo "Run id: $RUN_ID"

if [[ $NODE_ENV == "local_client-public" ]]; then
  $(node node_modules/@ceramicnetwork/cli/bin/ceramic daemon --verbose --log-to-files --network dev-unstable --ethereum-rpc https://rinkeby.infura.io/v3/b6685df41e1647c4be0046dfa62a020b) &
fi

if [[ $NODE_ENV == "local_node-private" ]]; then
  export IPFS_API_PORT=5011
  export CERAMIC_NETWORK='dev-unstable'
  export DEBUG='bitswap*'
  $(node node_modules/@ceramicnetwork/ipfs-daemon/bin/ipfs-daemon) &
fi

echo "Sleeping for 60s"
sleep 60 # Give time for services to finish starting up before starting tests

npm run test:ci

exit_code=$?;
node export-logs.js
if [[ $exit_code != 0 ]]; then node report-exit.js; fi
