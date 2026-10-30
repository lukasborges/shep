import { dialog, Menu, type BrowserWindow } from 'electron';
import { hueOf, newWorkspace, reorderWorkspaces, unreadIn, workspaceForNumber, type ActiveWorkspace, type Workspace, type WorkspaceIcon } from '../shared/workspace.ts';
import { store } from './store.ts';
import { hiddenWorkspacesMenu, workspaceTabMenu } from './workspacemenu.ts';
import { workspaceImage } from './workspaceimages.ts';
import type { ServiceHost } from './services.ts';
import { mainMessages } from './messages.ts';
import { fill } from '../shared/i18n/index.ts';

export class Workspaces {
	constructor(
		private readonly window: BrowserWindow,
		private readonly services: ServiceHost,
		private readonly askForName: (id: string | null) => void,
		private readonly askForIcon: (id: string) => void
	) {}

	list(): Workspace[] {
		return store.get('workspaces');
	}

	choose(workspace: ActiveWorkspace): void {
		if ( workspace === null || this.list().some(candidate => candidate.id === workspace) ) this.services.showWorkspace(workspace);
	}

	chooseNumber(index: number): void {
		const workspace = workspaceForNumber(index, this.list());
		if ( workspace !== undefined ) this.choose(workspace);
	}

	save(id: string | null, name: string): void {
		const trimmed = name.trim();
		if ( !trimmed ) return;
		if ( !id ) {
			this.createAndShow(trimmed);
			return;
		}
		store.set('workspaces', this.list().map(workspace => workspace.id === id ? { ...workspace, name: trimmed } : workspace));
		this.services.showWorkspace(store.get('activeWorkspace'));
	}

	homeForNewService(wanted: string, firstWorkspaceName: string): string {
		const list = this.list();
		if ( list.some(workspace => workspace.id === wanted) ) return wanted;
		const [first] = list;
		if ( first ) return store.get('activeWorkspace') ?? first.id;
		return this.createAndShow(firstWorkspaceName.trim() || mainMessages()['dialog.workspace.first']);
	}

	private createAndShow(name: string): string {
		const created = newWorkspace(name);
		store.set('workspaces', [...this.list(), created]);
		this.choose(created.id);
		return created.id;
	}

	reorder(ids: string[]): void {
		store.set('workspaces', reorderWorkspaces(this.list(), ids));
		this.services.showWorkspace(store.get('activeWorkspace'));
	}

	// The initials keep the hue the workspace had.
	setIcon(id: string, icon: WorkspaceIcon | null): void {
		store.set('workspaces', this.list().map(workspace => workspace.id !== id ? workspace
			: { ...workspace, icon, hue: icon ? hueOf(icon) : workspace.hue }));
		this.services.showWorkspace(store.get('activeWorkspace'));
	}

	async remove(id: string): Promise<void> {
		const workspace = this.list().find(candidate => candidate.id === id);
		if ( !workspace ) return;
		const messages = mainMessages();
		const itsServices = store.get('services').filter(service => service.workspace === id);
		const servicesGoToo = itsServices.length > 0;
		const { response } = await dialog.showMessageBox(this.window, {
			type: servicesGoToo ? 'warning' : 'question',
			buttons: [messages[servicesGoToo ? 'deleteWorkspace.deleteServices' : 'deleteWorkspace.confirm'], messages['dialog.cancel']],
			defaultId: 1, cancelId: 1,
			message: fill(messages['deleteWorkspace.message'], { name: workspace.name }),
			detail: servicesGoToo ? messages['deleteWorkspace.detail'] : ''
		});
		if ( response !== 0 ) return;
		for ( const service of itsServices ) await this.services.remove(service.id);
		store.set('workspaces', this.list().filter(candidate => candidate.id !== id));
		this.choose(null);
	}

	showTabMenu(id: ActiveWorkspace): void {
		const items = workspaceTabMenu(id, {
			create: () => this.askForName(null),
			rename: workspace => this.askForName(workspace),
			changeIcon: workspace => this.askForIcon(workspace),
			remove: workspace => { this.remove(workspace); }
		}, mainMessages());
		Menu.buildFromTemplate(items).popup({ window: this.window });
	}

	showHiddenMenu(hidden: string[], x: number, y: number): void {
		const services = this.services.list();
		const items = hiddenWorkspacesMenu(this.list(), hidden, id => unreadIn(services, id), id => this.choose(id), workspaceImage);
		if ( items.length ) Menu.buildFromTemplate(items).popup({ window: this.window, x: Math.round(x), y: Math.round(y) });
	}
}
