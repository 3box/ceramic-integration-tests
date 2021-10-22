const https = require('https')
const { ECSClient, ListTasksCommand } = require('@aws-sdk/client-ecs')

// Lambda load the required clients and packages.
const { APIGatewayClient, TestInvokeMethodCommand } = require ("@aws-sdk/client-api-gateway")


const getCommitHashes = async () => { // Based on Lambda SDK example https://github.com/awsdocs/aws-doc-sdk-examples/blob/main/javascriptv3/example_code/lambda/lambda_create_function/src/LambdaApp/index.js
  try {
    const client = new APIGatewayClient({ region: process.env.AWS_REGION });
    const ceramicCmd = new TestInvokeMethodCommand({restApiId: "", resourceId: "", httpMethod: "GET", pathWithQueryString: "v1.0/infra?name=ceramic"});
    const ceramicResp = await client.send(ceramicCmd);
    const ceramicJson = JSON.parse(ceramicResp.body)
    const casCmd = new TestInvokeMethodCommand({restApiId: "", resourceId: "", httpMethod: "GET", pathWithQueryString: "v1.0/infra?name=cas"});
    const casResp = await client.send(casCmd);
    const casJson = JSON.parse(casResp.body)
    const ceramicDeployTag = ceramicJson.deployTag
    const ceramicIpfsDeployTag = ceramicDeployTag
    const casDeployTag = casJson.deployTag
    const casIpfsDeployTag = casJson.buildInfo.ipfs_sha_tag

    const envUrls = `${process.env.CERAMIC_URLS}`.replace(/ /g,"\n")
    const ceramicRepository = 'https://github.com/ceramicnetwork/js-ceramic'
    const casRepository = 'https://github.com/ceramicnetwork/ceramic-anchor-service'
    return `[js-ceramic (${ceramicDeployTag.substr(0, 12)})](${ceramicRepository}/commit/${ceramicDeployTag}) <==> [ipfs-daemon (${ceramicIpfsDeployTag.substr(0, 12)})](${ceramicRepository}/commit/${ceramicIpfsDeployTag})
                      [ceramic-anchor-service (${casDeployTag.substr(0, 12)})](${casRepository}/commit/${casDeployTag}) <==> [ipfs-daemon (${casIpfsDeployTag.substr(0, 12)})](${ceramicRepository}/commit/${casIpfsDeployTag})
                      \`\`\`\n${envUrls}\`\`\` `
  } catch (err) {
    console.error(err);
  }
}


/**
 * Returns list of running ECS Cloudwatch logs for running test tasks
 * @param {Array<string>} taskArns 
 * @returns {Array<string>}
 */
function generateDiscordCloudwatchLogUrls(taskArns) {
  const arnRegex = /\w+$/

  const logUrls = taskArns.map((arn, index) => {
    let logUrlName
    const id = arn.match(arnRegex)
    if (id) {
      logUrlName = `${process.env.CLOUDWATCH_LOG_BASE_URL}${id[0]}`
    }

    return `${logUrlName}\n`
  })

  return logUrls
}


/**
 * Returns list of running ECS tasks
 * @returns {Array<string>}
 */
async function listECSTasks() {
  const client = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })

  const params = {
    cluster: process.env.AWS_ECS_CLUSTER,
    family: process.env.AWS_ECS_FAMILY
  }

  const command = new ListTasksCommand(params)

  const data = await client.send(command)

  if (data.$metadata.httpStatusCode > 399) {
    throw Error(data.$metadata.httpStatusCode)
  } else {
    return data.taskArns
  }
}


/**
 * Sends a POST to the discord webhookUrl
 * @param {string} webhookUrl Discord webhook url
 * @param {any} data POST data
 * @param {Number} retryDelayMs If -1, will not retry, otherwise the millisecond delay before 1 retry
 */
function sendDiscordNotification(webhookUrl, data, retryDelayMs = -1) {
  const options = {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    }
  }
  const req = https.request(webhookUrl, options, (res) => {
    console.log(`Notification request status code: ${res.statusCode}`)
    if (res.statusCode >= 500 && retryDelayMs > -1) {
      console.log(`Retrying after ${retryDelayMs} milliseconds...`)
      setTimeout(() => {
        sendDiscordNotification(webhookUrl, data)
      }, retryDelayMs)
    }
  })
  req.on('error', console.error)
  req.write(JSON.stringify(data))
  req.end()
}

module.exports = {
  generateDiscordCloudwatchLogUrls,
  listECSTasks,
  sendDiscordNotification,
  getCommitHashes
}
