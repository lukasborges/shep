<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import { services, activeService, navigate, resetZoom, openFind } from './services.svelte.ts';
	import { zoomPercent } from '../shared/zoom.ts';
	import { pageTitleBesideName } from '../shared/service.ts';
	import { initials } from './initials.ts';
	import Icon from './Icon.svelte';

	const { messages }: { messages: Messages } = $props();

	const service = $derived(activeService());
	const detail = $derived(services.hover || (service ? pageTitleBesideName(service.name, service.pageTitle) : ''));
</script>

<header class="titlebar">
	{#if service}
		<div class="group start">
			<button type="button" title={messages['titlebar.back']} aria-label={messages['titlebar.back']} disabled={!service.canGoBack} onclick={() => navigate(service.id, 'back')}><Icon name="back" /></button>
			<button type="button" title={messages['titlebar.forward']} aria-label={messages['titlebar.forward']} disabled={!service.canGoForward} onclick={() => navigate(service.id, 'forward')}><Icon name="forward" /></button>
			<button type="button" title={messages['titlebar.reload']} aria-label={messages['titlebar.reload']} class:loading={service.loading} onclick={() => navigate(service.id, 'reload')}><Icon name="reload" /></button>
			<button type="button" title={messages['titlebar.home']} aria-label={messages['titlebar.home']} onclick={() => navigate(service.id, 'home')}><Icon name="home" /></button>
		</div>
	{/if}

	<div class="identity">
		{#if service}
			{#if service.favicon}<img src={service.favicon} alt="" width="16" height="16" />{:else}<span class="initials">{initials(service.name)}</span>{/if}
			<b>{service.name}</b>
			{#if detail}<span class="detail">{detail}</span>{/if}
		{:else}
			<b>Shep</b>
		{/if}
	</div>

	{#if service}
		<div class="group end">
			{#if service.zoomLevel !== 0}
				<button type="button" class="zoom" title={messages['titlebar.actualSize']} aria-label={messages['titlebar.actualSize']} onclick={() => resetZoom(service.id)}>{zoomPercent(service.zoomLevel)}%</button>
			{/if}
			<button type="button" title={messages['titlebar.find']} aria-label={messages['titlebar.find']} onclick={openFind}><Icon name="find" /></button>
		</div>
	{/if}
</header>

<style>
	.titlebar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
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
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 2px;
		background-color: var(--rx-chrome);
		-webkit-app-region: no-drag;
	}

	.group.end {
		margin-left: auto;
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

	/* centred on the window, not on the space the buttons leave */
	.identity {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 50vw;
		white-space: nowrap;
		pointer-events: none;
	}

	.identity img, .identity .initials {
		flex: 0 0 16px;
		width: 16px;
		height: 16px;
	}

	.identity .initials {
		display: grid;
		place-items: center;
		border-radius: 4px;
		background-color: var(--rx-muted);
		color: #FFFFFF;
		font-size: 8px;
		font-weight: 700;
	}

	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.7;
	}
</style>
