import AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

const directoryPath = path.join(import.meta.url, '../root/.ceramic/logs');

function main() {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    files.forEach(function(file) {
      uploadToS3(path.join(directoryPath, file));
    });
  });
}

function uploadToS3(file) {
  const fileStream = fs.createReadStream(file);

  fileStream.on('error', (err) => {
    console.log('File Error', err);
  });

  const prefix = process.env.S3_DIRECTORY_NAME ? `${process.env.S3_DIRECTORY_NAME}/` : ''
  const uploadParams = {
    Bucket: 'ceramic-qa-tests',
    Key: `${prefix}${path.basename(file)}`,
    Body: fileStream
  };

  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.log('Error', err);
    }
    if (data) {
      console.log('Upload Success', data.Location);
    }
  });
}

main();
