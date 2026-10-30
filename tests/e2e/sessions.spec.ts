import type { Server } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchShep, closeShep, inService, serviceRecord, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';
import type { AppState } from '../../src/shared/channels.ts';
import type { ServiceRecord } from '../../src/shared/service.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const add = (url: string, workspace: string) => shep.window.evaluate(([url, workspace]) =>
	window.shep.invoke('services:add', url, '', workspace), [url, workspace] as const) as Promise<string>;
const storageIn = (app: Shep, url: string) => app.app.evaluate(({ webContents }, url) =>
	webContents.getAllWebContents().find(contents => contents.getURL() === url)?.session.storagePath ?? null, url);
const storageOf = (url: string) => storageIn(shep, url);
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
	shep = await launchShep({ store: { workspaces: [{ id: 'w1', name: 'Work', hue: 'blue' }, { id: 'w2', name: 'Home', hue: 'green' }] } });
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('signs the services of a workspace in at once, apart from the other workspaces', async () => {
	const first = at('127.0.0.1', '/service.html');
	const second = at('127.0.0.1', '/away.html');
	const apart = at('127.0.0.1', '/long.html');
	await add(first, 'w2');
	await add(second, 'w2');
	await add(apart, 'w1');
	await expect.poll(() => storageOf(first)).toMatch(/[/\\]Partitions[/\\]workspace-w2$/);
	await expect.poll(() => storageOf(second)).toMatch(/[/\\]Partitions[/\\]workspace-w2$/);
	await expect.poll(() => storageOf(apart)).toMatch(/[/\\]Partitions[/\\]workspace-w1$/);

	await inService(shep, first, 'document.cookie = "signed=in"');
	expect(await cookies(second)).toContain('signed=in');
	expect(await cookies(apart)).not.toContain('signed=in');
});

test('signs a service into the session of the workspace it moves to, and the session it left goes once no service is in it', async () => {
	const apart = at('127.0.0.1', '/long.html');
	await inService(shep, apart, 'document.cookie = "second=account"');
	await shep.window.evaluate(() => window.shep.invoke('services:moveToWorkspace', '3', 'w2'));
	await expect.poll(() => storageOf(apart)).toMatch(/[/\\]Partitions[/\\]workspace-w2$/);
	expect(await cookies(apart)).toContain('signed=in');
	await expect.poll(() => shep.app.evaluate(async ({ session }) =>
		(await session.fromPartition('persist:workspace-w1').cookies.get({})).length)).toBe(0);
});

test('answers a window a service opened in its workspace\'s session as that service, under the key its answers were saved with when a service could sign in apart', async () => {
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

test('starts each workspace\'s session from the sign-ins its services had before, leaving out caches and redoing a copy left half done, puts the services in no workspace into a new one, and lets go of the sessions nothing uses', async () => {
	const page = at('127.0.0.1', '/service.html');
	const userDataDir = mkdtempSync(join(tmpdir(), 'shep-next-test-'));
	const before = await launchShep({ userDataDir });
	await before.app.evaluate(async ({ session }, url) => {
		const shared = session.fromPartition('persist:shared');
		await shared.cookies.set({ url, name: 'signed', value: 'in', expirationDate: Date.now() / 1000 + 3600 });
		await shared.cookies.flushStore();
	}, page);
	await before.app.close();

	const partitions = join(userDataDir, 'Partitions');
	mkdirSync(join(partitions, 'shared', 'Cache'), { recursive: true });
	writeFileSync(join(partitions, 'shared', 'Cache', 'rebuilt-by-chromium'), '');
	mkdirSync(join(partitions, 'workspace-w1.migrating'), { recursive: true });
	writeFileSync(join(partitions, 'workspace-w1.migrating', 'left-by-an-interrupted-copy'), '');
	mkdirSync(join(partitions, 'service-2'), { recursive: true });
	writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({
		services: [
			serviceRecord('1', page, { workspace: 'w1', partition: 'persist:shared' }),
			serviceRecord('2', at('localhost', '/away.html'), { partition: 'persist:service-2', enabled: false })
		],
		workspaces: [{ id: 'w1', name: 'Work', hue: 'blue' }]
	}));
	let after: Shep | undefined;
	try {
		after = await launchShep({ userDataDir });
		const app = after;
		await expect.poll(() => storageIn(app, page)).toMatch(/[/\\]Partitions[/\\]workspace-w1$/);
		expect(await inService<string>(app, page, 'document.cookie')).toContain('signed=in');
		expect(existsSync(join(partitions, 'workspace-w1', 'Cache', 'rebuilt-by-chromium'))).toBe(false);
		expect(existsSync(join(partitions, 'workspace-w1', 'left-by-an-interrupted-copy'))).toBe(false);
		expect(existsSync(join(partitions, 'workspace-w1.migrating'))).toBe(false);
		await expect.poll(() => existsSync(join(partitions, 'service-2')) || existsSync(join(partitions, 'shared'))).toBe(false);
		expect(await app.window.evaluate(() => window.shep.invoke('services:record', '1'))).not.toHaveProperty('partition');
		const { workspaces, migrating } = await app.window.evaluate(() => window.shep.invoke('app:state')) as AppState;
		expect(migrating).toBe(false);
		await expect(app.window.locator('.migrating')).toHaveCount(0);
		const personal = workspaces.find(workspace => workspace.name === 'Personal');
		expect(((await app.window.evaluate(() => window.shep.invoke('services:record', '2'))) as ServiceRecord).workspace).toBe(personal?.id);
		expect(existsSync(join(partitions, 'workspace-' + personal?.id))).toBe(true);
	} finally {
		await closeShep(after);
		rmSync(userDataDir, { recursive: true, force: true });
	}
});
