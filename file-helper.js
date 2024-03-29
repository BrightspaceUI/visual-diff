import {
	copyFileSync, createReadStream, createWriteStream, existsSync, lstatSync,
	mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync
} from 'fs';
import PNG from 'pngjs';
import { S3Helper } from './s3-helper.js';

export class FileHelper {

	constructor(name, rootDir, isCI) {
		this.s3 = new S3Helper(name);
		this.isCI = isCI;

		this.name = name;
		this.rootDir = rootDir;
		this.currentSubDir = `current/${name}`;
		this.goldenSubDir = this.isCI ? `ci/golden/${name}` : `golden/${name}`;
		this.currentDir = `${rootDir}/${this.currentSubDir}`;
		this.goldenDir = `${rootDir}/${this.goldenSubDir}`;

		if (!existsSync(this.rootDir)) mkdirSync(this.rootDir);
		this.makeDir(rootDir, this.goldenSubDir);

		this.cleanDir(this.currentDir);
		this.makeDir(rootDir, this.currentSubDir);
	}

	cleanDir(path, remove) {
		if (existsSync(path)) {
			const files = readdirSync(path);
			files.forEach((file) => {
				const currentPath = `${path}/${file}`;
				if (lstatSync(currentPath).isDirectory()) {
					this.cleanDir(currentPath, true);
				} else {
					unlinkSync(currentPath);
				}
			});
			if (remove) rmdirSync(path);
		}
	}

	formatName(name) {
		return name.replace(/ /g, '-');
	}

	getCurrentBaseUrl() {
		if (!this.isCI) return null;
		return this.s3.getCurrentBaseUrl();
	}

	getCurrentFiles() {
		return readdirSync(this.currentDir);
	}

	getCurrentImage(name) {
		return this.getImage(this.getCurrentPath(name));
	}

	getCurrentImageBase64(name) {
		return this.getImageBase64(this.getCurrentPath(name));
	}

	getCurrentPath(name) {
		const ext = (name.endsWith('.png') || name.endsWith('.html')) ? '' : '.png';
		return `${this.currentDir}/${this.formatName(name)}${ext}`;
	}

	getCurrentTarget() {
		return this.isCI ? this.s3.target : this.currentDir;
	}

	getDiffImageBase64(name) {
		return this.getImageBase64(this.getCurrentPath(name));
	}

	getGoldenFiles() {
		return readdirSync(this.goldenDir);
	}

	getGoldenImage(name) {
		const hasGoldenFile = this.hasGoldenFile(name);
		if (!hasGoldenFile) return null;
		return this.getImage(this.getGoldenPath(name));
	}

	getGoldenImageBase64(name) {
		const hasGoldenFile = this.hasGoldenFile(name);
		if (!hasGoldenFile) return null;
		return this.getImageBase64(this.getGoldenPath(name));
	}

	getGoldenPath(name) {
		const ext = (name.endsWith('.png') || name.endsWith('.html')) ? '' : '.png';
		return `${this.goldenDir}/${this.formatName(name)}${ext}`;
	}

	getGoldenTarget() {
		return this.goldenDir;
	}

	getImage(path) {
		return new Promise((resolve) => {
			const data = readFileSync(path);
			const image = PNG.PNG.sync.read(data);
			resolve(image);
		});
	}

	getImageBase64(path) {
		return new Promise((resolve) => {
			let image = '';
			createReadStream(path, { encoding: 'base64' }).on('data', (data) => {
				image += data;
			}).on('end', () => {
				resolve(image);
			});
		});
	}

	getReportFileName() {
		return this.isCI ? `${this.getTimestamp('-', '.')}-${process.env['GITHUB_SHA']}-report.html` : 'report.html';
	}

	getTimestamp(dateDelim, timeDelim) {
		dateDelim = dateDelim ? dateDelim : '-';
		timeDelim = timeDelim ? timeDelim : ':';
		const date = new Date();
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		const day = date.getUTCDate();
		const hours = date.getUTCHours();
		const minutes = date.getUTCMinutes();
		const seconds = date.getUTCSeconds();
		const milliseconds = date.getUTCMilliseconds();
		return year + dateDelim
			+ (month < 10 ? '0' + month : month) + dateDelim
			+ (day < 10 ? '0' + day : day) + '-'
			+ (hours < 10 ? '0' + hours : hours) + timeDelim
			+ (minutes < 10 ? '0' + minutes : minutes) + timeDelim
			+ (seconds < 10 ? '0' + seconds : seconds) + '.'
			+ milliseconds;
	}

	hasGoldenFile(name) {
		const goldenPath = this.getGoldenPath(name);
		return existsSync(goldenPath);
	}

	makeDir(rootDir, subDir) {
		const dirs = subDir.split('/');
		dirs.forEach((dir) => {
			rootDir += `/${dir}`;
			if (!existsSync(rootDir)) mkdirSync(rootDir);
		});
	}

	removeGoldenFile(name) {
		const path = this.getGoldenPath(name);
		if (existsSync(path)) unlinkSync(path);
	}

	updateGolden(name) {
		if (!existsSync(this.getCurrentPath(name))) return false;
		copyFileSync(this.getCurrentPath(name), this.getGoldenPath(name));
		return true;
	}

	async writeCurrentStream(name, stream) {
		const filePath = this.getCurrentPath(name);
		const writeStream = () => {
			const promise = new Promise((resolve) => {
				stream.pipe(createWriteStream(filePath)).on('finish', () => {
					resolve();
				});
			});
			return promise;
		};
		await writeStream();
	}

	async writeFile(name, content) {
		if (!name || name.length === 0 || !content || content.length === 0) return;
		const filePath = this.getCurrentPath(name);
		writeFileSync(filePath, content);
		if (this.isCI) await this.s3.uploadFile(filePath);
	}

}
