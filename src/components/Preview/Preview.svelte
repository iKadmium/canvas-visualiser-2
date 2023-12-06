<script lang="ts">
	import { SceneGraph, type RendererOptions } from '$lib/sceneGraph';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	let canvas2d: HTMLCanvasElement;
	let canvas3d: HTMLCanvasElement;
	let playHead: HTMLInputElement;

	export let files: File[];
	export let options: RendererOptions;
	let audioFiles: File[] = [];
	let imageFiles: File[] = [];
	let loading = false;
	export let width: number;
	export let height: number;
	let frameRate = 60;
	let currentFrame = 0;
	let progress: Writable<number> | undefined;

	let renderer: SceneGraph;
	const audio = new Audio();

	async function handleAudioFileChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const index = parseInt(event.currentTarget.value);
		await loadAudio(audioFiles[index]);
	}

	async function handleImageFileChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const index = parseInt(event.currentTarget.value);
		loadImage(imageFiles[index]);
	}

	async function loadAudio(file: File) {
		loading = true;
		progress = writable(0);
		try {
			await renderer.loadAudio(file, progress);
			const url = URL.createObjectURL(file);
			audio.src = url;
			renderer.draw();
		} catch (reason) {
			console.error(reason);
		} finally {
			loading = false;
			progress = undefined;
		}
	}

	function loadImage(file: File) {
		loading = true;
		try {
			renderer.loadImage(file);
		} catch (reason) {
			console.error(reason);
		} finally {
			loading = false;
		}
	}

	async function handleSeek(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		currentFrame = parseInt(event.currentTarget.value);
		renderer.seek(currentFrame);
		renderer.draw();
		audio.currentTime = currentFrame / frameRate;
	}

	async function handlePlayPause() {
		if (renderer.isPlaying()) {
			renderer.stop();
			audio.pause();
		} else {
			renderer.play();
			await audio.play();
		}
	}

	async function handleRender() {
		if (renderer.isPlaying()) {
			renderer.stop();
		}
		await renderer.export();
	}

	function formatProgress(prog: number) {
		const intl = Intl.NumberFormat(navigator.language, {
			maximumFractionDigits: 0
		});
		return intl.format(prog);
	}

	onMount(async () => {
		renderer = new SceneGraph(frameRate, playHead, canvas2d, canvas3d, options);

		if (audioFiles.length > 0) {
			await loadAudio(audioFiles[0]);
		}
		if (imageFiles.length > 0) {
			loadImage(imageFiles[0]);
		}
		renderer.draw();
	});

	onDestroy(() => {
		renderer.stop();
		audio.pause();
	});

	afterUpdate(() => {
		renderer.options = options;
		if (!loading) {
			renderer.draw();
		}
	});

	audioFiles = files.filter((file) => file.type.split('/')[0] === 'audio');
	imageFiles = files.filter((file) => file.type.split('/')[0] === 'image');
</script>

{#if audioFiles.length > 0}
	<select value={0} on:change={handleAudioFileChange}>
		{#each audioFiles as file, index}
			<option value={index}>{file.name}</option>
		{/each}
	</select>
	<select value={0} on:change={handleImageFileChange}>
		{#each imageFiles as file, index}
			<option value={index}>{file.name}</option>
		{/each}
	</select>
	{#if loading}
		<span>Loading...</span>
		{#if progress}
			<span>{formatProgress(($progress || 0) * 100)}%</span>
		{/if}
	{/if}
{:else}
	<span>Error: at least one audio file (and optionally at least one image file) is required.</span>
{/if}

<br />
<canvas bind:this={canvas2d} {width} {height} />
<br />
<canvas bind:this={canvas3d} {width} {height} style="display: none;" />

<input type="range" style={`width: ${width}px`} on:input={handleSeek} on:change={handleSeek} bind:this={playHead} />
<br />
<button on:click={handlePlayPause}>Play</button>
<button on:click={handleRender}>Render</button>

<style>
	canvas {
		border: 1px solid var(--purple);
	}
</style>
