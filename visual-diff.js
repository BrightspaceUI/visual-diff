const chalk = require('chalk');
const esDevServer = require('es-dev-server');
const expect = require('chai').expect;
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;
const FileHelper = require('./file-helper.js');
const fs = require('fs');

const _isCI = process.env['CI'] ? true : false;
const _isLocalTestRun = !_isCI && !process.argv.includes('--golden');
const _isLocalGoldenUpdate = !_isCI && process.argv.includes('--golden');
const _serverOptions = esDevServer.createConfig({ babel: true, nodeResolve: true, dedupe: true });

let _baseUrl;
let _server;
let _goldenUpdateCount = 0;
let _goldenErrorCount = 0;
let _failedReportLinks;

before(async() => {
	const { server } = await esDevServer.startServer(_serverOptions);
	_server = server;

	_baseUrl = `http://localhost:${_server.address().port}`;
	process.stdout.write(`Started server with base: ${_baseUrl}\n\n`);
});

after(async() => {
	if (_isCI && _failedReportLinks) {
		fs.writeFileSync('failed-reports.txt', _failedReportLinks);
	}
	if (_server) {
		await _server.close();
		process.stdout.write('Stopped server.\n');
	}
	process.stdout.write(chalk.green(`\n  ${chalk.green(_goldenUpdateCount)} golden(s) updated.\n`));
	if (_goldenErrorCount > 0) {
		process.stdout.write(chalk.red(`  ${chalk.red(_goldenErrorCount)} golden updates failed.\n`));
	}
});

class VisualDiff {

	constructor(name, dir, options) {

		this.createPage = require('./helpers/createPage');
		this.disableAnimations = require('./helpers/disableAnimations');
		this.getRect = require('./helpers/getRect');
		this.oneEvent = require('./helpers/oneEvent');
		this.resetFocus = require('./helpers/resetFocus');

		this._results = [];
		this._hasTestFailures = false;
		this._fs = new FileHelper(name, `${dir ? dir : process.cwd()}/screenshots`, _isCI);
		this._dpr = options && options.dpr ? options.dpr : 2;
		this._tolerance = options && options.tolerance ? options.tolerance : 0;

		let currentTarget, goldenTarget;

		before(async() => {
			currentTarget = this._fs.getCurrentTarget();
			goldenTarget = this._fs.getGoldenTarget();
			if (!_isCI) {
				currentTarget = currentTarget.replace(process.cwd(), '');
				goldenTarget = goldenTarget.replace(process.cwd(), '');
			} else {
				goldenTarget = goldenTarget.replace('/home/runner/work/', '');
			}

			process.stdout.write(`\n${chalk.yellow('    Golden:')} ${goldenTarget}\n\n`);

			if (_isLocalTestRun) {
				// fail fast if no goldens
				const goldenFiles = await this._fs.getGoldenFiles();
				if (goldenFiles.length === 0) {
					process.stdout.write(`\n${chalk.red('No goldens!  Did you forget to generate them?')}\n${goldenTarget}\n\n`);
					process.exit(1);
				}
			}
		});

		beforeEach(() => {
			this._updateGolden = false;
			this._updateError = false;
		});

		afterEach(() => {
			if (this._updateError) {
				process.stdout.write(chalk.bold.red(`      [Attention: ${chalk.yellow('Golden')} update failed!]\n`));
			} else if (this._updateGolden && _isLocalGoldenUpdate) {
				process.stdout.write(chalk.green(`      [Golden updated successfully.]\n`));
			} else if (_isLocalGoldenUpdate) {
				process.stdout.write(chalk.grey(`      [Golden already up to date.]\n`));
			}
		});

		after(async() => {
			const reportName = this._fs.getReportFileName();

			if (!_isLocalTestRun) {
				await this._deleteGoldenOrphans();
			}

			try {
				await this._generateHtml(reportName, this._results);
				if (_isCI) {
					process.stdout.write(`\n${chalk.gray('Results:')} ${this._fs.getCurrentBaseUrl()}${reportName}\n`);
					if (this._hasTestFailures) {
						_failedReportLinks = _failedReportLinks ? _failedReportLinks + `,${this._fs.getCurrentBaseUrl()}${reportName}` : `${this._fs.getCurrentBaseUrl()}${reportName}`;
					}
				} else {
					process.stdout.write(`\n${chalk.gray('Results:')} ${_baseUrl}${currentTarget}/${reportName}\n`);
				}
			} catch (error) {
				process.stdout.write(`\n${chalk.red(`Could not generate report: ${error}`)}`);
			}
		});

	}

