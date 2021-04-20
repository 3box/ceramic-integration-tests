// jest.config.js
const {defaults} = require('jest-config')

module.exports = {
    ...defaults,
    testEnvironment: "node",
    transformIgnorePatterns: [
      "/node_modules(?!/did-jwt)/"
    ],
    resolver: "jest-resolver-enhanced"
}
