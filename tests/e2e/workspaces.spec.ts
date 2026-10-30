import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import type { ServiceState } from '../../src/shared/service.ts';
import type { AppState } from '../../src/shared/channels.ts';
import { launchShep, closeShep, inService, serviceRecord, COMMAND, type Shep } from './helpers/launch.ts';
import { serveFixtures } from './helpers/server.ts';

let shep: Shep;
let server: Server;
let at: Awaited<ReturnType<typeof serveFixtures>>['at'];

const list = () => shep.window.evaluate(() => window.shep.invoke('services:list')) as Promise<ServiceState[]>;
const state = () => shep.window.evaluate(() => window.shep.invoke('app:state')) as Promise<AppState>;
const rail = () => shep.window.locator('.rail .service').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
const tab = (name: string) => shep.window.locator(`.titlebar [role="tab"][aria-label="${name}"]`);
const selectedTab = () => shep.window.locator('.titlebar [role="tab"][aria-selected="true"]');
const shownTabs = () => shep.window.locator('.titlebar [role="tab"]').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label')));
const press = (keyCode: string, modifiers: string[]) => shep.app.evaluate(({ BrowserWindow }, { keyCode, modifiers }) => {
	const contents = BrowserWindow.getAllWindows()[0]?.webContents;
	contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
	contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers as Electron.InputEvent['modifiers'] });
}, { keyCode, modifiers });
const inOverlay = <T>(expression: string) => shep.app.evaluate(async ({ webContents }, expression) =>
	webContents.getAllWebContents().find(contents => contents.getURL().endsWith('#overlay'))?.executeJavaScript(expression), expression) as Promise<T>;

const templateOfNativeMenuOpenedBy = (script: string) => shep.app.evaluate(async ({ Menu, BrowserWindow }, script) => {
	const build = Menu.buildFromTemplate;
	let template: Electron.MenuItemConstructorOptions[] | null = null;
	Menu.buildFromTemplate = items => {
		template = items as Electron.MenuItemConstructorOptions[];
		return { popup: () => {} } as unknown as Electron.Menu;
	};
	await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(script);
	for ( let waited = 0; !template && waited < 5000; waited += 50 ) await new Promise(resolve => setTimeout(resolve, 50));
	Menu.buildFromTemplate = build;
	return (template ?? [] as Electron.MenuItemConstructorOptions[]).map(item => {
		const image = item.icon as Electron.NativeImage | undefined;
		return { label: item.type === 'separator' ? '---' : item.label, size: image?.getSize(), scales: image?.getScaleFactors(), pixels: image?.toDataURL({ scaleFactor: 2 }) ?? '' };
	});
}, script);

const chooseInNativeMenuOpenedBy = (script: string, label: string) => shep.app.evaluate(async ({ Menu, BrowserWindow }, { script, label }) => {
	const build = Menu.buildFromTemplate;
	let template: Electron.MenuItemConstructorOptions[] = [];
	Menu.buildFromTemplate = items => {
		template = items as Electron.MenuItemConstructorOptions[];
		return { popup: () => {} } as unknown as Electron.Menu;
	};
	await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(script);
	Menu.buildFromTemplate = build;
	(template.find(item => item.label === label)?.click as (() => void) | undefined)?.();
}, { script, label });

const answerQuestionsWith = (response: number) => shep.app.evaluate(({ dialog }, response) => {
	dialog.showMessageBox = (async (window: Electron.BrowserWindow, { buttons }: Electron.MessageBoxOptions) => {
		(globalThis as { buttonsLastAsked?: string[] }).buttonsLastAsked = buttons;
		return { response, checkboxChecked: false };
	}) as unknown as typeof dialog.showMessageBox;
}, response);
const buttonsLastAsked = () => shep.app.evaluate(() => (globalThis as { buttonsLastAsked?: string[] }).buttonsLastAsked);

const serviceMenuOf = (id: string) => `window.shep.invoke('services:menu', ${JSON.stringify(id)})`;
const tabMenuOf = (name: string) => `document.querySelector('.titlebar [role="tab"][aria-label="${name}"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))`;

test.beforeAll(async () => {
	({ server, at } = await serveFixtures());
	shep = await launchShep({
		store: {
			services: [
				serviceRecord('1', at('127.0.0.1', '/service.html'), { name: 'Mail', workspace: 'w1' }),
				serviceRecord('2', at('127.0.0.1', '/away.html'), { name: 'Family', workspace: 'w2' }),
				serviceRecord('3', at('127.0.0.1', '/long.html'), { name: 'Chat', workspace: 'w1' })
			],
			workspaces: [{ id: 'w1', name: 'Work', hue: 'blue' }, { id: 'w2', name: 'Personal', hue: 'green' }],
			activeWorkspace: null,
			activeServiceId: '2'
		}
	});
	await expect.poll(async () => (await list()).find(service => service.id === '2')?.pageTitle).toBe('Somewhere else');
});