	getBaseUrl() {
		return _baseUrl;
	}

	async screenshotAndCompare(page, name, options) {
		const info = Object.assign({ path: this._fs.getCurrentPath(name) }, options);

		await page.screenshot(info);

		await this._compare(name);
	}

	async _compare(name) {

		const currentImage = await this._fs.getCurrentImage(name);
		const goldenImage = await this._fs.getGoldenImage(name);

		const currentImageBase64 = await this._fs.getCurrentImageBase64(name);
		const goldenImageBase64 = await this._fs.getGoldenImageBase64(name);

		let pixelsDiff, diffImageBase64;

		if (goldenImage && currentImage.width === goldenImage.width && currentImage.height === goldenImage.height) {
			const diff = new PNG({ width: currentImage.width, height: currentImage.height });
			pixelsDiff = pixelmatch(
				currentImage.data, goldenImage.data, diff.data, currentImage.width, currentImage.height, { threshold: this._tolerance }
			);
			if (pixelsDiff !== 0) {
				this._updateGolden = true;
				await this._fs.writeCurrentStream(`${name}-diff`, diff.pack());
				diffImageBase64 = await this._fs.getDiffImageBase64(`${name}-diff`);
			}
		} else {
			this._updateGolden = true;
		}

		if (this._updateGolden && !_isLocalTestRun) {
			this._hasTestFailures = true;
			const result = await this._fs.updateGolden(name);
			if (result) {
				_goldenUpdateCount++;
			} else {
				this._updateError = true;
				_goldenErrorCount++;
			}
		}

		this._results.push({
			name: name,
			current: { base64Image: currentImageBase64, height: currentImage.height, width: currentImage.width },
			golden: goldenImage ? { base64Image: goldenImageBase64, height: goldenImage.height, width: goldenImage.width } : null,
			diff: { pixelsDiff: pixelsDiff, base64Image: (pixelsDiff > 0 ? diffImageBase64 : null) },
		});

		if (!_isLocalGoldenUpdate) {
			expect(goldenImage !== null, 'golden exists').equal(true);
			expect(currentImage.width, 'image widths are the same').equal(goldenImage.width);
			expect(currentImage.height, 'image heights are the same').equal(goldenImage.height);
			expect(pixelsDiff, 'number of different pixels').equal(0);
		}
	}

	async _deleteGoldenOrphans() {
		let orphansExist = false;

		const currentFiles = this._fs.getCurrentFiles();
		const goldenFiles = await this._fs.getGoldenFiles();

		for (let i = 0; i < goldenFiles.length; i++) {
			const fileName = goldenFiles[i];
			if (!currentFiles.includes(fileName)) {
				if (!orphansExist) {
					process.stdout.write('\n      Removed orphaned goldens.\n');
					orphansExist = true;
				}
				await this._fs.removeGoldenFile(fileName);
				process.stdout.write(`      ${chalk.gray(fileName)}\n`);
			}
		}

		if (orphansExist) {
			process.stdout.write('\n');
		}
	}

