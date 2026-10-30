<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import { services } from './services.svelte.ts';
	import logo from '../../resources/logo/Logo.svg';

	const { messages }: { messages: Messages } = $props();

	const noServiceYet = $derived(!services.list.length);
</script>

<section class="welcome">
	{#if noServiceYet}
		<p class="callout" role="note">{messages['rail.addFirst']}</p>
	{/if}
	<img src={logo} alt="" width="96" height="96" />
	<h1>{messages['welcome.title']}</h1>
	<p>{noServiceYet ? messages['welcome.firstService'] : messages['welcome.body']}</p>
</section>

<style>
	.welcome {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 0 48px;
		box-sizing: border-box;
		text-align: center;
	}

	h1 {
		margin: 16px 0 6px;
		font-size: 22px;
		font-weight: 700;
	}

	p {
		max-width: 440px;
		margin: 0;
		color: var(--rx-muted);
		line-height: 1.5;
	}

	.callout {
		position: absolute;
		top: calc(var(--rx-rail-gutter) + var(--rx-rail-button) / 2);
		left: 12px;
		max-width: none;
		padding: 8px 12px;
		border-radius: 8px;
		background-color: var(--rx-ink);
		color: var(--rx-surface);
		font-size: 13px;
		font-weight: 600;
		transform: translateY(-50%);
	}

	.callout::before {
		content: '';
		position: absolute;
		top: 50%;
		left: -7px;
		border-top: 7px solid transparent;
		border-bottom: 7px solid transparent;
		border-right: 8px solid var(--rx-ink);
		transform: translateY(-50%);
	}
</style>
