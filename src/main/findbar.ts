import { join } from 'node:path';
import { WebContentsView, type BrowserWindow } from 'electron';
import { TITLE_BAR_HEIGHT } from '../shared/chrome.ts';

const PANEL_AND_SHADOW_WIDTH = 380;
const PANEL_AND_SHADOW_HEIGHT = 64;
const GAP_TO_WINDOW_EDGE = 8;

export interface FindBarTarget {
	activeId(): string | null;
	find(id: string, text: string, forward: boolean): void;
	stopFind(id: string): void;
	focusActive(): void;
}

export class FindBar {
	private view: WebContentsView | null = null;
	private loaded: Promise<void> | null = null;
	private openFor: string | null = null;

	constructor(private readonly window: BrowserWindow, private readonly target: FindBarTarget, private readonly onCreate: (contents: Electron.WebContents) => void) {
		window.on('resize', () => this.fit());
	}

	async open(): Promise<void> {
		const activeId = this.target.activeId();
		if ( !activeId ) return;
		if ( this.openFor && this.openFor !== activeId ) this.close();
		this.openFor = activeId;
		const view = this.ensure();
		await this.loaded;
		this.window.contentView.addChildView(view);
		this.fit();
		view.setVisible(true);
		view.webContents.focus();
		view.webContents.send('find:open');
	}

	close(): void {
		if ( !this.openFor ) return;
		this.target.stopFind(this.openFor);
		this.openFor = null;
		this.view?.setVisible(false);
		this.target.focusActive();
	}

	search(text: string, forward: boolean): void {
		if ( this.openFor ) this.target.find(this.openFor, text, forward);
	}

	found(id: string, active: number, matches: number): void {
		if ( id === this.openFor ) this.view?.webContents.send('find:found', active, matches);
	}

	contents() {
		return this.view?.webContents;
	}

	closeIfAnotherServiceIsActive(): void {
		if ( this.openFor && this.openFor !== this.target.activeId() ) this.close();
	}

	private fit(): void {
		const [width = 0] = this.window.getContentSize();
		this.view?.setBounds({ x: Math.max(0, width - PANEL_AND_SHADOW_WIDTH - GAP_TO_WINDOW_EDGE), y: TITLE_BAR_HEIGHT, width: PANEL_AND_SHADOW_WIDTH, height: PANEL_AND_SHADOW_HEIGHT });
	}

	private ensure(): WebContentsView {
		if ( this.view ) return this.view;
		const view = new WebContentsView({
			webPreferences: { preload: join(__dirname, '../preload/ui.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
		});
		view.setBackgroundColor('#00000000');
		view.setVisible(false);
		this.onCreate(view.webContents);
		const address = process.env.ELECTRON_RENDERER_URL;
		this.loaded = (address ? view.webContents.loadURL(address + '#find') : view.webContents.loadFile(join(__dirname, '../ui/index.html'), { hash: 'find' })).then(() => {});
		this.view = view;
		return view;
	}
}
