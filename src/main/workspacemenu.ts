import type { ActiveWorkspace, Workspace } from '../shared/workspace.ts';
import type { UnreadCount } from '../shared/service.ts';
import type { NativeImage } from 'electron';
import type { Messages } from '../shared/i18n/index.ts';

export interface WorkspaceTabActions {
	create(): void;
	rename(id: string): void;
	changeIcon(id: string): void;
	remove(id: string): void;
}

export interface WorkspaceMenuItem {
	label?: string;
	type?: 'separator';
	accelerator?: string;
	icon?: NativeImage | string;
	click?: () => void;
}

const SEPARATOR: WorkspaceMenuItem = { type: 'separator' };
const NUMBERED_SHORTCUTS = 9;

export function workspaceTabMenu(id: ActiveWorkspace, actions: WorkspaceTabActions, messages: Messages): WorkspaceMenuItem[] {
	const creating: WorkspaceMenuItem = { label: messages['menu.newWorkspace'], click: actions.create };
	if ( id === null ) return [creating];
	return [
		{ label: messages['menu.renameWorkspace'], click: () => actions.rename(id) },
		{ label: messages['menu.changeIcon'], click: () => actions.changeIcon(id) },
		SEPARATOR,
		creating,
		SEPARATOR,
		{ label: messages['menu.deleteWorkspace'], click: () => actions.remove(id) }
	];
}

export function hiddenWorkspacesMenu(workspaces: readonly Workspace[], hidden: readonly string[], unreadOf: (id: string) => UnreadCount, choose: (id: string) => void, imageOf: (id: string) => NativeImage | string | undefined = () => undefined): WorkspaceMenuItem[] {
	return workspaces.flatMap((workspace, index) => {
		if ( !hidden.includes(workspace.id) ) return [];
		const unread = unreadOf(workspace.id);
		return [{
			label: unread === '•' || unread > 0 ? `${workspace.name} (${unread})` : workspace.name,
			accelerator: index < NUMBERED_SHORTCUTS ? `CommandOrControl+Alt+${index + 1}` : undefined,
			icon: imageOf(workspace.id),
			click: () => choose(workspace.id)
		}];
	});
}
