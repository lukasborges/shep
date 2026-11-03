import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import { hashPassword } from '../../src/main/password.ts';
import { launchTesselium, closeTesselium, inService, serviceRecord, type Tesselium } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

test.beforeAll(async () => { ({ server, at } = await serveFixtures()); });
test.afterAll(() => { server.close(); });

const twoServices = () => [serviceRecord('1', at('127.0.0.1', '/service.html'), { name: 'First' }), serviceRecord('2', at('127.0.0.1', '/long.html'), { name: 'Second' })];
const inOverlay = <T>(tesselium: Tesselium, expression: string) => tesselium.app.evaluate(async ({ webContents }, expression) =>
	webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'))?.executeJavaScript(expression), expression) as Promise<T>;
const visibleServiceViews = (tesselium: Tesselium) => tesselium.app.evaluate(({ BrowserWindow }) =>
	BrowserWindow.getAllWindows()[0]?.contentView.children.filter(view => view.getVisible() && !(view as unknown as { webContents: Electron.WebContents }).webContents.getURL().endsWith('#overlay')).length);
const list = (tesselium: Tesselium) => tesselium.window.evaluate(() => window.tesselium.invoke('services:list')) as Promise<ServiceState[]>;
const fill = (tesselium: Tesselium, fields: Record<string, string>) => inOverlay(tesselium, `(() => {
	for ( const [name, value] of Object.entries(${JSON.stringify(fields)}) ) {
		const field = document.querySelector('input[name=' + name + ']');
		field.value = value;
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}
	document.querySelector('form').requestSubmit();
})()`);
// through before-input-event, which fill skips
const typeInOverlay = (tesselium: Tesselium, keys: string) => tesselium.app.evaluate(({ webContents }, keys) => {
	const overlay = webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'));
	for ( const key of keys ) {
		overlay?.sendInputEvent({ type: 'keyDown', keyCode: key });
		overlay?.sendInputEvent({ type: 'char', keyCode: key });
		overlay?.sendInputEvent({ type: 'keyUp', keyCode: key });
	}
}, keys);
const loaded = (tesselium: Tesselium, url: string) => tesselium.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url && !contents.isLoading()), url);

test('asks for a password the first time it locks, then hides every service and ignores shortcuts until unlocked', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: twoServices(), activeServiceId: '1' } });
		const app = tesselium;
		await expect.poll(() => visibleServiceViews(app)).toBe(1);

		await app.window.locator('.rail .tool[aria-label="Lock"]').click();
		await expect.poll(() => inOverlay<boolean>(app, '!!document.querySelector("input[name=repeated]")')).toBe(true);
		await fill(app, { password: 'sheepdog', repeated: 'sheepdog' });
		await expect.poll(() => inOverlay<boolean>(app, '!!document.querySelector(".lock")')).toBe(true);
		expect(await visibleServiceViews(app)).toBe(0);

		await app.app.evaluate(({ BrowserWindow }) => {
			const contents = BrowserWindow.getAllWindows()[0]?.webContents;
			contents?.sendInputEvent({ type: 'keyDown', keyCode: '2', modifiers: ['control'] });
		});
		await new Promise(resolve => setTimeout(resolve, 300));
		expect((await list(app)).find(service => service.active)?.name).toBe('First');

		await fill(app, { password: 'wolf' });
		await expect.poll(() => inOverlay<string>(app, 'document.querySelector("[role=alert]")?.textContent ?? ""')).toContain('not the password');
		await inOverlay(app, 'document.querySelector("input[name=password]").focus()');
		await typeInOverlay(app, 'sheepdog');
		await expect.poll(() => inOverlay<string>(app, 'document.querySelector("input[name=password]").value')).toBe('sheepdog');
		await inOverlay(app, 'document.querySelector("form").requestSubmit()');
		await expect.poll(() => visibleServiceViews(app)).toBe(1);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('stays locked across a restart, so quitting is no way past the lock', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: twoServices(), activeServiceId: '1', lockPasswordHash: hashPassword('sheepdog'), locked: true } });
		const app = tesselium;
		await expect.poll(() => inOverlay<boolean>(app, '!!document.querySelector(".lock")')).toBe(true);
		await expect.poll(() => loaded(app, at('127.0.0.1', '/service.html'))).toBe(true);
		expect(await visibleServiceViews(app)).toBe(0);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('locks on start when that is the preference and there is a password', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: twoServices(), lockPasswordHash: hashPassword('sheepdog'), preferences: { lockOnStart: true } } });
		const app = tesselium;
		await expect.poll(() => inOverlay<boolean>(app, '!!document.querySelector(".lock")')).toBe(true);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('hides the window on close while the tray has its icon, and keeps running', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: twoServices() } });
		const app = tesselium;
		await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
		await expect.poll(() => app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => window.isVisible()))).toEqual([false]);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('starts hidden in the tray when asked to start minimized', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { preferences: { startMinimized: true } } });
		const app = tesselium;
		await new Promise(resolve => setTimeout(resolve, 800));
		expect(await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(false);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('checks spelling in the languages picked in Preferences', async () => {
	test.skip(process.platform === 'darwin', 'a Mac checks spelling with its own checker, in the languages it is set to');
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: twoServices(), preferences: { spellcheckLanguages: ['pt-BR'] } } });
		const app = tesselium;
		await expect.poll(() => loaded(app, at('127.0.0.1', '/service.html'))).toBe(true);
		const languages = await app.app.evaluate(({ webContents }, url) =>
			webContents.getAllWebContents().find(contents => contents.getURL() === url)?.session.getSpellCheckerLanguages(), at('127.0.0.1', '/service.html'));
		expect(languages).toEqual(['pt-BR']);
	} finally {
		await closeTesselium(tesselium);
	}
});

