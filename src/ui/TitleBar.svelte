<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import { services, activeService, navigate, resetZoom, openFind } from './services.svelte.ts';
	import { zoomPercent } from '../shared/zoom.ts';
	import { pageTitleBesideName, type Navigation } from '../shared/service.ts';
	import Icon from './Icon.svelte';
	import WorkspaceTabs from './WorkspaceTabs.svelte';

	const { messages }: { messages: Messages } = $props();

	const WINDOW_DRAG_ROOM = 48;

	const service = $derived(activeService());
	let middleWidth = $state(0);

	function windowTitle(): string {
		if ( !service ) return 'Shep';
		const pageTitle = pageTitleBesideName(service.name, service.pageTitle);
		return pageTitle ? `${pageTitle} - ${service.name}` : service.name;
	}

	function go(where: Navigation) {
		if ( service ) navigate(service.id, where);
	}

	$effect(() => { document.title = windowTitle(); });
</script>

<header class="titlebar">
	<div class="group start">
		<button type="button" title={messages['titlebar.back']} aria-label={messages['titlebar.back']} disabled={!service?.canGoBack} onclick={() => go('back')}><Icon name="back" /></button>
		<button type="button" title={messages['titlebar.forward']} aria-label={messages['titlebar.forward']} disabled={!service?.canGoForward} onclick={() => go('forward')}><Icon name="forward" /></button>
		<button type="button" title={messages['titlebar.reload']} aria-label={messages['titlebar.reload']} disabled={!service} class:loading={service?.loading} onclick={() => go('reload')}><Icon name="reload" /></button>
		<button type="button" title={messages['titlebar.home']} aria-label={messages['titlebar.home']} disabled={!service} onclick={() => go('home')}><Icon name="home" /></button>
	</div>

	<div class="middle" bind:clientWidth={middleWidth}>
		<WorkspaceTabs {messages} room={middleWidth - WINDOW_DRAG_ROOM} />
		<span class="link-under-pointer">{services.hover}</span>
	</div>

	<div class="group end">
		{#if service && service.zoomLevel !== 0}
			<button type="button" class="zoom" title={messages['titlebar.actualSize']} aria-label={messages['titlebar.actualSize']} onclick={() => resetZoom(service.id)}>{zoomPercent(service.zoomLevel)}%</button>
		{/if}
		<button type="button" title={messages['titlebar.find']} aria-label={messages['titlebar.find']} disabled={!service} onclick={openFind}><Icon name="find" /></button>
	</div>
</header>

<style>
	.titlebar {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: var(--rx-chrome);
		color: var(--rx-on-chrome);
		/* the window buttons the system paints over one end */
		padding-left: max(8px, env(titlebar-area-x, 0px));
		padding-right: max(8px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)));
		-webkit-app-region: drag;
		user-select: none;
		font-size: 13px;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 0 0 auto;
		-webkit-app-region: no-drag;
	}

	button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 24px;
		border: 0;
		border-radius: var(--rx-radius);
		background: none;
		color: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background-color: var(--rx-hover-on-chrome);
	}

	button.zoom {
		width: auto;
		padding: 0 6px;
		font: inherit;
		font-variant-numeric: tabular-nums;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	button.loading :global(svg) {
		animation: turn 1s linear infinite;
	}

	@keyframes turn {
		to { transform: rotate(360deg); }
	}

	.middle {
		display: flex;
		align-self: stretch;
		gap: 8px;
		flex: 1 1 0;
		min-width: 0;
	}

	.link-under-pointer {
		flex: 1 1 0;
		min-width: 0;
		align-self: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
		opacity: 0.7;
		pointer-events: none;
	}
</style>
