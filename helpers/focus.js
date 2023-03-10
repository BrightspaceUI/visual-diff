import { default as resetFocus } from './resetFocus.js';

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
	await resetFocus(page);
	await page.$eval(selector, elem => elem.focus());
}
