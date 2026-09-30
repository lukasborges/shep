import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asBase64DataUrl, dataUrlParts, faviconFor, imageWidth, manifestIcons, pickFavicon } from '../../src/main/favicon.ts';
import { withoutAppTokens } from '../../src/main/useragent.ts';

const png = (width: number) => {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47]);
	new DataView(bytes.buffer).setUint32(16, width);
	return bytes;
};

const ico = (...widths: number[]) => {
	const bytes = new Uint8Array(6 + widths.length * 16);
	const view = new DataView(bytes.buffer);
	view.setUint16(2, 1, true);
	view.setUint16(4, widths.length, true);
	widths.forEach((width, entry) => { bytes[6 + entry * 16] = width === 256 ? 0 : width; });
	return bytes;
};

test('reads the width of the formats favicons come in', () => {
	assert.equal(imageWidth(png(128), 'image/png'), 128);
	assert.equal(imageWidth(ico(16, 32, 256), 'image/x-icon'), 256);
	assert.equal(imageWidth(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 64, 0, 64, 0]), 'image/gif'), 64);
	assert.equal(imageWidth(new Uint8Array(0), 'image/svg+xml'), Infinity);
	assert.equal(imageWidth(new Uint8Array([1, 2, 3]), 'image/webp'), 0);
});

test('reads the width of a WebP, lossy, lossless or extended, whatever type it was served as', () => {
	// the first 30 bytes of a 40px lossy, a 50px lossless and a 60px WebP with alpha
	const webp = (hex: string) => Buffer.from(hex, 'hex');
	assert.equal(imageWidth(webp('5249464652000000574542505650382046000000d003009d012a28002800'), 'image/webp'), 40);
	assert.equal(imageWidth(webp('5249464622000000574542505650384c150000002f31400c000710fd8ffe'), 'image/png'), 50);
	assert.equal(imageWidth(webp('524946468000000057454250565038580a000000100000003b00003b0000'), 'image/webp'), 60);
});

test('takes the manifest icons meant for any use, never the maskable ones', () => {
	const manifest = { icons: [
		{ src: '/small.png', sizes: '16x16' },
		{ src: 'large.png', purpose: 'any maskable' },
		{ src: '/masked.svg', purpose: 'maskable' },
		{ sizes: '64x64' }
	] };
	assert.deepEqual(manifestIcons(manifest, 'https://example.test/app/manifest.json'),
		['https://example.test/small.png', 'https://example.test/app/large.png']);
	assert.deepEqual(manifestIcons('not a manifest', 'https://example.test/'), []);
});

const serving = (widths: Record<string, number>, manifest?: unknown) => async (url: string) => {
	if ( url.endsWith('/manifest.json') ) return Response.json(manifest);
	const width = widths[new URL(url).pathname];
	return width ? new Response(png(width), { headers: { 'content-type': 'image/png' } }) : new Response(null, { status: 404 });
};
const widthOf = (dataUrl: string | null) => imageWidth(dataUrlParts(dataUrl ?? '')?.bytes ?? new Uint8Array(), 'image/png');
const listing = { touchIcons: ['https://example.test/touch.png'], manifest: 'https://example.test/manifest.json' };

test('looks past blurry favicons to the manifest and touch icons for a sharp one', async () => {
	const fetcher = serving({ '/favicon.png': 16, '/touch.png': 180, '/app-64.png': 64 }, { icons: [{ src: '/app-64.png' }] });
	assert.equal(widthOf(await faviconFor(['https://example.test/favicon.png'], fetcher, async () => listing)), 64);
});

test('keeps a sharp favicon without asking the page for anything more', async () => {
	let asked = false;
	const fetcher = serving({ '/favicon.png': 48, '/touch.png': 180 });
	const favicon = await faviconFor(['https://example.test/favicon.png'], fetcher, async () => { asked = true; return listing; });
	assert.equal(widthOf(favicon), 48);
	assert.equal(asked, false);
});

test('keeps the blurry favicon when the page cannot be asked for more', async () => {
	const fetcher = serving({ '/favicon.png': 16 });
	assert.equal(widthOf(await faviconFor(['https://example.test/favicon.png'], fetcher, () => Promise.reject(new Error('page gone')))), 16);
});

test('picks the smallest favicon sharp at 24px on a 2x screen, or else the largest', () => {
	const at = (width: number) => ({ dataUrl: 'w' + width, width });
	assert.equal(pickFavicon([at(128), at(16), at(48), at(32)]), 'w48');
	assert.equal(pickFavicon([at(16), at(32)]), 'w32');
	assert.equal(pickFavicon([]), null);
});

test('re-encodes an inline SVG favicon in base64, so its quotes survive a CSS url()', () => {
	const inline = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
	const encoded = asBase64DataUrl(inline);
	assert.match(encoded ?? '', /^data:image\/svg\+xml;base64,/);
	assert.equal(dataUrlParts(encoded ?? '')?.bytes.toString(), "<svg xmlns='http://www.w3.org/2000/svg'/>");
});

test('strips the Shep and Electron tokens from the user agent and keeps Chrome', () => {
	const electron = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Shep/1.0.0 Chrome/152.0.7977.130 Electron/44.4.3 Safari/537.36';
	assert.equal(withoutAppTokens(electron), 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36');
});
