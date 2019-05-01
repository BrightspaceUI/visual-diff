const expect = require('chai').expect;
const puppeteer = require('puppeteer');
const VisualDiff = require('../visual-diff.js');

describe('visual-diff', function() {

	const visualDiff = new VisualDiff('visual-diff', __dirname);

	let browser, page;

	before(async() => {
		browser = await puppeteer.launch();
		page = await browser.newPage();
		await page.setViewport({width: 800, height: 800, deviceScaleFactor: 2});
		await page.goto(`${visualDiff.getBaseUrl()}/test/test.visual-diff.html`, {waitUntil: ['networkidle0', 'load']});
		await page.bringToFront();
	});

	after(() => browser.close());

	it('element-matches', async function() {
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

});
