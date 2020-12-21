# ceramic-integration-tests

To run tests, first update `config/default.json` to the config that you want to run against, then:
```
npm install
npm run build
node build/bin/test_runner.js
```