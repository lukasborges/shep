import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchTessely, closeTessely, inViewOverServices, repoRoot, serviceRecord, type Tessely } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';
import type { AppState } from '../../src/shared/channels.ts';
import type { ServiceState } from '../../src/shared/service.ts';

let tessely: Tessely;

test.beforeAll(async () => { tessely = await launchTessely(); });
test.afterAll(async () => { await closeTessely(tessely); });

test('opens one window titled Tessely, with the welcome page', async () => {
	expect(tessely.app.windows()).toHaveLength(1);
	expect(await tessely.window.title()).toBe('Tessely');
	await expect(tessely.window.locator('.welcome h1')).toHaveText('Welcome to Tessely');
});

test('names itself Tessely and reports the version in package.json, not Electron\'s', async () => {
	const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string };
	expect(await tessely.app.evaluate(({ app }) => app.getName())).toBe('Tessely');
	expect(await tessely.window.evaluate(() => window.tessely.invoke('app:getVersion'))).toBe(version);
});

test('runs the renderer isolated, without node', async () => {
	const reach = await tessely.window.evaluate(() => ({
		require: typeof (window as unknown as { require?: unknown }).require,
		process: typeof (window as unknown as { process?: unknown }).process
	}));
	expect(reach).toEqual({ require: 'undefined', process: 'undefined' });
});

test('refuses a channel the preload does not expose', async () => {
	const refused = await tessely.window.evaluate(async () => {
		try {
			await window.tessely.invoke('app:quit' as never);
			return 'called';
		} catch ( error ) {
			return String(error);
		}
	});
	expect(refused).toContain('not exposed to the renderer: app:quit');
});

test('uses the profile it was given, not the developer\'s', async () => {
	// a Mac's temporary folder is under /var, which is a link to /private/var
	expect(realpathSync(await tessely.app.evaluate(({ app }) => app.getPath('userData')))).toBe(realpathSync(tessely.userDataDir));
});

test('calls for the first service from a highlighted + in the rail, saying beside it and in the welcome what a service is', async () => {
	await expect(tessely.window.locator('.rail .add.no-service-yet')).toBeVisible();
	await expect(tessely.window.locator('.welcome .callout')).toHaveText('Add the first service');
	await expect(tessely.window.locator('.welcome')).toContainText('A service is a site you already use in the browser');
});

test('opens on All Services with + beside it before there is a workspace, then shows the first one on screen beside All Services', async () => {
	const tabs = () => tessely.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
	await expect.poll(tabs).toEqual(['All Services']);
	await expect(tessely.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'All Services');
	await expect(tessely.window.locator('.titlebar [role="tablist"] .separator')).toHaveCount(0);
	await expect(tessely.window.locator('.titlebar .add')).toHaveAttribute('aria-label', 'New Workspace');
	await tessely.window.evaluate(() => window.tessely.invoke('workspaces:save', null, 'Work'));
	await expect.poll(tabs).toEqual(['Work', 'All Services']);
	await expect(tessely.window.locator('.titlebar [role="tab"][aria-selected="true"]')).toHaveAttribute('aria-label', 'Work');
});

test('creates the first workspace along with the first service, under the name the add dialog fills in', async () => {
	const { server, at } = await serveFixtures();
	let fresh: Tessely | undefined;
	try {
		fresh = await launchTessely();
		const app = fresh;
		const inOverlay = <T>(expression: string) => inViewOverServices<T>(app, '#overlay', expression);
		await app.window.evaluate(() => window.tessely.invoke('overlay:open', { dialog: 'add' }));
		await expect.poll(() => inOverlay<string>('document.querySelector("input[name=workspaceName]")?.value ?? ""')).toBe('Personal');
		await inOverlay(`(() => {
			const field = document.querySelector('input[name=address]');
			field.value = ${JSON.stringify(at('127.0.0.1', '/service.html'))};
			field.dispatchEvent(new Event('input', { bubbles: true }));
			document.querySelector('form').requestSubmit();
		})()`);
		const tabs = () => app.window.locator('.titlebar [role="tab"]').evaluateAll(found => found.map(tab => tab.getAttribute('aria-label')));
		await expect.poll(tabs).toEqual(['Personal', 'All Services']);
		const { workspaces } = await app.window.evaluate(() => window.tessely.invoke('app:state')) as AppState;
		const [service] = await app.window.evaluate(() => window.tessely.invoke('services:list')) as ServiceState[];
		expect(service?.workspace).toBe(workspaces[0]?.id);
	} finally {
		await closeTessely(fresh);
		server.close();
	}
});

test('reads the settings a Shep profile kept in shep.json, from a copy under their new name', async () => {
	const userDataDir = mkdtempSync(join(tmpdir(), 'tessely-next-test-'));
	writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({ services: [serviceRecord('1', 'about:blank')], activeServiceId: '1' }));
	const fromShep = await launchTessely({ userDataDir });
	try {
		const services = await fromShep.window.evaluate(() => window.tessely.invoke('services:list')) as ServiceState[];
		expect(services.map(service => service.id)).toEqual(['1']);
		expect(existsSync(join(userDataDir, 'tessely.json'))).toBe(true);
	} finally {
		await closeTessely(fromShep);
	}
});
