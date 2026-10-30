<script lang="ts">
	import type { Messages } from '../shared/i18n/index.ts';
	import logo from '../../resources/logo/Logo.svg';

	const { messages }: { messages: Messages } = $props();
</script>

<section class="migrating" role="status" aria-live="polite">
	<img src={logo} alt="" width="72" height="72" />
	<h1>{messages['migrating.title']}</h1>
	<p>{messages['migrating.body']}</p>
	<span class="spinner" aria-hidden="true"></span>
</section>

<style>
	.migrating {
		position: fixed;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0 48px;
		background-color: var(--rx-surface);
		color: var(--rx-ink);
		text-align: center;
		-webkit-app-region: drag;
	}

	h1 {
		margin: 16px 0 6px;
		font-size: 20px;
		font-weight: 700;
	}

	p {
		max-width: 420px;
		margin: 0;
		color: var(--rx-muted);
		line-height: 1.5;
	}

	.spinner {
		width: 22px;
		height: 22px;
		margin-top: 20px;
		border: 3px solid color-mix(in srgb, var(--rx-muted) 30%, transparent);
		border-top-color: var(--rx-accent);
		border-radius: 50%;
		animation: turn 0.9s linear infinite;
	}

	@keyframes turn {
		to { transform: rotate(360deg); }
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 3s;
		}
	}
</style>
