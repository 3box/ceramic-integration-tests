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

## Docker

Tests can be run with Docker with the following commands:

```
docker build . -t ceramic-integration-tests
```

```
docker run \
  -e AWS_ACCESS_KEY_ID='<only_if_using_s3_state_store>' \
  -e AWS_SECRET_ACCESS_KEY='<only_if_using_s3_state_store>' \
  -e AWS_REGION='<name_of_region>' \
  -e AWS_ECS_CLUSTER='ceramic-dev-tests' \
  -e AWS_ECS_FAMILY='ceramic-dev-tests-smoke_tests' \
  -e CLOUDWATCH_LOG_BASE_URL='https://<AWS_REGION>.console.aws.amazon.com/cloudwatch/home?region=<AWS_REGION>#logsV2:log-groups/log-group/$252Fecs$252Fceramic-dev-tests/log-events/smoke_tests$252Fsmoke_tests$252F' \
  -e DISCORD_WEBHOOK_URL_TEST_FAILURES='<url_for_failures>' \
  -e DISCORD_WEBHOOK_URL_TEST_RESULTS='<url_for_results>' \
  -e INFRA_STATUS_ENDPOINT_BASE_URL='<url_for_dynamodb_endpoint>' \
  -e NODE_ENV='<name_of_config_file>' \
  ceramic-integration-tests
```

Please note: the above docker build and run commands can be placed into your copy of the local ./my_docker_run.sh file which is actually a symlink to the parent directory outside the repo, so your secrets do not get checked into the repo by accident, so   
Step 1. Copy the above docker commands into the currently empty placeholder local ./my_docker_run.sh file.   
Step 2. Replace the -e environment fields with your values   
Step 3. Now your ready to run ./my_docker_run.sh   

