import {
  getThisTaskArn,
  generateDiscordCloudwatchLogUrl,
  getCommitHashes,
  sendDiscordNotification
} from './helpers.js';

const main = async () => {
  try {
    const taskArn = getThisTaskArn()
    console.log('INFO: taskArn:=', taskArn)
    const commitHashes = await getCommitHashes() // e.g. "ceramic-anchor-service (333fc9afb59a) <==> go-ipfs-daemon (6871b7dcd27d)\n"

    let logUrl = generateDiscordCloudwatchLogUrl(taskArn)
    if (logUrl == '') {
      logUrl = 'No log URL found'
    } else {
      logUrl = `[Cloudwatch logs for task ${taskArn}](${logUrl})`
    }

    const message = [
      {
        title: 'Tests Exited',
        description: `Run Id: ${taskArn}`,
        color: 16711712,
        fields: [
          {
            name: 'Configuration',
            value: `${process.env.NODE_ENV}`,
          },
          {
            name: 'Commit hashes',
            value: `${commitHashes}`
          },
          {
            name: 'Logs',
            value: `${logUrl}`,
          }
        ],
      },
    ]
    const data = { embeds: message, username: 'jest-reporter' }
    const testFailuresUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
    const testResultsUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS

    const retryDelayMs = 300000 // 300k ms = 5 mins
    sendDiscordNotification(testFailuresUrl, data, retryDelayMs)
    sendDiscordNotification(testResultsUrl, data, retryDelayMs)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

main()
