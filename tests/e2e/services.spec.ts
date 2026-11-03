import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import { launchTesselium, closeTesselium, inService, serviceRecord, type Tesselium } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let tesselium: Tesselium;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const serviceUrl = () => at('127.0.0.1', '/service.html');
const list = () => tesselium.window.evaluate(() => window.tesselium.invoke('services:list')) as Promise<ServiceState[]>;
const inFixture = <T>(expression: string) => inService<T>(tesselium, serviceUrl(), expression);

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	tesselium = await launchTesselium({
		store: {
			services: [
				serviceRecord('1', serviceUrl()),
				serviceRecord('2', at('127.0.0.1', '/away.html'), { media: true }),
				serviceRecord('3', at('[::1]', '/blurry.html'))
			],
			activeServiceId: '1'
		}
	});
	await expect.poll(async () => (await list()).find(service => service.id === '1')?.pageTitle).toBe('Fixture service');
});

test.afterAll(async () => {
	await closeTesselium(tesselium);
	server.close();
});

test('runs a service in its workspace\'s session, kept on disk, so a saved sign-in survives', async () => {
	const storage = await tesselium.app.evaluate(({ webContents }, url) =>
		webContents.getAllWebContents().find(contents => contents.getURL() === url)?.session.storagePath, serviceUrl());
	// the separator is whichever the system writes its paths with
	expect(storage).toMatch(/[/\\]Partitions[/\\]workspace-w[0-9a-z]+$/);
});

test('runs the service page isolated, sandboxed and without node', async () => {
	expect(await inFixture('({ require: typeof require, process: typeof process })')).toEqual({ require: 'undefined', process: 'undefined' });
});

test('tells the page it is Chromium, with nothing of Tesselium or Electron in the agent', async () => {
	const agent = await inFixture<string>('navigator.userAgent');
	expect(agent).toContain('Chrome/');
	expect(agent).not.toMatch(/Tesselium|Electron/);
});

test('counts unread from the page title and shows the active service instead of the welcome page', async () => {
	await inFixture('document.title = "(3) Fixture service"');
	await expect.poll(async () => (await list()).find(service => service.id === '1')?.unread).toBe(3);
	await expect(tesselium.window.locator('.welcome')).toHaveCount(0);
	await inFixture('document.title = "Fixture service"');
});

test('counts unread from the badge a page sets from its first script on, over its title, until the page clears it', async () => {
	const unread = async () => (await list()).find(service => service.id === '1')?.unread;
	expect(await inFixture('window.badgeWrappedWhenLoading')).toBe(true);
	await inFixture('document.title = "(3) Fixture service"');
	await inFixture('navigator.setAppBadge(7)');
	await expect.poll(unread).toBe(7);
	await inFixture('navigator.setAppBadge()');
	await expect.poll(unread).toBe('•');
	await inFixture('navigator.clearAppBadge()');
	await expect.poll(unread).toBe(3);
	await inFixture('document.title = "Fixture service"');
	await expect.poll(unread).toBe(0);
});

test('tells the page it runs as an installed app from its first script on, as some set their badge only then', async () => {
	expect(await inFixture('[window.installedWhenLoading, matchMedia("(display-mode: standalone)").matches, matchMedia("(display-mode: browser)").matches]')).toEqual([true, true, false]);
});

test('forgets a page\'s badge once the service loads another page, which sets its own', async () => {
	const unread = async () => (await list()).find(service => service.id === '1')?.unread;
	await inFixture('navigator.setAppBadge(7)');
	await expect.poll(unread).toBe(7);
	await inFixture('location.reload(), null');
	await expect.poll(unread).toBe(0);
	await expect.poll(async () => inFixture<boolean>('!!window.__tesseliumNotifications')).toBe(true);
});

const faviconWidth = async (id: string) => {
	await expect.poll(async () => (await list()).find(service => service.id === id)?.favicon ?? '').toMatch(/^data:image\/png;base64,/);
	return tesselium.window.evaluate(async id => {
		const state = (await window.tesselium.invoke('services:list') as { id: string; favicon: string }[]).find(service => service.id === id);
		const image = new Image();
		image.src = state?.favicon ?? '';
		await image.decode();
		return image.naturalWidth;
	}, id);
};

test('wears the sharpest small favicon the page lists, fetched through its session', async () => {
	expect(await faviconWidth('1')).toBe(64);
});

test('wears an icon from the manifest when every favicon the page lists is blurry', async () => {
	await expect.poll(() => faviconWidth('3')).toBe(64);
});

test('tells the service page the app\'s theme, which embedded content is not told on its own', async () => {
	const isDark = () => inFixture<boolean>('matchMedia("(prefers-color-scheme: dark)").matches');
	await tesselium.app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; });
	await expect.poll(isDark).toBe(true);
	await tesselium.app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
	await expect.poll(isDark).toBe(false);
});

