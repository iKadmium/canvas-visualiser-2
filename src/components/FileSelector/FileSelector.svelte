<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let fileInput: HTMLInputElement;
	let targetSelected = false;
	export let title: string;
	let currentFile: File | undefined;

	const dispatch = createEventDispatcher<{ fileSelected: File | undefined }>();

	function handleDragEnter() {
		targetSelected = true;
	}

	function handleDragLeave() {
		targetSelected = false;
	}

	function handleDeleteClick() {
		currentFile = undefined;
		dispatch('fileSelected', undefined);
	}

	function handleDrop(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		targetSelected = false;
		const files: File[] = [];
		if (event.dataTransfer?.items) {
			for (const item of event.dataTransfer.items) {
				const file = item.getAsFile();
				if (file) {
					files.push(file);
				}
			}
		}
		if (files.length > 0) {
			currentFile = files[0];
			dispatch('fileSelected', files[0]);
		}
	}
</script>

<div
	class="drag-drop-container"
	on:dragenter={handleDragEnter}
	on:dragleave={handleDragLeave}
	on:drop|preventDefault|stopPropagation={handleDrop}
	on:dragover|preventDefault={() => {}}
	on:drag
	class:has-value={currentFile}
	class:selected={targetSelected}
	role="region"
>
	<span>{title}</span>
	{#if currentFile}
		<button class="delete" on:click={handleDeleteClick}>&times;</button>
		<span>{currentFile.name}</span>
	{:else}
		<span>Drag and drop files here</span>
		<input type="file" bind:this={fileInput} />
	{/if}
</div>

<style>
	.delete {
		position: absolute;
		right: 0;
		top: 0;
		font-size: xx-large;
		background: none;
		border: none;
		color: unset;
		cursor: pointer;

		&:hover {
			background: color-mix(in srgb, var(--purple), transparent 90%);
		}
	}

	.drag-drop-container {
		position: relative;
		border: 1px solid var(--purple);
		border-radius: 1rem;
		padding: 1rem;
		min-height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		overflow: hidden;
	}

	.has-value {
		background: color-mix(in srgb, var(--green), transparent 90%);
	}

	span {
		pointer-events: none;
	}

	.selected {
		background: var(--green);
	}
</style>
