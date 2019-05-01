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

	it('test-element', async function() {
		const rect = await visualDiff.getRect(page, 'div');
		await visualDiff.screenshotAndCompare(page, this.test.fullTitle(), { clip: rect });
	});

});
