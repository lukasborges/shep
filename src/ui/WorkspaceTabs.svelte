<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import type { UnreadCount } from '../shared/service.ts';
	import { reorderWorkspaces, unreadIn, type ActiveWorkspace, type Workspace } from '../shared/workspace.ts';
	import { fitTabs, type TabFit } from '../shared/tabs.ts';
	import { appState, services, chooseWorkspace, moveServiceToWorkspace, openNewWorkspaceDialog, renameWorkspace, saveWorkspaceOrder, showHiddenWorkspaces, showWorkspaceTabMenu } from './services.svelte.ts';
	import { SERVICE_DRAG_TYPE, WORKSPACE_DRAG_TYPE } from './dragging.ts';
	import Icon from './Icon.svelte';
	import WorkspaceAvatar from './WorkspaceAvatar.svelte';

	const { messages, room }: { messages: Messages; room: number } = $props();

	const MAX_SHOWN_COUNT = 99;
	const GAP = 2;

	interface Tab {
		id: ActiveWorkspace;
		name: string;
		workspace: Workspace | null;
		selected: boolean;
		unread: UnreadCount;
	}

	let draggedWorkspace = $state<string | null>(null);
	let previewedOrder = $state<string[] | null>(null);
	let serviceDropTarget = $state<ActiveWorkspace | undefined>(undefined);
	let renaming = $state<string | null>(null);

	const tabs = $derived.by((): Tab[] => {
		const { activeWorkspace } = appState;
		const workspaces = previewedOrder ? reorderWorkspaces(appState.workspaces, previewedOrder) : appState.workspaces;
		const own = workspaces.map(workspace => ({
			id: workspace.id, name: workspace.name, workspace, selected: workspace.id === activeWorkspace, unread: unreadIn(services.list, workspace.id)
		}));
		return [...own, { id: null, name: messages['titlebar.allServices'], workspace: null, selected: activeWorkspace === null, unread: 0 }];
	});

	const namedWidths = $state<number[]>([]);
	const iconWidths = $state<number[]>([]);
	let separatorWidth = $state(0);
	let overflowWidth = $state(0);
	let addWidth = $state(0);

	const fits = $derived(fitTabs(tabs.map((tab, index) => {
		const separator = tab.id === null && index > 0 ? separatorWidth + GAP : 0;
		return { named: (namedWidths[index] ?? 0) + GAP + separator, icon: (iconWidths[index] ?? 0) + GAP + separator, selected: tab.selected, hideable: tab.id !== null };
	}), room - addWidth - GAP, overflowWidth + GAP));

	const hidden = $derived(tabs.filter((tab, index) => fits[index] === 'hidden'));
	const overflowAfter = $derived(tabs.findLastIndex((tab, index) => tab.id !== null && fits[index] !== 'hidden'));
	const hiddenUnread = $derived.by((): UnreadCount => {
		const counted = hidden.reduce((sum, tab) => sum + (tab.unread === '•' ? 0 : tab.unread), 0);
		return counted > 0 || !hidden.some(tab => tab.unread === '•') ? counted : '•';
	});

	function badge(unread: UnreadCount): string {
		if ( unread === '•' ) return '•';
		if ( unread <= 0 ) return '';
		return unread > MAX_SHOWN_COUNT ? MAX_SHOWN_COUNT + '+' : String(unread);
	}

	function showHidden(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const { left, bottom } = event.currentTarget.getBoundingClientRect();
		showHiddenWorkspaces(hidden.flatMap(tab => tab.id === null ? [] : [tab.id]), left, bottom);
	}

	function startDraggingTab(event: DragEvent, id: string) {
		draggedWorkspace = id;
		event.dataTransfer?.setData(WORKSPACE_DRAG_TYPE, id);
	}

	function dragOverTab(event: DragEvent, over: ActiveWorkspace) {
		if ( event.dataTransfer?.types.includes(SERVICE_DRAG_TYPE) ) {
			if ( over === null ) return;
			event.preventDefault();
			serviceDropTarget = over;
			return;
		}
		if ( !draggedWorkspace || over === null || over === draggedWorkspace ) return;
		event.preventDefault();
		const order = previewedOrder ?? appState.workspaces.map(workspace => workspace.id);
		const withoutDragged = order.filter(id => id !== draggedWorkspace);
		withoutDragged.splice(order.indexOf(over), 0, draggedWorkspace);
		previewedOrder = withoutDragged;
	}

	function dropOnTab(event: DragEvent, on: ActiveWorkspace) {
		const service = event.dataTransfer?.getData(SERVICE_DRAG_TYPE);
		if ( service && on !== null ) moveServiceToWorkspace(service, on);
		finishDragging();
	}

	function finishDragging() {
		if ( previewedOrder ) saveWorkspaceOrder([...previewedOrder]);
		draggedWorkspace = null;
		previewedOrder = null;
		serviceDropTarget = undefined;
	}

	function startRenamingOnF2(event: KeyboardEvent, id: string) {
		if ( event.key !== 'F2' ) return;
		event.preventDefault();
		renaming = id;
	}

	function finishRenaming(field: HTMLInputElement, id: string) {
		if ( renaming !== id ) return;
		renaming = null;
		renameWorkspace(id, field.value);
	}

	function answerRenamingKeys(event: KeyboardEvent & { currentTarget: HTMLInputElement }, id: string) {
		if ( event.key === 'Enter' ) finishRenaming(event.currentTarget, id);
		if ( event.key === 'Escape' ) renaming = null;
	}

	const selectWholeName = (field: HTMLInputElement) => {
		field.focus();
		field.select();
	};
