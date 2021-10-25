#!/bin/sh
export RUN_ID=$(node generate-id.js)
echo "INFO: Run id: $RUN_ID"
echo "INFO: Sleep seconds set for services to start: ${SLEEP:=60}"  # defaults to 60 seconds

if [[ $NODE_ENV == "local_client-public" ]]; then
  $(node node_modules/@ceramicnetwork/cli/bin/ceramic daemon --verbose --log-to-files --network dev-unstable --ethereum-rpc https://rinkeby.infura.io/v3/b6685df41e1647c4be0046dfa62a020b) &
fi

if [[ $NODE_ENV == "local_node-private" ]]; then
  export IPFS_API_PORT=5011
  export CERAMIC_NETWORK='dev-unstable'
  export DEBUG='ipfs*error'
  $(node node_modules/@ceramicnetwork/ipfs-daemon/bin/ipfs-daemon) &
fi

echo "INFO: Sleeping for ${SLEEP}s"
sleep ${SLEEP} # Give time for services to finish starting up before starting tests

npm run test:ci

exit_code=$?;
node export-logs.js
if [[ $exit_code != 0 ]]; then node report-exit.js; fi
