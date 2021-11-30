export default async function disableAnimations(page) {
	const client = await page.target().createCDPSession();
	await client.send('Animation.enable');
	return client.send('Animation.setPlaybackRate', { playbackRate: 100 });
}
