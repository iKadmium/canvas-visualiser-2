<script lang="ts">
	import { getContext } from 'svelte';
	import type { TabContext } from '../TabStrip/TabStrip.svelte';

	export let id: string;

	const { active } = getContext<TabContext>('tabContext');
</script>

{#if $active === id}
	<slot />
{/if}
