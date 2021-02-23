const child_process = require('child_process')
const { uniqueNamesGenerator, adjectives, animals, colors } = require('unique-names-generator')
const { BaseReporter } = require('@jest/reporters')

class MyCustomReporter extends BaseReporter {
  constructor(globalConfig, options) {
    super(globalConfig, options)
    this._globalConfig = globalConfig
    this._options = options
    this.runId = uniqueNamesGenerator({
      dictionaries: [adjectives, animals, colors],
      length: 3
    })
  }

  onRunStart(results, options) {
    const message = buildDiscordStart(results, this.runId)
    const data = { embeds: message, username: 'jest-reporter' }
    const out = child_process.execSync(
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${process.env.DISCORD_WEBHOOK_URL}`
    )
    console.log(out.toString())
  }

  onRunComplete(contexts, results) {
    const message = buildDiscordSummary(results, this.runId)
    const data = { embeds: message, username: 'jest-reporter' }
    const out = child_process.execSync(
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${process.env.DISCORD_WEBHOOK_URL}
      `
    )
    console.log(out.toString())
  }
}

function buildDiscordStart(results, runId) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }
  const discordEmbeds = [
    {
      title: 'Tests Started',
      description: `Run Id: ${runId}`,
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
      ],
    },
  ]
  return discordEmbeds
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
