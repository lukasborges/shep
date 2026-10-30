import type { UnreadCount } from './service.ts';

export const WORKSPACE_HUES = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'brown'] as const;
export type WorkspaceHue = (typeof WORKSPACE_HUES)[number];

// Twenty-nine, so that with the initials first the picker is five full rows of six.
export const WORKSPACE_ICONS = [
	'briefcase', 'house', 'heart', 'star', 'code', 'book-open', 'music', 'camera', 'gamepad', 'globe',
	'leaf', 'coffee', 'rocket', 'graduation-cap', 'shopping-cart', 'plane', 'users', 'flask', 'palette', 'chart',
	'film', 'bike', 'dumbbell', 'paw-print', 'wrench', 'building', 'headphones', 'sun', 'moon'
] as const;
export type WorkspaceIcon = (typeof WORKSPACE_ICONS)[number];

export interface Workspace {
	id: string;
	name: string;
	hue: WorkspaceHue;
	// null draws the name's initials
	icon?: WorkspaceIcon | null;
}

// Each icon wears a hue of its own, so choosing one chooses its colour.
export function hueOf(icon: WorkspaceIcon): WorkspaceHue {
	return WORKSPACE_HUES[WORKSPACE_ICONS.indexOf(icon) % WORKSPACE_HUES.length] ?? 'blue';
}

export function newWorkspace(name: string): Workspace {
	const icon = WORKSPACE_ICONS[Math.floor(Math.random() * WORKSPACE_ICONS.length)] ?? 'briefcase';
	return { id: 'w' + Date.now().toString(36), name, icon, hue: hueOf(icon) };
}

// null is All Services: no filter, not a workspace.
export type ActiveWorkspace = string | null;

export function isShownIn(serviceWorkspace: string, active: ActiveWorkspace): boolean {
	return active === null || serviceWorkspace === active;
}

// Ctrl+Alt, or Command+Option on a Mac, and a number: the workspaces in order, then All Services right after the last.
export function workspaceForNumber(index: number, workspaces: readonly Workspace[]): ActiveWorkspace | undefined {
	if ( index < workspaces.length ) return workspaces[index]?.id;
	if ( index === workspaces.length ) return null;
	return undefined;
}

export function reorderWorkspaces(workspaces: readonly Workspace[], ids: readonly string[]): Workspace[] {
	const byId = new Map(workspaces.map(workspace => [workspace.id, workspace]));
	const ordered = [...new Set(ids)].flatMap(id => byId.get(id) ?? []);
	return [...ordered, ...workspaces.filter(workspace => !ids.includes(workspace.id))];
}

export function unreadIn(services: readonly { workspace: string; unread: UnreadCount }[], workspace: string): UnreadCount {
	const own = services.filter(service => service.workspace === workspace);
	const count = own.reduce((sum, service) => sum + (service.unread === '•' ? 0 : service.unread), 0);
	return count > 0 || !own.some(service => service.unread === '•') ? count : '•';
}
