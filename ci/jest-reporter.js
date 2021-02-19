const fs = require('fs')
const { uniqueNamesGenerator, adjectives, animals, colors } = require('unique-names-generator')

class MyCustomReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig
    this._options = options
  }

  onRunComplete(contexts, results) {
    const runId = uniqueNamesGenerator({
      dictionaries: [adjectives, animals, colors],
      length: 3
    })
    const message = buildDiscordSummary(results, runId)
    const summary = { embeds: message, username: 'jest-reporter'}
    this.printResults(summary, 'summary')
  }

  printResults(data, fileSuffix) {
    const file = `discord_results-${fileSuffix}.json`
    console.log('Printing results to', file)
    data = new Uint8Array(Buffer.from(JSON.stringify(data)))
    fs.writeFileSync(file, data)
  }
}

function buildDiscordSummary(results, runId) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  let title = 'Tests Failed'
  let description = `Run Id: ${runId}`
  let color = 16711712
  if (results.success) {
    title = 'Tests Passed'
    color = 8781568
  }
  const duration = Math.ceil((Date.now() - results.startTime) / (1000 * 60))

  const discordEmbeds = [
    {
      title,
      description,
      color,
      thumbnail: {},
      fields: [
        {
          name: 'Environment',
          value: process.env.NODE_ENV,
        },
        {
          name: 'Started at',
          value: startedAt
        },
        {
          name: 'Duration',
          value: `~ ${duration} minutes`
        },
        {
          name: 'Suites',
          value: `Passed: ${results.numPassedTestSuites}, Failed: ${results.numFailedTestSuites}, Total: ${results.numTotalTestSuites}`,
        },
        {
          name: 'Tests',
          value: `Passed: ${results.numPassedTests}, Failed: ${results.numFailedTests}, Total: ${results.numTotalTests}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

module.exports = MyCustomReporter
