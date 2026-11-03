import { execFileSync } from 'node:child_process';
import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { launchTesselium, closeTesselium, serviceRecord, type Tesselium } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

// Playwright's clicks go straight to the page and never meet the window's title bar hit test,
// so these are the display server's own, sent with xdotool, which is X11's alone.
test.skip(process.platform !== 'linux', 'needs xdotool');

let tesselium: Tesselium;
let server: Server;

const countClicks = () => tesselium.app.evaluate(({ webContents }) => Promise.all(webContents.getAllWebContents().map(contents =>
	contents.executeJavaScript(`window.clicks = 0; if ( !window.counting ) { window.counting = true; addEventListener('pointerdown', () => window.clicks++, true); } 1`))));

const clicksIn = (fragment: string) => tesselium.app.evaluate(({ webContents }, fragment) => {
	const contents = webContents.getAllWebContents().find(candidate => candidate.getURL().includes(fragment));
	return contents ? contents.executeJavaScript('window.clicks ?? 0') as Promise<number> : -1;
}, fragment);

async function clickInTheWindow(x: number, y: number) {
	const window = await tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentBounds());
	if ( !window ) throw new Error('No window');
	execFileSync('xdotool', ['mousemove', String(window.x + x), String(window.y + y), 'click', '1']);
}

test.beforeAll(async () => {
	let at;
	({ server, at } = await serveFixtures());
	tesselium = await launchTesselium({ store: { services: [serviceRecord('1', at('127.0.0.1', '/drag.html'))], activeServiceId: '1' } });
	await expect.poll(() => clicksIn('/drag.html')).toBe(0);
});

test.afterAll(async () => {
	await closeTesselium(tesselium);
	server?.close();
});

test('keeps a page that marks itself as a title bar from taking the window\'s clicks', async () => {
	await countClicks();
	await clickInTheWindow(600, 400);
	await expect.poll(() => clicksIn('/drag.html')).toBe(1);
});

test('lets a dialog take its clicks over such a page', async () => {
	await tesselium.window.click('button[aria-label="Preferences"]');
	await expect.poll(() => clicksIn('#overlay')).not.toBe(-1);
	await countClicks();
	await clickInTheWindow(600, 400);
	await expect.poll(() => clicksIn('#overlay')).toBe(1);
});