// Where the system has no picker, X11 here, the app asks; a service for calls, or the screen permission is asked first.
test('asks which screen or window to share, hands the page the choice, and keeps running', async () => {
	test.skip(process.platform === 'darwin', 'a Mac opens its own picker, which nothing here can click');
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: [serviceRecord('1', at('127.0.0.1', '/service.html'), { media: true })], activeServiceId: '1' } });
		const app = tesselium;
		await expect.poll(() => loaded(app, at('127.0.0.1', '/service.html'))).toBe(true);
		let settled = '';
		const answer = inService<string>(app, at('127.0.0.1', '/service.html'),
			'navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => stream.getVideoTracks()[0].kind, error => "refused: " + error.name)', { userGesture: true })
			.then(result => { settled = result; return result; });
		// Xvfb lists the app's own window some runs and nothing on others, where the page is refused at once
		const pickerSources = () => inOverlay<number | undefined>(app, 'document.querySelectorAll(".picker .sources button").length');
		await expect.poll(async () => settled !== '' || ((await pickerSources()) ?? 0) > 0, { timeout: 10000 }).toBe(true);
		if ( !settled ) await inOverlay(app, '[...document.querySelectorAll(".picker footer button")].find(button => button.textContent.trim() === "Share").click()');
		expect(await answer).toMatch(/^(video|refused: \w+)$/);
		expect(await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	} finally {
		await closeTesselium(tesselium);
	}
});

test('shows the screens and windows to pick from, and closes once one is chosen', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium();
		const app = tesselium;
		const sources = [{ id: 'screen:0:0', name: 'Entire Screen', thumbnail: '' }, { id: 'window:1:0', name: 'Terminal', thumbnail: '' }];
		await app.window.evaluate(sources => window.tesselium.invoke('overlay:open', { dialog: 'screenPicker', sources }), sources);
		await expect.poll(() => inOverlay<string[]>(app, '[...document.querySelectorAll(".picker .sources span")].map(span => span.textContent)')).toEqual(['Entire Screen', 'Terminal']);
		await inOverlay(app, '[...document.querySelectorAll(".picker footer button")].find(button => button.textContent.trim() === "Share").click()');
		const overlayShown = () => app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.contentView.children
			.some(view => (view as unknown as { webContents: Electron.WebContents }).webContents.getURL().endsWith('#overlay') && view.getVisible()));
		await expect.poll(overlayShown).toBe(false);
	} finally {
		await closeTesselium(tesselium);
	}
});
