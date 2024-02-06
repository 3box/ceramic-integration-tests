# ceramic-integration-tests

## Building

```
npm install
npm run build
```

## Running tests

There are currently 3 different configurations that the tests can be run in, which correspond to the 3 json files in the `config/env` directory:

#### private-public

`NODE_ENV=private-public npm run test`

Tests against the two nodes (called 'private' and 'public') running in our infra.  Requires no local nodes.

#### local_client-public

`NODE_ENV=local_client-public npm run test`

Tests integration between a local node and the 'public' node in our infra.
Before running tests a ceramic node connected to the dev-unstable network
must be running on the same machine. The tests communicate to the local node via an http-client.

#### local_node-private

`NODE_ENV=local_node-private npm run test`

Tests integration between a local node and the 'private' node in our infra.
Before running tests an ipfs node must be running on the same machine.
The tests start an in-process ceramic node (connected over http to the local ipfs node).

Note that this is the only configuration that meaningfully runs the 'ceramic_state_store' test,
as it's the only configuration in which the test has the ability to restart the ceramic node.
Since the 'ceramic_state_store' test tests integration with S3, you also need to set the proper
environment variables for the S3 bucket configuration and access keys in order to run the
tests in the `local_node-private` configuration.

### Docker Compose

Create a `.env` file with the requisite environment variables filled in:
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
CLOUDWATCH_LOG_BASE_URL=
DISCORD_WEBHOOK_URL_TEST_FAILURES=
DISCORD_WEBHOOK_URL_TEST_RESULTS=

```
Run the tests using the following commands:
```
docker-compose build --force-rm --no-cache
docker-compose up [suite] --detach
docker-compose logs -f
```
`suite` can be one of `private-public`, `local_client-public`, or `local_node-private`, or it can be left empty to run all the test suites.
