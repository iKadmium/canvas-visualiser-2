<script lang="ts" context="module">
	export interface TabConfig {
		id: string;
		title: string;
	}

	export interface TabContext {
		active: Writable<string>;
	}
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	export let tabs: TabConfig[];

	const active = writable<string>(tabs[0].id);

	const tabContext: TabContext = {
		active
	};

	setContext('tabContext', tabContext);
</script>

<ul class="headers">
	{#each tabs as tab}
		<li class="header-container">
			<button class:active={$active === tab.id} class="header" on:click|preventDefault={() => tabContext.active.set(tab.id)}> {tab.title}</button>
		</li>
	{/each}
</ul>
<slot />

<style>
	.headers {
		display: flex;
		list-style: none;
		padding-inline-start: 0;
		border-bottom: 1px solid var(--purple);
	}

	.header {
		background: none;
		border: none;
		cursor: pointer;
		color: unset;

		padding: 1rem;
		font-size: larger;

		&:hover {
			background: color-mix(in srgb, var(--purple), transparent 90%);
		}
	}

	.active {
		border-bottom: 4px solid var(--purple);
	}
</style>
