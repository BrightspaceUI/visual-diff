const expect = require('chai').expect;
const puppeteer = require('puppeteer');
const VisualDiff = require('../visual-diff.js');

describe('visual-diff', function() {

	const visualDiff = new VisualDiff('visual-diff', __dirname);

	let browser, page;

	before(async() => {
		browser = await puppeteer.launch();
		page = await visualDiff.createPage(browser);
		await page.goto(`${visualDiff.getBaseUrl()}/test/test.visual-diff.html`, { waitUntil: ['networkidle0', 'load'] });
		await page.bringToFront();
	});

	after(() => browser.close());

	it('element-matches', async function() {
		const rect = await visualDiff.getRect(page, '#matches');
		await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
	});

	it('element-matches-transition', async function() {
		await page.$eval('#matches', elem => elem.style.opacity = '0.2');
		const rect = await visualDiff.getRect(page, '#matches');
		await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
	});

	it('element-different', async function() {
		const isGolden = process.argv.includes('--golden');
		if (!isGolden) {
			await page.evaluate(() => {
				const elem = document.querySelector('#different');
				elem.style.borderColor = 'black';
				elem.textContent = 'Different Text';
			});
		}
		const rect = await visualDiff.getRect(page, '#different');
		let different = false;
		try {
			await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
		} catch (ex) {
			different = true;
		}
		if (!isGolden) {
			expect(different, 'current and golden images to be different').equal(true);
		}
	});

	it('element-different-allowed', async function() {
		const isGolden = process.argv.includes('--golden');
		if (!isGolden) {
			await page.evaluate(() => {
				const elem = document.querySelector('#different-allowed');
				elem.style.borderRadius = '3px';
			});
		}
		const rect = await visualDiff.getRect(page, '#different-allowed');
		await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect }, { allowedPixels: 24 });
	});

});
