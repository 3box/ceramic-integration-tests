const { generateDiscordCloudwatchLogFile, listECSTasks, sendDiscordNotification } = require('./helpers')

const { BaseReporter } = require('@jest/reporters')
const child_process = require('child_process')

async function main_task() {

  taskArns = await listECSTasks()  // like taskArns = ['arn:aws:ecs:us-east-2:967314784947:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84']

  if (taskArns.length > 1) {
    console.log('Warn: Needs invetigation, more than one task running')
  } else {
    console.log('Info: Ok, only one running task found (assumed to be self)')
  }

  console.log("Info: taskArns:=", taskArns)
}



class MyCustomReporter extends BaseReporter {
  constructor(globalConfig, options) {
    super(globalConfig, options)
    this._globalConfig = globalConfig
    this._options = options
    this.runId = process.env.RUN_ID
    this.taskArns = []
    this.LogFiles = []
  }

  onRunStart(results, options) {
    main_task().then(() => {
      console.log('Done!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
      this.taskArns = taskArns
      this.LogFiles = generateDiscordCloudwatchLogFile(taskArns)

      const message = buildDiscordStart(results, this.runId, this.LogFiles)
      const data = { embeds: message, username: 'jest-reporter' }

      const retryDelayMs = 300000 // 300k ms = 5 mins
      sendDiscordNotification(process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS, data, retryDelayMs)
    })
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  }

  onRunComplete(contexts, results) {
    const message = buildDiscordSummary(results, this.runId, this.LogFiles)
    const data = { embeds: message, username: 'jest-reporter' }

    if (results.numFailedTestSuites > 0) {  // Test Failures
      const out2 = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
        `curl -X POST \
          -H "Content-Type: application/json" \
          -d '${JSON.stringify(data)}' \
          ${process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES}
        `
      )
      console.log(out2.toString())
    }
    
    const out = child_process.execSync(     /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS}
      `
    )
    console.log(out.toString())
  }
}

function buildDiscordStart(results, runId, logFileName) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  let logFile = logFileName
  if (logFileName.length === 0) {
    logFile = ["No LogFile found!!!"]
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
          name: 'Log file',
          value: `${logFile}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

function buildDiscordSummary(results, runId, logFileName) {
  let startedAt = results.startTime
  try {
    startedAt = (new Date(results.startTime)).toGMTString()
  } catch {
    // pass
  }

  let title = 'Tests Passed'
  let description = `Run Id: ${runId}`
  let color = 8781568
  if (results.numFailedTestSuites > 0) {
    title = 'Tests Failed'
    color = 16711712
  }
  const duration = Math.ceil((Date.now() - results.startTime) / (1000 * 60))

  let logFile = logFileName
  if (logFileName.length === 0) {
    logFile = ["No LogFile found!!!"]
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
          name: 'Log file',
          value: `${logFile}`,
        },
      ],
    },
  ]
  return discordEmbeds
}

module.exports = MyCustomReporter
