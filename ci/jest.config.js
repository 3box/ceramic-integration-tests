// jest.config.js
const {defaults} = require('jest-config')

module.exports = {
    ...defaults,
    reporters: ["default", "./jest-reporter.js"],
    testEnvironment: "node",
    transformIgnorePatterns: [
      "/node_modules(?!/did-jwt)/"
    ]
}
