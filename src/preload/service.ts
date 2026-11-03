import { contextBridge, ipcRenderer } from 'electron';

// What the Notification wrapper main injects into the page's own world calls.
contextBridge.exposeInMainWorld('shepService', {
	notificationClicked: () => ipcRenderer.send('service:notification-click'),
	notified: () => ipcRenderer.send('service:notified'),
	mayNotify: () => ipcRenderer.sendSync('service:may-notify') === true
});

// Here, not at dom-ready as the Notification wrapper is, since a page may set its badge as it loads.
contextBridge.executeInMainWorld({
	func: (badged: (contents: unknown) => void) => {
		const navigatorPrototype = (globalThis as unknown as { Navigator: { prototype: Record<string, unknown> } }).Navigator.prototype;
		navigatorPrototype.setAppBadge = (contents?: unknown) => Promise.resolve(badged(contents));
		navigatorPrototype.clearAppBadge = () => Promise.resolve(badged(0));
	},
	args: [(contents: unknown) => ipcRenderer.send('service:badged', contents)]
});

// Chromium's media emulation ignores display-mode, so the page's own matchMedia answers as an installed app's would.
contextBridge.executeInMainWorld({
	func: () => {
		const page = globalThis as unknown as { matchMedia(query: string): unknown };
		const matchMedia = page.matchMedia.bind(page);
		const swapBrowserAndStandalone = (query: string) => query.replace(/(display-mode\s*:\s*)(standalone|browser)\b/gi,
			(match, feature: string, mode: string) => feature + (mode.toLowerCase() === 'browser' ? 'standalone' : 'browser'));
		page.matchMedia = (query: string) => matchMedia(swapBrowserAndStandalone(String(query)));
	}
});
