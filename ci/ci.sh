#!/bin/sh
export RUN_ID=$(node generate-id.js)
echo "INFO: Run id: $RUN_ID"
echo "INFO: Sleep seconds set for services to start: ${SLEEP:=60}"  # defaults to 60 seconds

# DEBUGGING START  - REMOVE ME LATER

echo "INFO: Environment: ***********"
env
echo "******************************"
mkdir /app/root
mkdir /app/root/.ceramic
mkdir /app/root/.ceramic/logs

# DEBUGGING END

if [[ $NODE_ENV == "local_client-public" ]]; then
  $(node node_modules/@ceramicnetwork/cli/bin/ceramic daemon --verbose --log-to-files --network dev-unstable --anchor-service-api https://cas-qa.3boxlabs.com --ethereum-rpc https://goerli.infura.io/v3/b6685df41e1647c4be0046dfa62a020b) &
fi

if [[ $NODE_ENV == "local_node-private" ]]; then
  export IPFS_API_PORT=5011
  export CERAMIC_NETWORK='dev-unstable'
  export DEBUG='ipfs*error'
  $(node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs init)
  $(node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs daemon) &
fi

echo "INFO: Sleeping for ${SLEEP}s"
sleep ${SLEEP} # Give time for services to finish starting up before starting tests

npm run test:ci

exit_code=$?;
node export-logs.js
if [[ $exit_code != 0 ]]; then node report-exit.js; fi
