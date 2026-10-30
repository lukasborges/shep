import { contextBridge, ipcRenderer } from 'electron';

// What the Notification wrapper main injects into the page's own world calls.
contextBridge.exposeInMainWorld('shepService', {
	notificationClicked: () => ipcRenderer.send('service:notification-click'),
	notified: () => ipcRenderer.send('service:notified'),
	mayNotify: () => ipcRenderer.sendSync('service:may-notify') === true
});
