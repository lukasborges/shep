import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import type { AppState } from '../../src/shared/channels.ts';
import type { Preferences } from '../../src/shared/preferences.ts';
import { launchTessely, closeTessely, serviceRecord, type Tessely } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let tessely: Tessely;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const prefs = () => tessely.window.evaluate(() => window.tessely.invoke('preferences:get')) as Promise<Preferences>;
const setPref = (key: keyof Preferences, value: unknown) => tessely.window.evaluate(([key, value]) => window.tessely.invoke('preferences:set', key, value), [key, value] as const) as Promise<boolean>;
const inOverlay = <T>(expression: string) => tessely.app.evaluate(async ({ webContents }, expression) =>
	webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'))?.executeJavaScript(expression), expression) as Promise<T>;
const savedFile = () => tessely.app.evaluate(({ app }) => process.getBuiltinModule('node:fs').readFileSync(app.getPath('userData') + '/tessely.json', 'utf8'));

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	tessely = await launchTessely({ store: { services: [serviceRecord('1', at('127.0.0.1', '/service.html'), { name: 'First' })], activeServiceId: '1' } });
});

test.afterAll(async () => {
	await closeTessely(tessely);
	server.close();
});

test('opens Preferences from the gear on the rail, in five sections', async () => {
	await tessely.window.locator('.rail .tool[aria-label="Preferences"]').click();
	await expect.poll(() => inOverlay<string[]>('[...document.querySelectorAll(".preferences nav button")].map(button => button.textContent.trim())'))
		.toEqual(['Appearance', 'Window', 'Services', 'Security', 'Advanced']);
});

test('applies the style at once, and keeps it', async () => {
	await setPref('theme', 'dark');
	expect(await tessely.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
	expect((JSON.parse(await savedFile()) as { preferences: Preferences }).preferences.theme).toBe('dark');
	await setPref('theme', 'system');
});

test('resolves the language, the system\'s when none is picked', async () => {
	await setPref('language', 'pt-BR');
	expect(((await tessely.window.evaluate(() => window.tessely.invoke('app:state'))) as AppState).language).toBe('pt-BR');
	await setPref('language', 'auto');
	expect(((await tessely.window.evaluate(() => window.tessely.invoke('app:state'))) as AppState).language).toBe(await tessely.app.evaluate(({ app }) => app.getLocale()));
});

test('speaks the language picked, in the window and in Preferences, at once', async () => {
	await setPref('language', 'pt-BR');
	await expect(tessely.window.locator('.titlebar button[aria-label="Voltar"]')).toBeVisible();
	await expect.poll(() => inOverlay<string>('document.querySelector(".preferences nav h2")?.textContent ?? ""')).toBe('Preferências');
	await setPref('language', 'auto');
	await expect(tessely.window.locator('.titlebar button[aria-label="Back"]')).toBeVisible();
});

test('keeps the window above others at once', async () => {
	await setPref('alwaysOnTop', true);
	expect(await tessely.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isAlwaysOnTop())).toBe(true);
	await setPref('alwaysOnTop', false);
});

test('refuses a value that is not one the preference can have', async () => {
	await setPref('proxyPort', 70000);
	await setPref('theme', 'sepia');
	expect(await prefs()).toMatchObject({ proxyPort: 8080, theme: 'system' });
});

test('sends a service through the proxy as soon as it is set', async () => {
	await setPref('proxyHost', 'proxy.invalid');
	await setPref('proxyPort', 3128);
	await setPref('proxyEnabled', true);
	const resolved = await tessely.app.evaluate(({ webContents }, url) =>
		webContents.getAllWebContents().find(contents => contents.getURL().startsWith(url))?.session.resolveProxy('https://example.com/'), at('127.0.0.1', '/service.html'));
	expect(resolved).toBe('PROXY proxy.invalid:3128');
	await setPref('proxyEnabled', false);
});

test('says when a preference takes a restart, and offers one', async () => {
	await inOverlay('[...document.querySelectorAll(".preferences nav button")].find(button => button.textContent.trim() === "Advanced").click()');
	await inOverlay('document.querySelector(".preferences [role=switch][aria-label=\\"Hardware acceleration\\"]").click()');
	await expect.poll(() => inOverlay<string>('document.querySelector(".relaunch")?.textContent ?? ""')).toContain('Restart Now');
	await setPref('hardwareAcceleration', true);
});