	async _generateHtml(fileName, results) {
		const createArtifactHtml = (name, meta, content) => {
			return `<div>
				<div class="label">${name} ${meta ? '(' : ''}${meta}${meta ? ')' : ''}</div>
				${content}
			</div>`;
		};
		const createImageHtml = (name, image) => {
			return createArtifactHtml(
				name,
				`w:${image.width / this._dpr} x h:${image.height / this._dpr}`,
				`<img src="data:image/png;base64,${image.base64Image}" style="width: ${image.width / this._dpr}px; height: ${image.height / this._dpr}px;" alt="${name}" />`
			);
		};
		const createNoImageHtml = (name, image, reason) => {
			return createArtifactHtml(name, '', `<div class="label" style="width: ${image.width / this._dpr}px;">${reason}</div>`);
		};
		const createCurrentHtml = (image) => {
			return createImageHtml('Current', image);
		};
		const createGoldenHtml = (image, defaultImage) => {
			if (image) return createImageHtml('Golden', image);
			else return createNoImageHtml('Golden', defaultImage, 'No golden.');
		};
		const createDiffHtml = (diff, defaultImage, goldenImage) => {
			if (diff.pixelsDiff === 0) {
				return createNoImageHtml('Difference (0px)', defaultImage, 'Images match.');
			} else if (diff.pixelsDiff > 0) {
				return createArtifactHtml('Difference', `${diff.pixelsDiff / this._dpr}px`, `<img src="data:image/png;base64,${diff.base64Image}" style="width: ${defaultImage.width / this._dpr}px; height: ${defaultImage.height / this._dpr}px;" alt="Difference" />`);
			} else if (goldenImage) {
				return createNoImageHtml('Difference', defaultImage, 'Images are not the same size.');
			} else {
				return createNoImageHtml('Difference', defaultImage, 'No image.');
			}
		};
		const createMetaHtml = () => {
			if (!_isCI) return '';
			const runUrl = `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}/actions/runs/${process.env['GITHUB_RUN_ID']}`;
			const workflow = process.env['GITHUB_WORKFLOW'];
			const runNum = process.env['GITHUB_RUN_NUMBER'];
			const pr = /refs\/pull\/(\d+)\/merge/g.exec(process.env['GITHUB_REF']);
			const prNum = pr && pr[1] ? pr[1] : null; 
			const prUrl = `${process.env['GITHUB_SERVER_URL']}/${process.env['GITHUB_REPOSITORY']}/pull/${prNum}`;
			const branch = process.env['GITHUB_REF'];
			const sha = process.env['GITHUB_SHA'];
			const actor = process.env['GITHUB_ACTOR'];
			return `
				<div class="meta">
					<div><a href="${runUrl}">${workflow} Run #${runNum}</a></div>
					${ prNum ? `<div><a href="${prUrl}">PR: #${prNum}</a></div>` : `<div>Commit to ${branch}: ${sha}</div>`}
					<div>By ${actor}</div>
				</div>`;
		};
		const diffHtml = results.map((result) => {

			return `
				<h2>${result.name}</h2>
				<div class="compare">
					${createCurrentHtml(result.current)}
					${createGoldenHtml(result.golden, result.current)}
					${createDiffHtml(result.diff, result.current, result.golden)}
				</div>`;
		}).join('\n');

		const html = `
			<html>
				<head>
					<title>visual-diff</title>
					<style>
						html { font-size: 20px; }
						body { font-family: sans-serif; background-color: #333; color: #fff; margin: 18px; }
						h1 { font-size: 1.2rem; font-weight: 400; margin: 24px 0; }
						h2 { font-size: 0.9rem; font-weight: 400; margin: 30px 0 18px 0; }
						a { color: #006fbf; }
						.compare { display: flex; }
						.compare > div { margin: 0 18px; }
						.compare > div:first-child { margin: 0 18px 0 0; }
						.compare > div:last-child { margin: 0 0 0 18px; }
						.label { display: flex; font-size: 0.7rem; margin-bottom: 6px; }
						.meta { font-size: 0.7rem; margin-top: 24px; }
						.meta > div { margin-bottom: 3px; }
					</style>
				</head>
				<body>
					<h1>Visual-Diff</h1>${diffHtml}
					${createMetaHtml()}
				</body>
			</html>
		`;

		await this._fs.writeFile(fileName, html);
	}

}

module.exports = VisualDiff;
