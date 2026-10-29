<script lang="ts">
	import { messagesFor } from '../shared/i18n/index.ts';
	import type { AppState } from '../shared/channels.ts';
	import Icon from './Icon.svelte';

	let language = $state(window.shep.locale);
	const messages = $derived(messagesFor(language));
	let query = $state('');
	let found = $state<{ active: number; matches: number } | null>(null);
	let field = $state<HTMLInputElement>();
	const hasMatches = $derived(Boolean(query && found?.matches));
	const nothingFound = $derived(Boolean(query && found && !found.matches));

	window.shep.invoke('app:state').then(state => { language = (state as AppState).language; });
	window.shep.on('app:state', state => { language = (state as AppState).language; });
	window.shep.on('find:open', () => {
		field?.focus();
		field?.select();
		if ( query ) search();
	});
	window.shep.on('find:found', (active, matches) => { found = { active: Number(active), matches: Number(matches) }; });

	function search(forward = true) {
		if ( !query ) found = null;
		window.shep.invoke('find:search', query, forward);
	}

	function close() {
		found = null;
		window.shep.invoke('find:close');
	}

	function searchOnEnter(event: KeyboardEvent) {
		if ( event.key === 'Enter' ) search(!event.shiftKey);
	}
</script>

<svelte:window onkeydown={event => { if ( event.key === 'Escape' ) close(); }} />

<div class="panel" class:nothing-found={nothingFound}>
	<input bind:this={field} bind:value={query} type="search" placeholder={messages['find.placeholder']} aria-label={messages['find.placeholder']}
		oninput={() => search()} onkeydown={searchOnEnter} />
	<span class="matches" aria-live="polite">{#if hasMatches}{found?.active}/{found?.matches}{:else if nothingFound}<span aria-hidden="true">0/0</span><span class="spoken-only">{messages['find.none']}</span>{/if}</span>
	<span class="divider"></span>
	<button type="button" title={messages['find.previous']} aria-label={messages['find.previous']} disabled={!hasMatches} onclick={() => search(false)}><Icon name="up" /></button>
	<button type="button" title={messages['find.next']} aria-label={messages['find.next']} disabled={!hasMatches} onclick={() => search(true)}><Icon name="down" /></button>
	<button type="button" title={messages['dialog.close']} aria-label={messages['dialog.close']} onclick={close}><Icon name="close" /></button>
</div>

<style>
	.panel {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 44px;
		margin: 4px 8px 16px;
		padding: 0 8px 0 14px;
		border-radius: 10px;
		background-color: var(--rx-raised);
		color: var(--rx-ink);
		box-shadow: 0 0 0 1px var(--rx-line), 0 4px 12px var(--rx-shadow);
		font-size: 13px;
	}

	.panel.nothing-found {
		box-shadow: 0 0 0 1px var(--rx-hue-red), 0 4px 12px var(--rx-shadow);
	}

	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}

	input::-webkit-search-cancel-button {
		appearance: none;
	}

	input::placeholder {
		color: var(--rx-muted);
	}

	.matches {
		padding: 0 6px;
		color: var(--rx-muted);
		font-variant-numeric: tabular-nums;
	}

	.nothing-found .matches {
		color: var(--rx-hue-red);
	}

	.divider {
		width: 1px;
		height: 20px;
		margin: 0 6px;
		background-color: var(--rx-line);
	}

	button {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--rx-ink) 8%, transparent);
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.spoken-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
