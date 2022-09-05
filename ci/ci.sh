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
  # init config and generate peer id 
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs init

  # config changes to match js-ceramic/ipfs-daemon
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"GET\", \"POST\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers "[\"Authorization\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers "[\"Location\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials "[\"true\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json Addresses.Swarm "[\"/ip4/0.0.0.0/tcp/4011\", \"/ip4/0.0.0.0/tcp/4012/ws\"]"
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config Addresses.API /ip4/0.0.0.0/tcp/5011
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config Routing.Type dhtclient
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs config --json Bootstrap "[]"

  # start the daemon
  node_modules/@ceramicnetwork/ipfs-daemon/node_modules/go-ipfs/go-ipfs/ipfs daemon --enable-pubsub-experiment &
fi

echo "INFO: Sleeping for ${SLEEP}s"
sleep ${SLEEP} # Give time for services to finish starting up before starting tests

npm run test:ci

exit_code=$?;
node export-logs.js
if [[ $exit_code != 0 ]]; then node report-exit.js; fi
