module.exports = async(browser, options) => {
	const page = await browser.newPage();
	await page.emulateMediaFeatures([{
		name: 'prefers-reduced-motion', value: 'reduce'
	}]);
	const viewportOptions = { width: 800, height: 800, deviceScaleFactor: 2 };
	if (options && options.viewport) {
		Object.assign(viewportOptions, options.viewport);
	}
	await page.setViewport(viewportOptions);
	return page;
};
