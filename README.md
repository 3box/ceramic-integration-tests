# ceramic-integration-tests

To use, first set up your config files/environment variables for node-config as specified here: https://www.npmjs.com/package/node-config-ts#using-files.
Then to actually run the tests:
```
npm install
npm run build
npm run test
```

## Docker

Tests can be run with Docker with the following commands:

```
docker build . -t ceramic-integration-tests
```

```
docker run \
  -e DISCORD_WEBHOOK_URL='<url>' \
  -e NODE_ENV='<name_of_config_file>' \
  ceramic-integration-tests
```
