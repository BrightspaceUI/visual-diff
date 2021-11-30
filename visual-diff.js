import { createPage, disableAnimations, getRect, oneEvent, resetFocus } from './helpers/index.js';
import chalk from 'chalk';
import { expect } from 'chai';
import { FileHelper } from './file-helper.js';
import pixelmatch from 'pixelmatch';
import PNG from 'pngjs';
import { startDevServer } from '@web/dev-server';
import url from 'url';
import { writeFileSync } from 'fs';

const _isCI = process.env['CI'] ? true : false;
const _isLocalTestRun = !_isCI && !process.argv.includes('--golden');
const _isLocalGoldenUpdate = !_isCI && process.argv.includes('--golden');

let _baseUrl;
let _server;
let _goldenUpdateCount = 0;
let _goldenErrorCount = 0;
let _failedReportLinks;
const _testNames = [];

before(async() => {
	_server = await startDevServer({ config: { nodeResolve: true } });
	_baseUrl = `http://localhost:${_server.config.port}`;
});

after(async() => {
	if (_isCI && _failedReportLinks) {
		writeFileSync('failed-reports.txt', _failedReportLinks);
	}
	if (_server) {
		await _server.stop();
		process.stdout.write('Stopped server.\n');
	}
	process.stdout.write(chalk.green(`\n  ${chalk.green(_goldenUpdateCount)} golden(s) updated.\n`));
	if (_goldenErrorCount > 0) {
		process.stdout.write(chalk.red(`  ${chalk.red(_goldenErrorCount)} golden updates failed.\n`));
	}
});

export default class VisualDiff {

	constructor(name, importMetaURL, options) {

		if (_testNames.includes(name)) {
			process.stdout.write(chalk.red(`\nDuplicate name key: ${name}.  VisualDiff configuration requires a unique name.\n`));
			process.exit(1);
		}
		_testNames.push(name);

		const dir = importMetaURL ? url.fileURLToPath(new URL('.', importMetaURL)) : process.cwd();

		this.createPage = createPage;
		this.disableAnimations = disableAnimations;
		this.getRect = getRect;
		this.oneEvent = oneEvent;
		this.resetFocus = resetFocus;

		this._results = [];
		this._hasTestFailures = false;
		this._fs = new FileHelper(name, `${dir}/screenshots`, _isCI);
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
				process.stdout.write(chalk.green('      [Golden updated successfully.]\n'));
			} else if (_isLocalGoldenUpdate) {
				process.stdout.write(chalk.grey('      [Golden already up to date.]\n'));
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

	async screenshotAndCompare(page, name, screenshotOptions, compareOptions) {
		const info = Object.assign({ path: this._fs.getCurrentPath(name) }, screenshotOptions);

		await page.screenshot(info);

		await this._compare(name, compareOptions);
	}

	async _compare(name, options) {

		const currentImage = await this._fs.getCurrentImage(name);
		const goldenImage = await this._fs.getGoldenImage(name);

		const currentImageBase64 = await this._fs.getCurrentImageBase64(name);
		const goldenImageBase64 = await this._fs.getGoldenImageBase64(name);

		const allowedPixels = options && options.allowedPixels ? options.allowedPixels : 0;
		let pixelsDiff, diffImageBase64;

		if (goldenImage && currentImage.width === goldenImage.width && currentImage.height === goldenImage.height) {
			const diff = new PNG.PNG({ width: currentImage.width, height: currentImage.height });
			pixelsDiff = pixelmatch(
				currentImage.data, goldenImage.data, diff.data, currentImage.width, currentImage.height, { threshold: this._tolerance }
			);
			if (pixelsDiff !== 0) {
				await this._fs.writeCurrentStream(`${name}-diff`, diff.pack());
				diffImageBase64 = await this._fs.getDiffImageBase64(`${name}-diff`);
			}
			if (pixelsDiff > allowedPixels) this._updateGolden = true;
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
			diff: { pixelsDiff: pixelsDiff, allowedPixels: allowedPixels, base64Image: (pixelsDiff > 0 ? diffImageBase64 : null) },
		});

		if (!_isLocalGoldenUpdate) {
			expect(goldenImage !== null, 'golden exists').equal(true);
			expect(currentImage.width, 'image widths are the same').equal(goldenImage.width);
			expect(currentImage.height, 'image heights are the same').equal(goldenImage.height);
			expect(pixelsDiff, 'number of different pixels').to.be.at.most(allowedPixels);
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
				`<img src="data:image/png;base64,${image.base64Image}" style="height: ${image.height / this._dpr}px; width: ${image.width / this._dpr}px;" alt="${name}" />`
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
				return createArtifactHtml('Difference', `${diff.pixelsDiff / this._dpr}px`, `<img src="data:image/png;base64,${diff.base64Image}" style="height: ${defaultImage.height / this._dpr}px; width: ${defaultImage.width / this._dpr}px;" alt="Difference" />`);
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
				<div${result.diff.pixelsDiff === 0 ? ' class="success"' : (result.diff.pixelsDiff <= result.diff.allowedPixels ? ' class="warning"' : '')}>
					<h2>${result.name}</h2>
					<div class="compare">
						${createCurrentHtml(result.current)}
						${createGoldenHtml(result.golden, result.current)}
						${createDiffHtml(result.diff, result.current, result.golden)}
					</div>
				</div>`;
		}).join('\n');

		const html = `
			<html>
				<head>
					<title>visual-diff</title>
					<style>
						html { font-size: 20px; }
						body {
							background-color: #333333;
							color: #ffffff;
							font-family: sans-serif;
							margin: 18px;
						}
						h1 { font-size: 1.2rem; font-weight: 400; margin: 24px 0; }
						h2 { font-size: 0.9rem; font-weight: 400; margin: 30px 0 18px 0; }
						a { color: #006fbf; }
						input { transform: scale(1.5); }
						label { font-size: 0.9rem; }
						.compare { display: flex; }
						.compare > div { margin: 0 18px; }
						.compare > div:first-child { margin: 0 18px 0 0; }
						.compare > div:last-child { margin: 0 0 0 18px; }
						.compare > div:last-child div:first-child::before { color: #cd2026; content: '\\2716'; margin-right: 0.4rem; }
						.success .compare > div:last-child div:first-child::before { color: #8ad934; content: '\\2714'; }
						.warning .compare > div:last-child div:first-child::before { color: #ffba59; content: '\\203C'; }
						.label {
							align-items: center;
							display: flex;
							font-size: 0.7rem;
							margin-bottom: 6px;
						}
						.meta { font-size: 0.7rem; margin-top: 24px; }
						.meta > div { margin-bottom: 3px; }
						.hide-success .success { display: none; }
					</style>
				</head>
				<body>
					<h1>Visual-Diff</h1>
					<input id="hideSuccesses" type="checkbox"></input>
					<label for="hideSuccesses">Hide Successful Tests</label>
					${diffHtml}
					${createMetaHtml()}
				</body>
				<script>
					const checkbox = document.getElementById('hideSuccesses');
					checkbox.addEventListener('change', () => {
						document.body.classList.toggle('hide-success', checkbox.checked);
					});
				</script>
			</html>
		`;

		await this._fs.writeFile(fileName, html);
	}

}
