const { generateDiscordCloudwatchLogFile, listECSTasks, sendDiscordNotification } = require('./helpers')

const { BaseReporter } = require('@jest/reporters')
const child_process = require('child_process')

async function listArntasks() {
  taskArns = await listECSTasks()  // like taskArns = ['arn:aws:ecs:*********:************:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84']
}



class MyCustomReporter extends BaseReporter {
  constructor(globalConfig, options) {
    super(globalConfig, options)
    this._globalConfig = globalConfig
    this._options = options
    this.runId = process.env.RUN_ID
    this.taskArns = []
    this.LogUrls = []
  }

  onRunStart(results, options) {
    listArntasks().then(() => {
      console.log("INFO: listArntasks taskArns:=", taskArns)
      this.taskArns = taskArns
      this.LogUrls = generateDiscordCloudwatchLogFile(taskArns)
      this.testPassUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS
      this.testFailUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES

      const message = buildDiscordStartMessage(results, this.runId, this.LogUrls)
      const userName = 'jest-reporter'
      const data = { embeds: message, username: userName }

      const retryDelayMs = 300000 // 300k ms = 5 mins
      sendDiscordNotification(this.testPassUrl, data, retryDelayMs)
    })
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  }

  onRunComplete(contexts, results) {
    const message = buildDiscordSummaryMessage(results, this.runId, this.LogUrls)
    const userName = 'jest-reporter'
    const data = { embeds: message, username: userName }

    if (results.numFailedTestSuites > 0) {
      const out2 = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
        `curl -X POST \
          -H "Content-Type: application/json" \
          -d '${JSON.stringify(data)}' \
          ${this.testFailUrl}
        `
      )
      console.log(out2.toString())
    }
    
    const out = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${this.testPassUrl}
      `
    )
    console.log(out.toString())
  }
}

function buildDiscordStartMessage(results, runId, logUrls) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  if (logUrls.length === 0) {
    logUrls = ["No LogFile found"]
  }

  let commitHashNames = 'js-ceramic (85d6c9789d28)\nipfs-daemon (85d6c9789d28)' // Placeholder work-in-progress

  const discordEmbeds = [
    {
      title: 'Tests Started',
      description: `Run Id: ${runId}`,
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
          name: 'Logs',
          value: `${logUrls}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

function buildDiscordSummaryMessage(results, runId, logUrls) {
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

  if (logUrls.length === 0) {
    logUrls = ["No LogFile found"]
  }

  let commitHashNames = 'js-ceramic (85d6c9789d28)\nipfs-daemon (85d6c9789d28)' // Placeholder work-in-progress

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
          name: 'Logs',
          value: `${logUrls}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

module.exports = MyCustomReporter
