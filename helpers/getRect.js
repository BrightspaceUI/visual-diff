module.exports = async (page, selector, margin) => {
	margin = (margin !== undefined) ? margin : 10;
	return page.$eval(selector, (elem, margin) => {
		const leftMargin = (elem.offsetLeft < margin ? 0 : margin);
		const topMargin = (elem.offsetTop < margin ? 0 : margin);
		return {
			x: elem.offsetLeft - leftMargin,
			y: elem.offsetTop - topMargin,
			width: elem.offsetWidth + (leftMargin * 2),
			height: elem.offsetHeight + (topMargin * 2)
		};
	}, margin);
};
