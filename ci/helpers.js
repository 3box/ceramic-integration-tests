const https = require('https')
const { ECSClient, ListTasksCommand } = require('@aws-sdk/client-ecs')

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'REGION'});
// Create the DynamoDB service object
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

/**
 * Returns commitHashes
 */
function getCommitHashes() {
  var params = {
    TableName: 'TABLE',
    Key: {
      'KEY_NAME': {N: '001'}
    },
    ProjectionExpression: 'ATTRIBUTE_NAME'
  };
  
  // Call DynamoDB to read the item from the table
  ddb.getItem(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data.Item);
      return data.Item
    }
  });
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
  sendDiscordNotification
}