test('tells a page the camera is refused only once the user refused it, since a page told so before never asks', async () => {
	const camera = (url: string) => inService<string>(tesselium, url, 'navigator.permissions.query({ name: "camera" }).then(status => status.state)');
	const remember = (permissions: Record<string, boolean>) => tesselium.app.evaluate(({ app: electronApp }, permissions) => {
		const fs = process.getBuiltinModule('node:fs');
		const file = electronApp.getPath('userData') + '/tesselium.json';
		fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), permissions }));
	}, permissions);
	expect(await camera(serviceUrl())).toBe('granted');
	try {
		await remember({ 'persist:service-1|media': false, 'persist:service-2|media': false });
		expect(await camera(serviceUrl())).toBe('denied');
		expect(await camera(at('127.0.0.1', '/away.html'))).toBe('granted');
	} finally {
		await remember({});
	}
});

test('opens a link to another site in a window of the app that shares the service\'s session', async () => {
	await inFixture('document.getElementById("elsewhere").click()');
	const sessions = () => tesselium.app.evaluate(({ BrowserWindow, webContents }, url) => {
		const auxiliary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/away.html'));
		const service = webContents.getAllWebContents().find(contents => contents.getURL() === url);
		return { auxiliary: auxiliary?.webContents.session.storagePath, service: service?.session.storagePath };
	}, serviceUrl());
	await expect.poll(async () => (await sessions()).auxiliary).toBeTruthy();
	const { auxiliary, service } = await sessions();
	expect(auxiliary).toBe(service);
	await tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/away.html'))?.close());
});

const ctrlClick = async (id: string) => {
	const { x, y } = await inFixture<{ x: number; y: number }>(`(({ x, y }) => ({ x: x + 5, y: y + 5 }))(document.getElementById(${JSON.stringify(id)}).getBoundingClientRect())`);
	await tesselium.app.evaluate(({ webContents }, { url, x, y }) => {
		const contents = webContents.getAllWebContents().find(candidate => candidate.getURL() === url);
		const [keyCode, modifier] = process.platform === 'darwin' ? ['Meta', 'meta'] as const : ['Control', 'control'] as const;
		const modifiers = [modifier];
		contents?.focus();
		contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
		contents?.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1, modifiers });
		contents?.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1, modifiers });
		contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: [] });
	}, { url: serviceUrl(), x, y });
};

const openedInTheBrowser = () => tesselium.app.evaluate(() => (globalThis as { opened?: string[] }).opened);

test.describe('links clicked with Ctrl, or ⌘ on a Mac', () => {
	test.beforeAll(async () => {
		await tesselium.app.evaluate(({ shell }) => {
			const opened: string[] = [];
			(globalThis as { opened?: string[] }).opened = opened;
			shell.openExternal = async url => { opened.push(url); };
		});
	});

	test('open in the browser, though another service owns their site', async () => {
		await ctrlClick('elsewhere');
		await expect.poll(openedInTheBrowser).toContain(at('127.0.0.1', '/away.html'));
		expect(await tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
		expect((await list()).find(service => service.active)?.id).toBe('1');
	});

	test('open in the browser when the page opens them a while after the click, as Meet does', async () => {
		await ctrlClick('later');
		await expect.poll(openedInTheBrowser).toContain(at('127.0.0.1', '/away.html?later'));
		expect(await tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	});
});

test('hands a sign-in that left the service back to the service\'s own page, and closes its window', async () => {
	await inFixture(`window.open(${JSON.stringify(at('localhost', '/away.html'))}), null`);
	await expect.poll(() => tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.webContents.getURL().includes('localhost')))).toBe(true);
	const back = serviceUrl() + '?signed-in=1';
	await tesselium.app.evaluate(({ BrowserWindow }, back) => {
		const auxiliary = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('localhost'));
		auxiliary?.webContents.executeJavaScript(`location.href = ${JSON.stringify(back)}`);
	}, back);
	await expect.poll(() => tesselium.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	await expect.poll(() => tesselium.app.evaluate(({ webContents }) => webContents.getAllWebContents().some(contents => contents.getURL().endsWith('?signed-in=1')))).toBe(true);
});

test('goes back in the service with Alt and the left arrow, or Command and the bracket on a Mac', async () => {
	// the second service already sits on away.html, so this one goes to an address of its own
	const away = at('127.0.0.1', '/away.html?from=first-service');
	await inFixture(`location.href = ${JSON.stringify(away)}`);
	const loadedAway = () => tesselium.app.evaluate(({ webContents }, away) => webContents.getAllWebContents().some(contents => contents.getURL() === away && !contents.isLoading()), away);
	await expect.poll(loadedAway).toBe(true);
	await tesselium.app.evaluate(({ webContents }, away) => {
		const contents = webContents.getAllWebContents().find(candidate => candidate.getURL() === away);
		const [keyCode, modifier] = process.platform === 'darwin' ? ['[', 'meta'] as const : ['Left', 'alt'] as const;
		contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: [modifier] });
		contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: [modifier] });
	}, away);
	await expect.poll(() => tesselium.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL().startsWith(url)), serviceUrl())).toBe(true);
});

