const AWS = require('aws-sdk');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

let _s3Config = {
	bucket: 'visualdiff.gaudi.d2l',
	key: 'S3',
	target: 'visualdiff.gaudi.d2l/screenshots',
	region: 'ca-central-1',
	creds: {
		accessKeyId: process.env['VISUAL_DIFF_S3_ID'],
		secretAccessKey: process.env['VISUAL_DIFF_S3_SECRET']
	}
};

class S3Helper {

	constructor(name, config, isCI) {
		if (config) _s3Config = Object.assign(_s3Config, config);
		if (isCI) this.currentConfig = Object.assign({}, _s3Config, { target: `${_s3Config.target}/${process.env['TRAVIS_REPO_SLUG']}/${name}`});
	}

	getCurrentObjectUrl(name) {
		return `https://s3.${this.currentConfig.region}.amazonaws.com/${this.currentConfig.target}/${name}`;
	}

	uploadFile(filePath) {
		const config = this.currentConfig;
		const promise = new Promise((resolve, reject) => {

			const getContentType = (filePath) => {
				if (filePath.endsWith('.html')) return 'text/html';
				if (filePath.endsWith('.png')) return 'image/png';
				return;
			};

			const s3 = new AWS.S3({
				apiVersion: 'latest',
				accessKeyId: config.creds.accessKeyId,
				secretAccessKey: config.creds.secretAccessKey,
				region: config.region
			});

			const params = {
				ACL: 'public-read',
				Body: '',
				Bucket: config.target,
				ContentDisposition: 'inline',
				ContentType: getContentType(filePath),
				Key: ''
			};

			const fileStream = fs.createReadStream(filePath);

			fileStream.on('error', function(err) {
				process.stdout.write(`\n${chalk.red(err)}`);
				reject(err);
			});
			params.Body = fileStream;
			params.Key = path.basename(filePath);

			s3.upload(params, function(err, data) {
				if (err) {
					process.stdout.write(`\n${chalk.red(err)}`);
					reject(err);
				}
				if (data) {
					resolve(data);
				}
			});

		});
		return promise;
	}

}

module.exports = S3Helper;
