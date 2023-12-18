<script lang="ts">
	import { SceneGraph, type RendererOptions } from '$lib/sceneGraph';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { writable, type Unsubscriber, type Writable } from 'svelte/store';

	let canvas2d: HTMLCanvasElement;
	let canvas3d: HTMLCanvasElement;
	let playHead: HTMLInputElement;
	const unsubscribers: Unsubscriber[] = [];

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

	async function loadAudio(file: File) {
		loading = true;
		progress = writable(0);
		try {
			await renderer.loadAudio(file, progress);
			renderer.draw();
		} catch (reason) {
			console.error(reason);
		} finally {
			loading = false;
			progress = undefined;
		}
	}

	async function loadImage(file: File | undefined) {
		loading = true;
		try {
			await renderer.loadImage(file);
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
	}

	async function handlePlayPause() {
		if (renderer.isPlaying()) {
			renderer.stop();
		} else {
			renderer.play();
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
		await renderer.init();
		unsubscribers.push(
			audioFile.subscribe(async (audio) => {
				if (audio) {
					await loadAudio(audio);
				}
			})
		);
		unsubscribers.push(
			imageFile.subscribe((image) => {
				loadImage(image);
			})
		);
		renderer.draw();
	});

	onDestroy(() => {
		for (const unsubscriber of unsubscribers) {
			unsubscriber();
		}
		renderer.stop();
	});

	afterUpdate(() => {
		renderer.setOptions(options);
		// if (!loading && $audioFile && $imageFile) {
		// 	renderer.draw();
		// }
		renderer.draw();
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
<input type="range" style={`width: ${width}px`} on:input={handleSeek} on:change={handleSeek} bind:this={playHead} />
<br />
<button on:click={handlePlayPause}>Play</button>
<button on:click={handleRender}>Render</button>

<br />
<canvas bind:this={canvas3d} {width} {height} style="visibility: hidden;" />

<style>
	canvas {
		border: 1px solid var(--purple);
	}
</style>
