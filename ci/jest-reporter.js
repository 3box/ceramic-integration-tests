import {
  getThisTaskArn,
  generateDiscordCloudwatchLogUrl,
  listECSTasks,
  sendDiscordNotification,
  getCommitHashes
} from './helpers.js'
import { BaseReporter } from '@jest/reporters'
import * as childProcess from 'child_process'

const userName = 'jest-reporter'
let g_taskArns, g_commitHashes // g_ are global variables

async function listArntasksAndCommitHashes() {
  g_taskArns = await listECSTasks()
  g_commitHashes = await getCommitHashes() // e.g. "ceramic-anchor-service (333fc9afb59a) <==> go-ipfs-daemon (6871b7dcd27d)\n"
}

export default class MyCustomReporter extends BaseReporter {
  constructor(globalConfig, options) {
    super(globalConfig, options)
    this._globalConfig = globalConfig
    this._options = options
    this.taskArn = getThisTaskArn()
    this.logUrl = ''
  }

  onRunStart(results, options) {
    listArntasksAndCommitHashes()
      .then(() => {
        console.log('INFO: onRunStart g_taskArns:=', g_taskArns)
        console.log('INFO: onRunStart g_commitHashes:=', g_commitHashes)
        this.commitHashes = g_commitHashes
        this.logUrl = generateDiscordCloudwatchLogUrl(this.taskArn)
        this.testFailuresUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
        this.testResultsUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS

        const message = buildDiscordStartMessage(
          results,
          this.taskArn,
          this.logUrl,
          this.commitHashes
        )
        const data = { embeds: message, username: userName }

        const retryDelayMs = 300000 // 300k ms = 5 mins
        sendDiscordNotification(this.testResultsUrl, data, retryDelayMs)
      })
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  }

  onRunComplete(contexts, results) {
    const message = buildDiscordSummaryMessage(
      results,
      this.taskArn,
      this.logUrl,
      this.commitHashes
    )
    const data = { embeds: message, username: userName }

    if (results.numFailedTestSuites > 0) {
      const outToFailuresChannel = childProcess.execSync(
        /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
        `curl -X POST \
          -H "Content-Type: application/json" \
          -d '${JSON.stringify(data)}' \
          ${this.testFailuresUrl}
        `
      )
      console.log(outToFailuresChannel.toString())
    }

    const outToResultsChannel = childProcess.execSync(
      /* In future need to fix why sendDiscordNotification() used here for the second time like in onRunStart does not work here */
      `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${this.testResultsUrl}
      `
    )
    console.log(outToResultsChannel.toString())
  }
}

function buildDiscordStartMessage(results, taskArn, logUrl, commitHashes) {
  let startedAt = results.startTime
  try {
    startedAt = new Date(results.startTime).toGMTString()
  } catch {
    // pass
  }

  if (logUrl == '') {
    logUrl = 'No log URL found'
  } else {
    logUrl = `[Cloudwatch logs for task ${taskArn}](${logUrl})`
  }

  const discordEmbeds = [
    {
      title: 'Tests Started',
      description: `Run Id: ${taskArn}`,
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
          value: `${logUrl}`
        }
      ]
    }
  ]
  return discordEmbeds
}

function buildDiscordSummaryMessage(results, taskArn, logUrl, commitHashes) {
  let startedAt = results.startTime
  try {
    startedAt = new Date(results.startTime).toGMTString()
  } catch {
    // pass
  }

  let title = 'Tests Failed'
  let description = `Run Id: ${taskArn}`
  let color = 16711712
  if (results.numFailedTestSuites < 1) {
    title = 'Tests Passed'
    color = 8781568
  }
  const duration = Math.ceil((Date.now() - results.startTime) / (1000 * 60))

  if (logUrl == '') {
    logUrl = 'No log URL found'
  } else {
    logUrl = `[Cloudwatch logs for task ${taskArn}](${logUrl})`
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
          value: process.env.NODE_ENV
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
          value: `Passed: ${results.numPassedTestSuites}, Failed: ${results.numFailedTestSuites}, Total: ${results.numTotalTestSuites}`
        },
        {
          name: 'Tests',
          value: `Passed: ${results.numPassedTests}, Failed: ${results.numFailedTests}, Total: ${results.numTotalTests}`
        },
        {
          name: 'Commit hashes',
          value: `${commitHashes}`
        },
        {
          name: 'Logs',
          value: `${logUrl}`
        }
      ]
    }
  ]
  return discordEmbeds
}