test.afterAll(async () => {
	await closeShep(shep);
	server.close();
});

test('leaves the rail\'s + plain once there is a service', async () => {
	await expect(shep.window.locator('.rail .add')).toBeVisible();
	await expect(shep.window.locator('.rail .add.no-service-yet')).toHaveCount(0);
});

test('shows every service under All Services, the last tab in the title bar', async () => {
	await expect.poll(rail).toEqual(['Mail', 'Family', 'Chat']);
	expect(await shownTabs()).toEqual(['Work', 'Personal', 'All Services']);
	await expect(selectedTab()).toHaveAttribute('aria-label', 'All Services');
});

test('shows only a workspace\'s own services, and moves off a service it hides', async () => {
	await press('1', [COMMAND, 'alt']);
	await expect.poll(rail).toEqual(['Mail', 'Chat']);
	await expect(selectedTab()).toHaveAttribute('aria-label', 'Work');
	expect((await list()).find(service => service.active)?.name).toBe('Mail');
});

test('puts a workspace on screen from its tab', async () => {
	await tab('Personal').click();
	await expect.poll(rail).toEqual(['Family']);
	await expect(selectedTab()).toHaveAttribute('aria-label', 'Personal');
	await tab('Work').click();
	await expect.poll(rail).toEqual(['Mail', 'Chat']);
});

test('keeps a hidden service counting, on its workspace\'s tab, and leaves the count off the tab on screen', async () => {
	await inService(shep, at('127.0.0.1', '/away.html'), 'document.title = "(2) Somewhere else"');
	await expect(tab('Personal').locator('.badge')).toHaveText('2');
	await expect(tab('Work').locator('.badge')).toHaveCount(0);
	await tab('Personal').click();
	await expect(tab('Personal').locator('.badge')).toHaveCount(0);
	await tab('Work').click();
	await inService(shep, at('127.0.0.1', '/away.html'), 'document.title = "Somewhere else"');
	await expect(tab('Personal').locator('.badge')).toHaveCount(0, { timeout: 5000 });
});

test('offers what can be done to a workspace on its tab\'s right click, and only a new one on All Services\'', async () => {
	expect((await templateOfNativeMenuOpenedBy(tabMenuOf('Personal'))).map(item => item.label)).toEqual(['Rename…', 'Change Icon…', '---', 'New Workspace…', '---', 'Delete']);
	expect((await templateOfNativeMenuOpenedBy(tabMenuOf('All Services'))).map(item => item.label)).toEqual(['New Workspace…']);
});

test('draws each workspace\'s avatar beside its name in the menu of tabs that did not fit, sharp on a 2x screen', async () => {
	const hiddenMenu = () => templateOfNativeMenuOpenedBy('window.shep.invoke("workspaces:hiddenMenu", ["w1", "w2"], 0, 0)');
	await expect.poll(async () => (await hiddenMenu()).every(item => item.pixels)).toBe(true);
	const items = await hiddenMenu();
	expect(items.map(item => item.label?.replace(/ \(\d+\)$/, ''))).toEqual(['Work', 'Personal']);
	for ( const item of items ) {
		expect(item.size).toEqual({ width: 16, height: 16 });
		expect(item.scales).toEqual([2]);
	}
	expect(new Set(items.map(item => item.pixels)).size).toBe(2);

	const before = items[0]?.pixels;
	await shep.window.evaluate(() => window.shep.invoke('workspaces:setIcon', 'w1', 'rocket'));
	await expect.poll(async () => (await hiddenMenu())[0]?.pixels).not.toBe(before);
});

test('gives All Services the number after the last workspace', async () => {
	await press('3', [COMMAND, 'alt']);
	await expect.poll(async () => (await state()).activeWorkspace).toBe(null);
	await expect.poll(rail).toEqual(['Mail', 'Family', 'Chat']);
});

