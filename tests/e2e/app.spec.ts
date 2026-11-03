import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchTesselium, closeTesselium, inViewOverServices, repoRoot, serviceRecord, type Tesselium } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';
import type { AppState } from '../../src/shared/channels.ts';
import type { ServiceState } from '../../src/shared/service.ts';

let tesselium: Tesselium;

test.beforeAll(async () => { tesselium = await launchTesselium(); });
test.afterAll(async () => { await closeTesselium(tesselium); });

test('opens one window titled Tesselium, with the welcome page', async () => {
	expect(tesselium.app.windows()).toHaveLength(1);
	expect(await tesselium.window.title()).toBe('Tesselium');
	await expect(tesselium.window.locator('.welcome h1')).toHaveText('Welcome to Tesselium');
});

test('names itself Tesselium and reports the version in package.json, not Electron\'s', async () => {
	const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string };
	expect(await tesselium.app.evaluate(({ app }) => app.getName())).toBe('Tesselium');
	expect(await tesselium.window.evaluate(() => window.tesselium.invoke('app:getVersion'))).toBe(version);
});

test('runs the renderer isolated, without node', async () => {
	const reach = await tesselium.window.evaluate(() => ({
		require: typeof (window as unknown as { require?: unknown }).require,
		process: typeof (window as unknown as { process?: unknown }).process
	}));
	expect(reach).toEqual({ require: 'undefined', process: 'undefined' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await tesselium.window.evaluate(async () => {
		try {
			await window.tesselium.invoke('app:quit' as never);
			return 'called';
		} catch ( error ) {
			return String(error);
		}
	});
	expect(refused).toContain('not exposed to the renderer: app:quit');
});

test('uses the profile it was given, not the developer\'s', async () => {
	// a Mac's temporary folder is under /var, which is a link to /private/var
	expect(realpathSync(await tesselium.app.evaluate(({ app }) => app.getPath('userData')))).toBe(realpathSync(tesselium.userDataDir));
});

test('calls for the first service from a highlighted + in the rail, saying beside it and in the welcome what a service is', async () => {
	await expect(tesselium.window.locator('.rail .add.no-service-yet')).toBeVisible();
	await expect(tesselium.window.locator('.welcome .callout')).toHaveText('Add the first service');
	await expect(tesselium.window.locator('.welcome')).toContainText('A service is a site you already use in the browser');
});

test('opens on All Services with + beside it before there is a workspace, then shows the first one on screen beside All Services', async () => {
	const tabs = () => tesselium.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
	await expect.poll(tabs).toEqual(['All Services']);
	await expect(tesselium.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'All Services');
	await expect(tesselium.window.locator('.titlebar [role="tablist"] .separator')).toHaveCount(0);
	await expect(tesselium.window.locator('.titlebar .add')).toHaveAttribute('aria-label', 'New Workspace');
	await tesselium.window.evaluate(() => window.tesselium.invoke('workspaces:save', null, 'Work'));
	await expect.poll(tabs).toEqual(['Work', 'All Services']);
	await expect(tesselium.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'Work');
});

test('creates the first workspace along with the first service, under the name the add dialog fills in', async () => {
	const { server, at } = await serveFixtures();
	let fresh: Tesselium | undefined;
	try {
		fresh = await launchTesselium();
		const app = fresh;
		const inOverlay = <T>(expression: string) => inViewOverServices<T>(app, '#overlay', expression);
		await app.window.evaluate(() => window.tesselium.invoke('overlay:open', { dialog: 'add' }));
		await expect.poll(() => inOverlay<string>('document.querySelector("input[name=workspaceName]")?.value ?? ""')).toBe('Personal');
		await inOverlay(`(() => {
			const field = document.querySelector('input[name=address]');
			field.value = ${JSON.stringify(at('127.0.0.1', '/service.html'))};
			field.dispatchEvent(new Event('input', { bubbles: true }));
			document.querySelector('form').requestSubmit();
		})()`);
		const tabs = () => app.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
		await expect.poll(tabs).toEqual(['Personal', 'All Services']);
		const { workspaces } = await app.window.evaluate(() => window.tesselium.invoke('app:state')) as AppState;
		const [service] = await app.window.evaluate(() => window.tesselium.invoke('services:list')) as ServiceState[];
		expect(service?.workspace).toBe(workspaces[0]?.id);
	} finally {
		await closeTesselium(fresh);
		server.close();
	}
});

test('reads the settings a Shep profile kept in shep.json, from a copy under their new name', async () => {
	const userDataDir = mkdtempSync(join(tmpdir(), 'tesselium-next-test-'));
	writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({ services: [serviceRecord('1', 'about:blank')], activeServiceId: '1' }));
	const fromShep = await launchTesselium({ userDataDir });
	try {
		const services = await fromShep.window.evaluate(() => window.tesselium.invoke('services:list')) as ServiceState[];
		expect(services.map(service => service.id)).toEqual(['1']);
		expect(existsSync(join(userDataDir, 'tesselium.json'))).toBe(true);
	} finally {
		await closeTesselium(fromShep);
	}
});

test('reads the settings a Tessely profile kept in tessely.json, over an older shep.json beside it', async () => {
	const userDataDir = mkdtempSync(join(tmpdir(), 'tesselium-next-test-'));
	writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({ services: [serviceRecord('1', 'about:blank')], activeServiceId: '1' }));
	writeFileSync(join(userDataDir, 'tessely.json'), JSON.stringify({ services: [serviceRecord('2', 'about:blank')], activeServiceId: '2' }));
	const fromTessely = await launchTesselium({ userDataDir });
	try {
		const services = await fromTessely.window.evaluate(() => window.tesselium.invoke('services:list')) as ServiceState[];
		expect(services.map(service => service.id)).toEqual(['2']);
	} finally {
		await closeTesselium(fromTessely);
	}
});
