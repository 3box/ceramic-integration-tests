const AWS = require('aws-sdk')

const fs = require('fs')
const path = require('path')

AWS.config.update({ 
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

s3 = new AWS.S3({ apiVersion: '2006-03-01' })

const directoryPath = path.join(__dirname, '../root/.ceramic/logs')

function main() {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return console.log('Unable to scan directory: ' + err)
    }
    files.forEach(function (file) {
      uploadToS3(path.join(directoryPath, file))
    })
  })
}

function uploadToS3(file) {
  const fileStream = fs.createReadStream(file)

  fileStream.on('error', (err) => {
    console.log('File Error', err);
  })

  const uploadParams = { Bucket: 'ceramic-dev-tests', Key: '', Body: '' }

  uploadParams.Body = fileStream
  uploadParams.Key = path.basename(file)

  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.log("Error", err)
    } if (data) {
      console.log("Upload Success", data.Location)
    }
  })
}

main()