</script>

{#snippet avatar(tab: Tab)}
	{#if tab.workspace}
		<WorkspaceAvatar name={tab.workspace.name} hue={tab.workspace.hue} icon={tab.workspace.icon ?? null} size={20} onChrome={!tab.selected} />
	{:else}
		<span class="all">
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
				<rect x="1" y="1" width="4" height="4" rx="1" /><rect x="7" y="1" width="4" height="4" rx="1" />
				<rect x="1" y="7" width="4" height="4" rx="1" /><rect x="7" y="7" width="4" height="4" rx="1" />
			</svg>
		</span>
	{/if}
{/snippet}

{#snippet face(tab: Tab, fit: TabFit)}
	{@render avatar(tab)}
	{#if fit === 'named'}<span class="name">{tab.name}</span>{/if}
	{@render count(tab.selected ? 0 : tab.unread)}
{/snippet}

{#snippet count(unread: UnreadCount)}
	{#if badge(unread)}
		<span class="badge" class:dot={unread === '•'} aria-label="{unread} unread">{unread === '•' ? '' : badge(unread)}</span>
	{/if}
{/snippet}

<div class="workspaces">
	<div class="tabs" role="tablist" aria-label={messages['titlebar.workspaces']}>
		{#each tabs as tab, index (tab.id ?? '')}
			{#if fits[index] !== 'hidden'}
				{#if tab.id === null && index > 0}<span class="separator" aria-hidden="true"></span>{/if}
				{#if tab.id !== null && renaming === tab.id}
					{@const id = tab.id}
					<div class="tab selected renaming" role="tab" aria-selected={tab.selected} aria-label={tab.name}>
						{@render avatar(tab)}
						<input class="rename" value={tab.name} aria-label={messages['dialog.renameWorkspace.title']} {@attach selectWholeName}
							onkeydown={event => answerRenamingKeys(event, id)} onblur={event => finishRenaming(event.currentTarget, id)} />
					</div>
				{:else}
					{@const id = tab.id}
					<button class="tab" class:selected={tab.selected} class:icon-only={fits[index] === 'icon'} class:dragged={id !== null && draggedWorkspace === id} class:service-drop={serviceDropTarget === id}
						type="button" role="tab" aria-selected={tab.selected} aria-label={tab.name} title={tab.name} draggable={id !== null}
						onclick={() => chooseWorkspace(id)}
						ondblclick={() => { if ( id !== null ) renaming = id; }}
						onkeydown={event => { if ( id !== null ) startRenamingOnF2(event, id); }}
						oncontextmenu={event => { event.preventDefault(); showWorkspaceTabMenu(id); }}
						ondragstart={event => { if ( id !== null ) startDraggingTab(event, id); }}
						ondragover={event => dragOverTab(event, id)}
						ondragleave={() => { if ( serviceDropTarget === id ) serviceDropTarget = undefined; }}
						ondrop={event => dropOnTab(event, id)}
						ondragend={finishDragging}>
						{@render face(tab, fits[index] ?? 'named')}
					</button>
				{/if}
			{/if}
			{#if index === overflowAfter && hidden.length}
				<button class="tab overflow" type="button" aria-haspopup="menu" aria-label={messages['titlebar.moreWorkspaces']} title={messages['titlebar.moreWorkspaces']} onclick={showHidden}>
					+{hidden.length}<Icon name="down" />
					{@render count(hiddenUnread)}
				</button>
			{/if}
		{/each}
	</div>
	<button class="add" type="button" title={messages['titlebar.newWorkspace']} aria-label={messages['titlebar.newWorkspace']} bind:offsetWidth={addWidth} onclick={openNewWorkspaceDialog}>
		<Icon name="add" />
	</button>

	<div class="ruler" aria-hidden="true">
		{#each tabs as tab, index (tab.id ?? '')}
			<span class="tab" class:selected={tab.selected} bind:offsetWidth={namedWidths[index]}>{@render face(tab, 'named')}</span>
			<span class="tab icon-only" class:selected={tab.selected} bind:offsetWidth={iconWidths[index]}>{@render face(tab, 'icon')}</span>
		{/each}
		<span class="separator" bind:offsetWidth={separatorWidth}></span>
		<span class="tab overflow" bind:offsetWidth={overflowWidth}>+{tabs.length}<Icon name="down" />{@render count(MAX_SHOWN_COUNT + 1)}</span>
	</div>
</div>

<style>
	.workspaces {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 2px;
		flex: 0 1 auto;
		min-width: 0;
	}

	.tabs {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		min-width: 0;
	}

	.tab, .add {
		-webkit-app-region: no-drag;
	}

	.tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 7px;
		flex: 0 0 auto;
		height: 24px;
		margin-bottom: 4px;
		padding: 0 10px 0 4px;
		box-sizing: border-box;
		border: 0;
		border-radius: var(--rx-radius);
		background: none;
		color: var(--rx-on-chrome);
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}

	.tab:hover:not(.selected) {
		background-color: var(--rx-hover-on-chrome);
	}

	.tab.selected {
		height: 28px;
		margin-bottom: 0;
		border-radius: 7px 7px 0 0;
		background-color: var(--rx-surface);
		color: var(--rx-ink);
		font-weight: 600;
		cursor: default;
	}

	.tab.dragged {
		opacity: 0.4;
	}

	.tab.service-drop {
		outline: 2px dashed currentColor;
		outline-offset: -2px;
	}

	.rename {
		field-sizing: content;
		min-width: 40px;
		max-width: 180px;
		height: 20px;
		padding: 0 4px;
		border: 0;
		border-radius: 4px;
		outline: 2px solid var(--rx-accent);
		background-color: var(--rx-field);
		color: var(--rx-ink);
		font: inherit;
	}

	.tab.icon-only {
		gap: 3px;
		padding: 0 4px;
	}

	.tab.overflow {
		gap: 2px;
		padding: 0 6px 0 8px;
		font-size: 12px;
		font-weight: 600;
	}

	.all {
		display: grid;
		place-items: center;
		flex: 0 0 20px;
		width: 20px;
		height: 20px;
		border-radius: 27%;
		background-color: var(--rx-hover-on-chrome);
		fill: currentColor;
	}

	.tab.selected .all {
		background-color: var(--rx-line);
		fill: var(--rx-muted);
	}

	.badge {
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: 8px;
		background-color: var(--rx-alert);
		color: #FFFFFF;
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}

	.badge.dot {
		min-width: 8px;
		width: 8px;
		height: 8px;
		padding: 0;
	}

	.separator {
		position: relative;
		flex: 0 0 9px;
		align-self: center;
		height: 16px;
	}

	.separator::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 4px;
		width: 1px;
		background-color: var(--rx-on-chrome);
		opacity: 0.25;
	}

	.add {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		align-self: center;
		width: 28px;
		height: 24px;
		border: 0;
		border-radius: var(--rx-radius);
		background: none;
		color: var(--rx-on-chrome);
		cursor: pointer;
	}

	.add:hover {
		background-color: var(--rx-hover-on-chrome);
	}

	.ruler {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		width: max-content;
		visibility: hidden;
		pointer-events: none;
	}
</style>