test('creates a workspace from its dialog and puts it on screen', async () => {
	await shep.window.locator('.titlebar .add').click();
	await expect.poll(() => inOverlay<boolean>('!!document.querySelector("form input[name=name]")')).toBe(true);
	await inOverlay(`(() => { const field = document.querySelector('input[name=name]'); field.value = 'Side project'; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(async () => (await state()).workspaces.map(workspace => workspace.name)).toEqual(['Work', 'Personal', 'Side project']);
	await expect(selectedTab()).toHaveAttribute('aria-label', 'Side project');
	await expect.poll(rail).toEqual([]);
});

test('adds a new service to the workspace on screen', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'add' }));
	await expect.poll(() => inOverlay<string>('document.querySelector("select[name=workspace]")?.selectedOptions[0]?.textContent ?? ""')).toBe('Side project');
	await inOverlay(`(() => { const field = document.querySelector('input[name=address]'); field.value = ${JSON.stringify(at('localhost', '/long.html'))}; field.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(rail).toEqual(['Localhost']);
});

test('moves a service to another workspace from its Edit window', async () => {
	await shep.window.evaluate(() => window.shep.invoke('overlay:open', { dialog: 'edit', serviceId: '3' }));
	await expect.poll(() => inOverlay<string>('document.querySelector("input[name=address]").value')).toContain('long.html');
	await inOverlay(`(() => { const select = document.querySelector('select[name=workspace]'); select.value = 'w2'; select.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
	await expect.poll(async () => (await list()).find(service => service.id === '3')?.workspace).toBe('w2');
	await expect.poll(rail).toEqual(['Localhost']);
});

test('gives a new workspace an icon, and changes it from the grid with the initials first', async () => {
	const sideProject = async () => (await state()).workspaces.find(workspace => workspace.name === 'Side project');
	const created = await sideProject();
	expect(created?.icon).toBeTruthy();

	await shep.window.evaluate(id => window.shep.invoke('overlay:open', { dialog: 'workspaceIcon', workspaceId: id }), created?.id);
	await expect.poll(() => inOverlay<number>('document.querySelectorAll(".icons .grid button").length')).toBe(30);
	expect(await inOverlay<string>('document.querySelector(".icons .grid button[aria-checked=true]")?.getAttribute("aria-label")')).toBe(created?.icon);

	await inOverlay('document.querySelector(".icons .grid button[aria-label=rocket]").click()');
	await expect.poll(async () => (await sideProject())?.icon).toBe('rocket');
	await expect(tab('Side project').locator('svg')).toBeVisible();
	const hue = (await sideProject())?.hue;

	await shep.window.evaluate(id => window.shep.invoke('overlay:open', { dialog: 'workspaceIcon', workspaceId: id }), created?.id);
	await expect.poll(() => inOverlay<number>('document.querySelectorAll(".icons .grid button").length')).toBe(30);
	await inOverlay('document.querySelector(".icons .grid button").click()');
	await expect.poll(async () => (await sideProject())?.icon).toBe(null);
	expect((await sideProject())?.hue).toBe(hue);
	await expect(tab('Side project').locator('.initials')).toHaveText('SP');
});

test('reorders the tabs by dragging one onto another, and the numbered shortcuts follow the new order', async () => {
	const order = async () => (await state()).workspaces.map(workspace => workspace.name);
	await expect(shep.window.locator('.titlebar .tab.dragged')).toHaveCount(0);
	await tab('Personal').dragTo(tab('Work'));
	await expect.poll(order).toEqual(['Personal', 'Work', 'Side project']);
	expect(await shownTabs()).toEqual(['Personal', 'Work', 'Side project', 'All Services']);
	await press('1', [COMMAND, 'alt']);
	await expect(selectedTab()).toHaveAttribute('aria-label', 'Personal');
	await tab('Work').dragTo(tab('Personal'));
	await expect.poll(order).toEqual(['Work', 'Personal', 'Side project']);
});

test('keeps a service in its workspace when it is dropped on All Services, which is not one', async () => {
	await tab('Side project').click();
	await expect.poll(rail).toEqual(['Localhost']);
	const sideProject = (await state()).workspaces.find(workspace => workspace.name === 'Side project')?.id;
	await shep.window.locator('.rail .service[aria-label="Localhost"]').dragTo(tab('All Services'));
	expect((await list()).find(service => service.name === 'Localhost')?.workspace).toBe(sideProject);
});

test('moves a service to a workspace by dragging its icon from the rail onto that workspace\'s tab', async () => {
	await tab('Side project').click();
	await expect.poll(rail).toEqual(['Localhost']);
	await shep.window.locator('.rail .service[aria-label="Localhost"]').dragTo(tab('Personal'));
	await expect.poll(async () => (await list()).find(service => service.name === 'Localhost')?.workspace).toBe('w2');
	await expect.poll(rail).toEqual([]);
});

test('keeps the page\'s buttons in the title bar, turned off, while the workspace on screen has no service', async () => {
	await expect.poll(rail).toEqual([]);
	for ( const label of ['Back', 'Forward', 'Reload', 'Home', 'Find in page'] ) {
		await expect(shep.window.locator(`.titlebar button[aria-label="${label}"]`)).toBeDisabled();
	}
});

test('brings forward a service of the workspace on screen when the active one is removed, not one of another workspace', async () => {
	await tab('Personal').click();
	await expect.poll(rail).toEqual(['Family', 'Chat', 'Localhost']);
	await shep.window.locator('.rail .service[aria-label="Localhost"]').click();
	await answerQuestionsWith(0);
	await chooseInNativeMenuOpenedBy(serviceMenuOf((await list()).find(service => service.name === 'Localhost')?.id ?? ''), 'Remove…');
	await expect.poll(rail).toEqual(['Family', 'Chat']);
	await expect.poll(async () => (await list()).find(service => service.active)?.name).toBe('Family');
});

test('renames a workspace in its tab on a double click or F2, keeping the name on Escape', async () => {
	const field = shep.window.locator('.titlebar input.rename');
	await tab('Work').dblclick();
	await expect(field).toBeFocused();
	await field.fill('Office');
	await field.press('Enter');
	await expect.poll(async () => (await state()).workspaces.map(workspace => workspace.name)).toEqual(['Office', 'Personal', 'Side project']);
	await expect(field).toHaveCount(0);

	await tab('Office').focus();
	await tab('Office').press('F2');
	await field.fill('Thrown away');
	await field.press('Escape');
	await expect(field).toHaveCount(0);
	await expect(tab('Office')).toBeVisible();
	expect((await state()).workspaces[0]?.name).toBe('Office');
});

test('asks where a deleted workspace\'s services go, and moves them there with the workspace gone', async () => {
	await answerQuestionsWith(0);
	await chooseInNativeMenuOpenedBy(tabMenuOf('Personal'), 'Delete');
	await expect.poll(async () => (await state()).workspaces.map(workspace => workspace.name)).toEqual(['Office', 'Side project']);
	expect(await buttonsLastAsked()).toEqual(['Move Services to Office', 'Move Services to Side project', 'Delete With Its Services', 'Cancel']);
	await expect.poll(async () => (await list()).filter(service => service.workspace === 'w1').map(service => service.name)).toEqual(['Mail', 'Family', 'Chat']);
});

test('in the narrowest window, takes the names off the tabs from the right, keeping counts beside the icons, then puts the last ones behind a button, leaving room to drag the window', async () => {
	const sizeBefore = await shep.app.evaluate(({ BrowserWindow }) => {
		const window = BrowserWindow.getAllWindows()[0]!;
		const [width, height] = window.getSize();
		window.setSize(window.getMinimumSize()[0]!, height!);
		return { width: width!, height: height! };
	});
	const moreWorkspacesThanFit = Array.from({ length: 10 }, (unused, index) => `Extra ${index + 1}`);
	for ( const name of moreWorkspacesThanFit ) await shep.window.evaluate(name => window.shep.invoke('workspaces:save', null, name), name);
	const names = (await state()).workspaces.map(workspace => workspace.name);

	await expect(selectedTab().locator('.name')).toHaveText('Extra 10');
	await expect(tab('All Services')).toBeVisible();
	await expect(tab('All Services').locator('.name')).toHaveCount(0);
	await expect(shep.window.locator('.titlebar button.overflow')).toBeVisible();

	const shown = await shownTabs();
	const withoutUnread = (label: string | undefined) => label?.replace(/ \(.*\)$/, '');
	const hidden = (await templateOfNativeMenuOpenedBy('document.querySelector(".titlebar button.overflow").click()')).map(item => withoutUnread(item.label));
	expect([...shown.filter(name => name !== 'All Services'), ...hidden].sort()).toEqual([...names].sort());

	const countsOverAnIcon = await shep.window.locator('.titlebar [role="tab"]:not(:has(.name)):has(.badge)').evaluateAll(tabs => tabs.filter(tab =>
		tab.querySelector('.badge')!.getBoundingClientRect().left < tab.querySelector('.avatar')!.getBoundingClientRect().right).length);
	expect(countsOverAnIcon).toBe(0);

	const tabsEnd = await shep.window.locator('.titlebar .workspaces').evaluate(tabs => tabs.getBoundingClientRect().right);
	const middleEnd = await shep.window.locator('.titlebar .middle').evaluate(middle => middle.getBoundingClientRect().right);
	expect(middleEnd - tabsEnd).toBeGreaterThanOrEqual(48);

	await shep.app.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows()[0]!.setSize(width, height), sizeBefore);
});
