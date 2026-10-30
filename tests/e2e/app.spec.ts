import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchShep, closeShep, inViewOverServices, repoRoot, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';
import type { AppState } from '../../src/shared/channels.ts';
import type { ServiceState } from '../../src/shared/service.ts';

let shep: Shep;

test.beforeAll(async () => { shep = await launchShep(); });
test.afterAll(async () => { await closeShep(shep); });

test('opens one window titled Shep, with the welcome page', async () => {
	expect(shep.app.windows()).toHaveLength(1);
	expect(await shep.window.title()).toBe('Shep');
	await expect(shep.window.locator('.welcome h1')).toHaveText('Welcome to Shep');
});

test('names itself Shep and reports the version in package.json, not Electron\'s', async () => {
	const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string };
	expect(await shep.app.evaluate(({ app }) => app.getName())).toBe('Shep');
	expect(await shep.window.evaluate(() => window.shep.invoke('app:getVersion'))).toBe(version);
});

test('runs the renderer isolated, without node', async () => {
	const reach = await shep.window.evaluate(() => ({
		require: typeof (window as unknown as { require?: unknown }).require,
		process: typeof (window as unknown as { process?: unknown }).process
	}));
	expect(reach).toEqual({ require: 'undefined', process: 'undefined' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await shep.window.evaluate(async () => {
		try {
			await window.shep.invoke('app:quit' as never);
			return 'called';
		} catch ( error ) {
			return String(error);
		}
	});
	expect(refused).toContain('not exposed to the renderer: app:quit');
});

test('uses the profile it was given, not the developer\'s', async () => {
	// a Mac's temporary folder is under /var, which is a link to /private/var
	expect(realpathSync(await shep.app.evaluate(({ app }) => app.getPath('userData')))).toBe(realpathSync(shep.userDataDir));
});

test('calls for the first service from a highlighted + in the rail, saying beside it and in the welcome what a service is', async () => {
	await expect(shep.window.locator('.rail .add.no-service-yet')).toBeVisible();
	await expect(shep.window.locator('.welcome .callout')).toHaveText('Add the first service');
	await expect(shep.window.locator('.welcome')).toContainText('A service is a site you already use in the browser');
});

test('opens on All Services with + beside it before there is a workspace, then shows the first one on screen beside All Services', async () => {
	const tabs = () => shep.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
	await expect.poll(tabs).toEqual(['All Services']);
	await expect(shep.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'All Services');
	await expect(shep.window.locator('.titlebar [role="tablist"] .separator')).toHaveCount(0);
	await expect(shep.window.locator('.titlebar .add')).toHaveAttribute('aria-label', 'New Workspace');
	await shep.window.evaluate(() => window.shep.invoke('workspaces:save', null, 'Work'));
	await expect.poll(tabs).toEqual(['Work', 'All Services']);
	await expect(shep.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'Work');
});

test('creates the first workspace along with the first service, under the name the add dialog fills in', async () => {
	const { server, at } = await serveFixtures();
	let fresh: Shep | undefined;
	try {
		fresh = await launchShep();
		const app = fresh;
		const inOverlay = <T>(expression: string) => inViewOverServices<T>(app, '#overlay', expression);
		await app.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'add' }));
		await expect.poll(() => inOverlay<string>('document.querySelector("input[name=workspaceName]")?.value ?? ""')).toBe('Personal');
		await inOverlay(`(() => {
			const field = document.querySelector('input[name=address]');
			field.value = ${JSON.stringify(at('127.0.0.1', '/service.html'))};
			field.dispatchEvent(new Event('input', { bubbles: true }));
			document.querySelector('form').requestSubmit();
		})()`);
		const tabs = () => app.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
		await expect.poll(tabs).toEqual(['Personal', 'All Services']);
		const { workspaces } = await app.window.evaluate(() => window.shep.invoke('app:state')) as AppState;
		const [service] = await app.window.evaluate(() => window.shep.invoke('services:list')) as ServiceState[];
		expect(service?.workspace).toBe(workspaces[0]?.id);
	} finally {
		await closeShep(fresh);
		server.close();
	}
});
