const { generateDiscordCloudwatchLogFile, listECSTasks, sendDiscordNotification } = require('./helpers')
const child_process = require('child_process')

async function main() {
  const taskArns = await listECSTasks()  // like  taskArns =  [ 'arn:aws:ecs:*********:************:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84' ]
  const logUrls = generateDiscordCloudwatchLogFile(taskArns)
  if (logUrls.length < 1) {
    logUrls = ["No LogFile found"]
  }

  console.log("logFileName::::=",logFileName)
  
  const message = [
    {
      title: 'Tests Exited',
      description: `Run Id: ${process.env.RUN_ID}`,
      color: 16711712,
      fields: [
        {
          name: 'Configuration',
          value: `${process.env.NODE_ENV}`,
        },
        { 
          name: 'Logs',
          value: `${logUrls}`,
        }
      ],
    },
  ]
  const userName = 'jest-reporter'}
  const data = { embeds: message, username: userName }
  const testPassUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS
  const testFailUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
 
  const retryDelayMs = 300000 // 300k ms = 5 mins
  sendDiscordNotification(testPassUrl, data, retryDelayMs)
  sendDiscordNotification(testFailUrl, data, retryDelayMs)
}

main().then(() => {
        console.log('Done')
      })
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
