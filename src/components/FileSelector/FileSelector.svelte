<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let fileInput: HTMLInputElement;
	let targetSelected = false;

	const dispatch = createEventDispatcher<{ fileSelected: File[] }>();

	function handleDragEnter() {
		targetSelected = true;
	}
	function handleDragLeave() {
		targetSelected = false;
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
			dispatch('fileSelected', files);
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
	class:selected={targetSelected}
	role="region"
>
	<span>Drag and drop files here</span>
	<input type="file" bind:this={fileInput} />
</div>

<style>
	.drag-drop-container {
		border: 1px solid var(--purple);
		border-radius: 1rem;
		padding: 1rem;
		min-height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
	}

	span {
		pointer-events: none;
	}

	.selected {
		background: var(--green);
	}
</style>
