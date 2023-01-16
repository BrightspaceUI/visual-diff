export default function focus(page, selector) {
	return page.$eval(selector, elem => {
		return new Promise(resolve => {
			elem.focus();
			requestAnimationFrame(resolve);
		});
	});
}