test('keeps a lock password as a salted hash, and offers to ask for it on start', async () => {
	await inOverlay('[...document.querySelectorAll(".preferences nav button")].find(button => button.textContent.trim() === "Security").click()');
	await inOverlay('[...document.querySelectorAll(".preferences button")].find(button => button.textContent.trim() === "Set Password…").click()');
	await expect.poll(() => inOverlay<boolean>('!!document.querySelector("input[name=repeated]")')).toBe(true);
	await inOverlay(`(() => {
		for ( const name of ['password', 'repeated'] ) {
			const field = document.querySelector('input[name=' + name + ']');
			field.value = 'sheepdog';
			field.dispatchEvent(new Event('input', { bubbles: true }));
		}
		document.querySelector('form').requestSubmit();
	})()`);
	await expect.poll(() => tessely.window.evaluate(() => window.tessely.invoke('lock:hasPassword'))).toBe(true);
	expect(await savedFile()).not.toContain('sheepdog');
	await expect.poll(() => inOverlay<boolean>('!!document.querySelector(".preferences [role=switch][aria-label=\\"Ask for it when Tessely starts\\"]")')).toBe(true);
});

test('shows the version in About, and each service\'s title in the unread report', async () => {
	await inOverlay('[...document.querySelectorAll(".preferences nav button")].find(button => button.textContent.trim() === "Advanced").click()');
	await inOverlay('[...document.querySelectorAll(".preferences button")].find(button => button.textContent.trim() === "About Tessely").click()');
	const { version } = JSON.parse(process.getBuiltinModule('node:fs').readFileSync('package.json', 'utf8')) as { version: string };
	await expect.poll(() => inOverlay<string>('document.querySelector(".about .versions")?.textContent ?? ""')).toContain(version);
	await inOverlay('document.querySelector(".about footer button").click()');
	await expect.poll(() => inOverlay<boolean>('!!document.querySelector(".preferences")')).toBe(true);
	await inOverlay('[...document.querySelectorAll(".preferences nav button")].find(button => button.textContent.trim() === "Advanced").click()');
	await inOverlay('[...document.querySelectorAll(".preferences button")].find(button => button.textContent.trim() === "Unread Report").click()');
	await expect.poll(() => inOverlay<string>('document.querySelector(".report tbody")?.textContent ?? ""')).toContain('Fixture service');
});

test('opens on the welcome page when that is the preference, whatever was open last', async () => {
	let restarted: Tessely | undefined;
	try {
		restarted = await launchTessely({
			store: { services: [serviceRecord('1', at('127.0.0.1', '/service.html'))], activeServiceId: '1', preferences: { openOnStart: 'welcome' } }
		});
		const started = restarted;
		await expect.poll(async () => ((await started.window.evaluate(() => window.tessely.invoke('services:list'))) as ServiceState[]).some(service => service.active)).toBe(false);
		await expect(started.window.locator('.welcome')).toBeVisible();
	} finally {
		await closeTessely(restarted);
	}
});

test('names the spelling languages, adds one from the list and removes it from its chip', async () => {
	await tessely.window.locator('.rail .tool[aria-label="Preferences"]').click();
	await expect.poll(() => inOverlay<number>('document.querySelectorAll(".preferences nav button").length')).toBe(5);
	await inOverlay('[...document.querySelectorAll(".preferences nav button")].find(button => button.textContent.trim() === "Services").click()');
	await expect.poll(() => inOverlay<string>('document.querySelector("select[name=addDictionary]")?.closest(".row")?.querySelector(".hint")?.textContent ?? ""')).toMatch(/^Automatic: [A-Z]/);
	await inOverlay(`(() => {
		const select = document.querySelector("select[name=addDictionary]");
		select.value = "pt-BR";
		select.dispatchEvent(new Event("change", { bubbles: true }));
	})()`);
	await expect.poll(async () => (await prefs()).spellcheckLanguages).toEqual(['pt-BR']);
	await expect.poll(() => inOverlay<string>('document.querySelector(".dictionaries li")?.firstChild?.textContent.trim() ?? ""')).toBe('Portuguese (Brazil)');
	await inOverlay('document.querySelector(".dictionaries li button").click()');
	await expect.poll(async () => (await prefs()).spellcheckLanguages).toEqual([]);
});
