const { generateDiscordCloudwatchLogUrl, listECSTasks, sendDiscordNotification, getCommitHashes } = require('./helpers')
const { BaseReporter } = require('@jest/reporters')
const child_process = require('child_process')

const userName = 'jest-reporter'
let g_taskArns, g_commitHashes // g_ are global variables

async function listArntasksAndCommitHashes() {
  g_taskArns = await listECSTasks()        // like g_taskArns = ['arn:aws:ecs:*********:************:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84']
  g_commitHashes = await getCommitHashes() // like g_commitHashes = "ceramic-anchor-service (333fc9afb59a) <==> ipfs-daemon (6871b7dcd27d)\n"
}

class MyCustomReporter extends BaseReporter {
  constructor(globalConfig, options) {
    super(globalConfig, options)
    this._globalConfig = globalConfig
    this._options = options
    this.runId = process.env.RUN_ID
    this.logUrls = []
  }

  onRunStart(results, options) {
    listArntasksAndCommitHashes().then(() => {
      console.log("INFO: listECSTasks g_taskArns:=", g_taskArns)
      console.log("INFO: listECSTasks g_commitHashes:=", g_commitHashes)
      this.commitHashes = g_commitHashes
      this.logUrls = generateDiscordCloudwatchLogUrl()
      this.testFailuresUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
      this.testResultsUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS

      const message = buildDiscordStartMessage(results, this.runId, this.logUrls, this.commitHashes)
      const data = { embeds: message, username: userName }

      const retryDelayMs = 300000 // 300k ms = 5 mins
      sendDiscordNotification(this.testResultsUrl, data, retryDelayMs)
    })
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  }

  onRunComplete(contexts, results) {
    const message = buildDiscordSummaryMessage(results, this.runId, this.logUrls, this.commitHashes)
    const data = { embeds: message, username: userName }

    if (results.numFailedTestSuites > 0) {
      const outToFailuresChannel = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
        `curl -X POST \
          -H "Content-Type: application/json" \
          -d '${JSON.stringify(data)}' \
          ${this.testFailuresUrl}
        `
      )
      console.log(outToFailuresChannel.toString())
    }

    const outToResultsChannel = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${this.testResultsUrl}
      `
    )
    console.log(outToResultsChannel.toString())
  }
}

function buildDiscordStartMessage(results, runId, logUrls, commitHashes) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  if (logUrls.length < 1) {
    logUrls = ["No log Urls found"]
  }

  const discordEmbeds = [
    {
      title: 'Tests Started',
      description: `Run Id: ${runId}`,
      thumbnail: {},
      fields: [
        {
          name: 'Configuration',
          value: process.env.NODE_ENV
        },
        {
          name: 'Started at',
          value: startedAt
        },
        {
          name: 'Commit hashes',
          value: `${commitHashes}`
        },
        {
          name: 'Logs',
          value: `${logUrls}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

function buildDiscordSummaryMessage(results, runId, logUrls, commitHashes) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  let title = 'Tests Failed'
  let description = `Run Id: ${runId}`
  let color = 16711712
  if (results.numFailedTestSuites < 1) {
    title = 'Tests Passed'
    color = 8781568
  }
  const duration = Math.ceil((Date.now() - results.startTime) / (1000 * 60))

  if (logUrls.length < 1) {
    logUrls = ["No log Urls found"]
  }

  const discordEmbeds = [
    {
      title,
      description,
      color,
      thumbnail: {},
      fields: [
        {
          name: 'Configuration',
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
        {
          name: 'Commit hashes',
          value: `${commitHashes}`
        },
        {
          name: 'Logs',
          value: `${logUrls}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

module.exports = MyCustomReporter
