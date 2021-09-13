const { generateDiscordCloudwatchLogFile, listECSTasks, sendDiscordNotification } = require('./helpers')
const child_process = require('child_process')

async function main() {
  const taskArns = await listECSTasks()  // like  taskArns =  [ 'arn:aws:ecs:us-east-2:967314784947:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84' ]
  const logFileName = generateDiscordCloudwatchLogFile(taskArns)
  let logFile = logFileName
  if (logFileName.length === 0) {
    logFile = ["No LogFile found!!!"]
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
          name: 'Log file',
          value: `${logFile}`,
        }
      ],
    },
  ]
  const data = { embeds: message, username: 'jest-reporter' }
  //ACTUAL// const testPassUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS
  //ACTUAL// const testFailUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
  const testPassUrl = 'https://discordapp.com/api/webhooks/877880441254842388/OnoMzNAHIzWawEymW7Cp_2WNOCjggtoJyjFnMOTx_ut43yFlp4RRSQKd8W6vGjgQiL9O' //TEST//
  const testFailUrl = 'https://discordapp.com/api/webhooks/879318039064100894/fcAM5HypKLuwWIIcYEoOzVEI6eLIv6Mah3Af991NbE75zfMZPlfVbT2S_dde10pUt6xn' //TEST//
 
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
