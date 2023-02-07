import { Puppeteer } from 'puppeteer';
import { QueryHandler } from 'query-selector-shadow-dom/plugins/puppeteer/index.js';

export default function() {
	const handlerNames = Puppeteer.customQueryHandlerNames();

	if (handlerNames.includes('shadow')) {
		return;
	}

	Puppeteer.registerCustomQueryHandler('shadow', QueryHandler);
}
