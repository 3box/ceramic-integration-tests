// jest.config.js
const {defaults} = require('jest-config')

module.exports = {
    ...defaults,
    testEnvironment: "node",
    transformIgnorePatterns: [
      "/node_modules(?!/did-jwt)/"
    ],
    moduleNameMapper: {
      "multiformats/basics": "multiformats/cjs/src/basics-import.js",
      "multiformats/legacy": "multiformats/cjs/src/legacy.js"
    }
}
