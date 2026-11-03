import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, type ElectronApplication, type Page } from 'playwright';

export const repoRoot = resolve(__dirname, '..', '..', '..');

export interface Tesselium {
	app: ElectronApplication;
	window: Page;
	userDataDir: string;
}

// A profile of its own per launch, or the run would read the developer's services and talk to the network.
export async function launchTesselium({ store, userDataDir = mkdtempSync(join(tmpdir(), 'tesselium-next-test-')) }: { store?: Record<string, unknown>; userDataDir?: string } = {}): Promise<Tesselium> {
	if ( store ) writeFileSync(join(userDataDir, 'tesselium.json'), JSON.stringify(store));

	const app = await _electron.launch({
		// Every expectation here is written in English, and with no language of its own the app would
		// speak the desktop's: the suite passes on a Portuguese machine only because of this.
		args: [join(repoRoot, 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`, '--lang=en-US'],
		cwd: repoRoot,
		// Playwright emulates a light prefers-color-scheme unless told not to, which races the app's own theme
		colorScheme: null
	});
	const window = await app.firstWindow();
	await window.waitForSelector('.shell');
	return { app, window, userDataDir };
}

export async function closeTesselium(tesselium: Tesselium | undefined): Promise<void> {
	if ( !tesselium ) return;
	await tesselium.app.close();
	rmSync(tesselium.userDataDir, { recursive: true, force: true });
}

export function serviceRecord(id: string, url: string, overrides: Record<string, unknown> = {}) {
	return {
		id, name: 'Service ' + id, url, workspace: '', enabled: true,
		notifications: false, muted: true, media: false, trust: false, zoomLevel: 0, favicon: '', ...overrides
	};
}

// Runs in the page of the service whose address starts with urlPrefix. A navigation without
// userGesture is one Chromium's back button skips, as it does in Chrome.
export function inService<T>(tesselium: Tesselium, urlPrefix: string, expression: string, { userGesture = false } = {}): Promise<T> {
	return tesselium.app.evaluate(async ({ webContents }, { urlPrefix, expression, userGesture }) => {
		const contents = webContents.getAllWebContents().find(candidate => candidate.getURL().startsWith(urlPrefix));
		if ( !contents ) throw new Error('No page at ' + urlPrefix);
		return contents.executeJavaScript(expression, userGesture);
	}, { urlPrefix, expression, userGesture }) as Promise<T>;
}

export function inViewOverServices<T>(tesselium: Tesselium, hash: '#overlay' | '#find', expression: string): Promise<T> {
	return tesselium.app.evaluate(async ({ webContents }, { hash, expression }) => {
		const view = webContents.getAllWebContents().find(contents => contents.getURL().endsWith(hash));
		if ( !view ) throw new Error('No view at ' + hash);
		return view.executeJavaScript(expression);
	}, { hash, expression }) as Promise<T>;
}

export function viewOverServicesShown(tesselium: Tesselium, hash: '#overlay' | '#find'): Promise<boolean> {
	return tesselium.app.evaluate(({ BrowserWindow }, hash) =>
		BrowserWindow.getAllWindows()[0]?.contentView.children.some(view => (view as unknown as { webContents: Electron.WebContents }).webContents.getURL().endsWith(hash) && view.getVisible()) ?? false, hash);
}

// the modifier the app's own keys are on, Command on a Mac and Control elsewhere
export const COMMAND = process.platform === 'darwin' ? 'meta' : 'control';
