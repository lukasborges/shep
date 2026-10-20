import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { launchShep, closeShep, inService, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const add = (url: string, ownSession: boolean) => shep.window.evaluate(([url, ownSession]) =>
	window.shep.invoke('services:add', url, '', '', ownSession), [url, ownSession] as const) as Promise<string>;
const storageOf = (url: string) => shep.app.evaluate(({ webContents }, url) =>
	webContents.getAllWebContents().find(contents => contents.getURL() === url)?.session.storagePath ?? null, url);
const cookies = (url: string) => inService<string>(shep, url, 'document.cookie');
const CAMERA = 'navigator.permissions.query({ name: "camera" }).then(status => status.state)';
const remember = (permissions: Record<string, boolean>) => shep.app.evaluate(({ app: electronApp }, permissions) => {
	const fs = process.getBuiltinModule('node:fs');
	const file = electronApp.getPath('userData') + '/shep.json';
	fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), permissions }));
}, permissions);
const inOpenedWindow = <T>(path: string, expression: string) => shep.app.evaluate(({ BrowserWindow }, { path, expression }) =>
	BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith(path))?.webContents.executeJavaScript(expression) ?? null,
{ path, expression }) as Promise<T | null>;

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep();
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('signs every service in at once, unless one asks for a session of its own', async () => {
	const first = at('127.0.0.1', '/service.html');
	const second = at('127.0.0.1', '/away.html');
	const apart = at('127.0.0.1', '/long.html');
	await add(first, false);
	await add(second, false);
	await add(apart, true);
	await expect.poll(() => storageOf(first)).toMatch(/[/\\]Partitions[/\\]shared$/);
	await expect.poll(() => storageOf(second)).toMatch(/[/\\]Partitions[/\\]shared$/);
	await expect.poll(() => storageOf(apart)).toMatch(/[/\\]Partitions[/\\]service-3$/);

	await inService(shep, first, 'document.cookie = "signed=in"');
	expect(await cookies(second)).toContain('signed=in');
	expect(await cookies(apart)).not.toContain('signed=in');
});

test('signs a service out of the session it leaves, and the session it left goes', async () => {
	const apart = at('127.0.0.1', '/long.html');
	await inService(shep, apart, 'document.cookie = "second=account"');
	await shep.window.evaluate(url => window.shep.invoke('services:update', '3', url, '', '', false), apart);
	await expect.poll(() => storageOf(apart)).toMatch(/[/\\]Partitions[/\\]shared$/);
	expect(await cookies(apart)).toContain('signed=in');
	await expect.poll(() => shep.app.evaluate(async ({ session }) =>
		(await session.fromPartition('persist:service-3').cookies.get({})).length)).toBe(0);
});

test('answers a window a service opened in the shared session as that service, under the key its own session would have', async () => {
	const first = at('127.0.0.1', '/service.html');
	const second = at('127.0.0.1', '/away.html');
	try {
		await remember({ 'persist:service-2|media': false });
		expect(await inService(shep, second, CAMERA)).toBe('denied');
		await inService(shep, first, 'document.getElementById("elsewhere").click()');
		await expect.poll(() => inOpenedWindow<string>('/away.html', CAMERA)).toBe('granted');
	} finally {
		await remember({});
		await shep.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/away.html'))?.close());
	}
});