test('hands a sign-in back to the address the service was added with, though its page sits on another site', async () => {
	let other: Tesselium | undefined;
	try {
		// signed out, the service's address sends it elsewhere, as chat.google.com does to workspace.google.com
		const address = at('localhost', '/go?to=' + encodeURIComponent(at('127.0.0.1', '/away.html?product-page')));
		other = await launchTesselium({ store: { services: [serviceRecord('1', address)], activeServiceId: '1' } });
		const app = other;
		const onPage = (prefix: string) => app.app.evaluate(({ webContents }, prefix) => webContents.getAllWebContents().some(contents => contents.getURL().startsWith(prefix)), prefix);
		await expect.poll(() => onPage(at('127.0.0.1', '/away.html?product-page'))).toBe(true);

		await inService(app, at('127.0.0.1', '/away.html?product-page'), `window.open(${JSON.stringify(at('[::1]', '/away.html?sign-in'))}), null`);
		await expect.poll(() => onPage(at('[::1]', '/away.html?sign-in'))).toBe(true);
		await app.app.evaluate(({ BrowserWindow }, back) => {
			const signIn = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('sign-in'));
			signIn?.webContents.executeJavaScript(`location.href = ${JSON.stringify(back)}`);
		}, at('localhost', '/service.html?signed-in'));

		await expect.poll(() => app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
		await expect.poll(() => onPage(at('localhost', '/service.html?signed-in'))).toBe(true);
	} finally {
		await closeTesselium(other);
	}
});

test('opens a link to another service\'s site in that service, showing its workspace, not in a window', async () => {
	let other: Tesselium | undefined;
	try {
		other = await launchTesselium({
			store: {
				services: [
					serviceRecord('1', at('127.0.0.1', '/service.html'), { workspace: 'here' }),
					serviceRecord('2', at('localhost', '/away.html'), { workspace: 'elsewhere' })
				],
				workspaces: [{ id: 'here', name: 'Here', hue: 'green', icon: null }, { id: 'elsewhere', name: 'Elsewhere', hue: 'blue', icon: null }],
				activeWorkspace: 'here',
				activeServiceId: '1'
			}
		});
		const app = other;
		const meeting = at('localhost', '/away.html?meeting');
		await expect.poll(() => app.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url && !contents.isLoading()), at('127.0.0.1', '/service.html'))).toBe(true);
		await inService(app, at('127.0.0.1', '/service.html'), `window.open(${JSON.stringify(meeting)}), null`);
		await expect.poll(() => app.app.evaluate(({ webContents }, meeting) => webContents.getAllWebContents().some(contents => contents.getURL() === meeting), meeting)).toBe(true);
		const active = await app.window.evaluate(() => window.tesselium.invoke('services:list')) as ServiceState[];
		expect(active.find(service => service.active)?.id).toBe('2');
		expect(await app.window.evaluate(() => window.tesselium.invoke('app:state').then(state => (state as { activeWorkspace: string }).activeWorkspace))).toBe('elsewhere');
		expect(await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	} finally {
		await closeTesselium(other);
	}
});

test('keeps running when a removed service\'s page asks for something after it is gone', async () => {
	let other: Tesselium | undefined;
	try {
		other = await launchTesselium({ store: { services: [serviceRecord('3', at('127.0.0.1', '/service.html'))], activeServiceId: '3' } });
		const app = other;
		await expect.poll(() => app.app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url), at('127.0.0.1', '/service.html'))).toBe(true);
		await expect.poll(async () => ((await app.window.evaluate(() => window.tesselium.invoke('services:list'))) as ServiceState[])[0]?.favicon).toBeTruthy();
		// the store reads its file on every get, so this is the service gone while its page lives on
		await app.app.evaluate(({ app: electronApp }) => {
			const fs = process.getBuiltinModule('node:fs');
			const file = electronApp.getPath('userData') + '/tesselium.json';
			const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
			fs.writeFileSync(file, JSON.stringify({ ...saved, services: [] }));
		});
		expect(await inService<string>(app, at('127.0.0.1', '/service.html'), 'navigator.permissions.query({ name: "camera" }).then(status => status.state)')).toBe('denied');
		expect(await inService<boolean>(app, at('127.0.0.1', '/service.html'), 'window.tesseliumService.mayNotify()')).toBe(false);
		expect(await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
	} finally {
		await closeTesselium(other);
	}
});
