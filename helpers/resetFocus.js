module.exports = async (page) => {
	await page.evaluate(() => {
		let elem = document.querySelector('#vd-focus');
		if (!elem) {
			elem = document.createElement('button');
			elem.id = 'vd-focus';
			elem.innerHTML = 'reset focus';
			elem.style.opacity = 0;
			document.body.insertBefore(elem, document.body.firstChild);
		}
	});
	await page.click('#vd-focus');
};
