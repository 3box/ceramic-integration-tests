# ceramic-integration-tests

## Building

```
npm install
npm run build
```

## Running tests

There are currently 3 different configurations that the tests can be run in, which correspond to the 3 json files in the `config/env` directory:

#### internal-external

`NODE_ENV=internal-external npm run test`

Tests against the two nodes (called 'internal' and 'external') running in our infra.  Requires no local nodes.

#### local_client-external

`NODE_ENV=local_client-external npm run test`

Tests integration between a local node and the 'external' node in our infra.
Before running tests a ceramic node connected to the dev-unstable network
must be running on the same machine. The tests communicate to the local node via an http-client.

#### local_node-internal

`NODE_ENV=local_node-internal npm run test`

Tests integration between a local node and the 'internal' node in our infra.
Before running tests an ipfs node must be running on the same machine.
The tests start an in-process ceramic node (connected over http to the local ipfs node).

Note that this is the only configuration that meaningfully runs the 'ceramic_state_store' test,
as it's the only configuration in which the test has the ability to restart the ceramic node.
Since the 'ceramic_state_store' test tests integration with S3, you also need to set the proper
environment variables for the S3 bucket configuration and access keys in order to run the
tests in the `local_node-internal` configuration.

## Docker

Tests can be run with Docker with the following commands:

```
docker build . -t ceramic-integration-tests
```

```
docker run \
  -e DISCORD_WEBHOOK_URL='<url>' \
  -e NODE_ENV='<name_of_config_file>' \
  -e AWS_ACCESS_KEY_ID='<only_if_using_s3_state_store>' \
  -e AWS_SECRET_ACCESS_KEY='<only_if_using_s3_state_store>' \
  ceramic-integration-tests
```
