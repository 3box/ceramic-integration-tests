const { generateDiscordCloudwatchLogUrls, listECSTasks, sendDiscordNotification } = require('./helpers')

const main = async () => {
  try {
    const taskArns = await listECSTasks();  // like  taskArns =  [ 'arn:aws:ecs:*********:************:task/ceramic-dev-tests/2466935a544f47ec9a1c3d8add235c84' ]
    console.log('INFO: listECSTasks taskArns:=', taskArns)
    let logUrls = generateDiscordCloudwatchLogUrls(taskArns)
    if (logUrls.length < 1) {
      logUrls = ["No log Urls found"]
    }
  
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
    const data = { embeds: message, username: 'jest-reporter' }
    const testResultsUrl = process.env.DISCORD_WEBHOOK_URL_TEST_RESULTS
    const testFailuresUrl = process.env.DISCORD_WEBHOOK_URL_TEST_FAILURES
   
    const retryDelayMs = 300000 // 300k ms = 5 mins
    sendDiscordNotification(testResultsUrl, data, retryDelayMs)
    sendDiscordNotification(testFailuresUrl, data, retryDelayMs)
  } catch (err) {
    console.error(err);
    process.exit(1)
  }
}

main();
