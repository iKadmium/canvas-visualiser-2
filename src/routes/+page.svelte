<script lang="ts">
	import FileSelector from '../components/FileSelector/FileSelector.svelte';
	import Preview from '../components/Preview/Preview.svelte';

	let files: File[] = [];
</script>

<h1>Visualiser generator</h1>

<FileSelector on:fileSelected={(event) => (files = event.detail)} />

{#if files.length > 0}
	<Preview {files} />
{/if}
