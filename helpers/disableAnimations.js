module.exports = async (page) => {
	const client = await page.target().createCDPSession();
	await client.send('Animation.enable');
	return client.send('Animation.setPlaybackRate', { playbackRate: 100 });
};
