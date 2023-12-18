<script lang="ts">
	import { SceneGraph, type RendererOptions } from '$lib/sceneGraph';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	let canvas2d: HTMLCanvasElement;
	let canvas3d: HTMLCanvasElement;
	let playHead: HTMLInputElement;

	export let options: RendererOptions;
	export let audioFile: Writable<File | undefined>;
	export let imageFile: Writable<File | undefined>;
	let loading = false;
	export let width: number;
	export let height: number;
	let frameRate = 60;
	let currentFrame = 0;
	let progress: Writable<number> | undefined;

	let renderer: SceneGraph;
	const audio = new Audio();

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

	function loadImage(file: File | undefined) {
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
		audioFile.subscribe(async (audio) => {
			if (audio) {
				await loadAudio(audio);
			}
		});
		imageFile.subscribe((image) => {
			loadImage(image);
		});
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
</script>

{#if loading}
	<span>Loading...</span>
	{#if progress}
		<span>{formatProgress(($progress || 0) * 100)}%</span>
	{/if}
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
