import { default as resetFocus } from './resetFocus.js';

export default function focus(page, selector) {
	return page.$eval(selector, elem => {
		return new Promise(resolve => {
			elem.focus();
			requestAnimationFrame(resolve);
		});
	});
}

export async function focusWithKeyboard(page, selectors) {
	selectors = [].concat(selectors);
	await page.keyboard.press('Tab');
	const first = selectors.shift();
	await page.$eval(first, (elem, selectors) => {
		selectors.forEach(selector => elem = elem.shadowRoot.querySelector(selector));
		elem.focus({ focusVisible: true });
	}, selectors);
}

export async function focusWithMouse(page, selectors) {
	selectors = [].concat(selectors);
	await resetFocus(page);
	const first = selectors.shift();
	await page.$eval(first, (elem, selectors) => {
		selectors.forEach(selector => elem = elem.shadowRoot.querySelector(selector));
		elem.focus();
	}, selectors);
}
