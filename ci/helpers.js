import * as https from 'https'
import * as childProcess from 'child_process'
import {ECSClient, ListTasksCommand} from '@aws-sdk/client-ecs'

// API gateway to Lambda to load the required clients and packages.

/**
 * Returns the ARN for the running task
 * @returns {string}
 */
function getThisTaskArn() {
  return childProcess
    .execSync(
      'curl -s "$ECS_CONTAINER_METADATA_URI_V4/task" | /app/node_modules/node-jq/bin/jq -r ".TaskARN" | awk -F/ \'{print $NF}\''
    )
    .toString()
}

/**
 * Returns the CloudWatch log url for the running task
 * @param taskArn {string | undefined}
 * @returns {string}
 */
function generateDiscordCloudwatchLogUrl(taskArn = undefined) {
  if (!taskArn) taskArn = getThisTaskArn()
  const actualLogUrlName = `${process.env.CLOUDWATCH_LOG_BASE_URL}${taskArn}`
  return actualLogUrlName
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
const sendDiscordNotification = async (webhookUrl, data, retryDelayMs = -1) => {
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    const req = await https.request(webhookUrl, options, res => {
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
  } catch (err) {
    console.error(err)
  }
}

export {
  getThisTaskArn,
  generateDiscordCloudwatchLogUrl,
  listECSTasks,
  sendDiscordNotification
}
