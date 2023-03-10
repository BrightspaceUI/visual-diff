export default function focus(page, selector) {
	return page.$eval(selector, elem => {
		return new Promise(resolve => {
			elem.focus();
			requestAnimationFrame(resolve);
		});
	});
}

export async function focusWithKeyboard(page, selector) {
	await page.keyboard.press('Tab');
	await page.$eval(selector, elem => elem.focus({ focusVisible: true }));
}

export async function focusWithMouse(page, selector) {
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
	await page.$eval(selector, elem => elem.focus());
}
