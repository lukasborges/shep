import type { Navigation, ServiceState } from '../shared/service.ts';
import type { AppState } from '../shared/channels.ts';
import type { ActiveWorkspace } from '../shared/workspace.ts';
import { workspaceImages } from './workspaceImages.ts';

export const appState = $state<AppState>({ dontDisturb: false, workspaces: [], activeWorkspace: null, language: '', migrating: false });

export const services = $state<{ list: ServiceState[]; hover: string }>({
	list: [],
	hover: ''
});

export function activeService(): ServiceState | undefined {
	return services.list.find(service => service.active);
}

let imagesDrawnFor = '';
let imagesSent = Promise.resolve();

// The menus are native, and main can draw no SVG, so the workspaces' avatars go to it as images.
// One after another, so a slower drawing never lands after a newer one.
function sendWorkspaceImages(): void {
	const drawnFor = JSON.stringify(appState.workspaces);
	if ( drawnFor === imagesDrawnFor ) return;
	imagesDrawnFor = drawnFor;
	const workspaces = JSON.parse(JSON.stringify(appState.workspaces));
	imagesSent = imagesSent
		.then(async () => { await window.tesselium.invoke('workspaces:images', await workspaceImages(workspaces)); })
		.catch(() => {});
}

export async function loadServices(): Promise<void> {
	Object.assign(appState, await window.tesselium.invoke('app:state') as AppState);
	window.tesselium.on('app:state', state => {
		Object.assign(appState, state as AppState);
		sendWorkspaceImages();
	});
	sendWorkspaceImages();
	services.list = await window.tesselium.invoke('services:list') as ServiceState[];
	window.tesselium.on('services:changed', list => { services.list = list as ServiceState[]; });
	window.tesselium.on('services:hover', (id, url) => { if ( id === activeService()?.id ) services.hover = String(url ?? ''); });
}

export const activate = (id: string) => window.tesselium.invoke('services:activate', id);
export const showServiceMenu = (id: string) => window.tesselium.invoke('services:menu', id);
export const reorder = (ids: string[]) => window.tesselium.invoke('services:reorder', ids);
export const openAddDialog = () => window.tesselium.invoke('overlay:open', { dialog: 'add' });
export const navigate = (id: string, where: Navigation) => window.tesselium.invoke('service:navigate', id, where);
export const resetZoom = (id: string) => window.tesselium.invoke('service:resetZoom', id);
export const openFind = () => window.tesselium.invoke('find:open');
export const setDontDisturb = (on: boolean) => window.tesselium.invoke('app:setDontDisturb', on);
export const chooseWorkspace = (id: ActiveWorkspace) => window.tesselium.invoke('workspaces:choose', id);
export const showWorkspaceTabMenu = (id: ActiveWorkspace) => window.tesselium.invoke('workspaces:tabMenu', id);
export const showHiddenWorkspaces = (ids: string[], x: number, y: number) => window.tesselium.invoke('workspaces:hiddenMenu', ids, x, y);
export const saveWorkspaceOrder = (ids: string[]) => window.tesselium.invoke('workspaces:reorder', ids);
export const renameWorkspace = (id: string, name: string) => window.tesselium.invoke('workspaces:save', id, name);
export const moveServiceToWorkspace = (id: string, workspace: string) => window.tesselium.invoke('services:moveToWorkspace', id, workspace);
export const openNewWorkspaceDialog =() => window.tesselium.invoke('overlay:open', { dialog: 'workspace', workspaceId: null });
export const openPreferences = () => window.tesselium.invoke('overlay:open', { dialog: 'preferences' });
export const lockApp = () => window.tesselium.invoke('app:lock');
