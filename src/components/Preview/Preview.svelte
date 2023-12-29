<script lang="ts">
	import { SceneGraph, type RendererOptions } from '$lib/sceneGraph';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { writable, type Unsubscriber, type Writable } from 'svelte/store';

	let canvas2d: HTMLCanvasElement;
	let playHead: HTMLInputElement;
	const unsubscribers: Unsubscriber[] = [];

	export let options: RendererOptions;
	export let audioFile: Writable<File | undefined>;
	export let imageFile: Writable<File | undefined>;
	let loading = false;
	let frameRate = 60;
	let currentFrame = 0;
	let progress: Writable<number> | undefined;

	let sceneGraph: SceneGraph;

	async function loadAudio(file: File) {
		loading = true;
		progress = writable(0);
		try {
			await sceneGraph.loadAudio(file, progress);
			sceneGraph.draw();
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
			await sceneGraph.loadImage(file);
		} catch (reason) {
			console.error(reason);
		} finally {
			loading = false;
		}
	}

	async function handleSeek(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		currentFrame = parseInt(event.currentTarget.value);
		sceneGraph.seek(currentFrame);
		sceneGraph.draw();
	}

	async function handlePlayPause() {
		if (sceneGraph.isPlaying()) {
			sceneGraph.stop();
		} else {
			sceneGraph.play();
		}
	}

	async function handleRender() {
		if (sceneGraph.isPlaying()) {
			sceneGraph.stop();
		}
		await sceneGraph.export();
	}

	function formatProgress(prog: number) {
		const intl = Intl.NumberFormat(navigator.language, {
			maximumFractionDigits: 0
		});
		return intl.format(prog);
	}

	onMount(async () => {
		sceneGraph = new SceneGraph(frameRate, playHead, canvas2d, options);
		await sceneGraph.init();
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
		sceneGraph.draw();
	});

	onDestroy(() => {
		for (const unsubscriber of unsubscribers) {
			unsubscriber();
		}
		sceneGraph.stop();
	});

	afterUpdate(async () => {
		await sceneGraph.setOptions(options);
		sceneGraph.draw();
	});
</script>

{#if loading}
	<span>Loading...</span>
	{#if progress}
		<span>{formatProgress(($progress || 0) * 100)}%</span>
	{/if}
{/if}

<br />
<canvas bind:this={canvas2d} width={options.width} height={options.height} />
<br />
<input type="range" style={`width: ${options.width}px`} on:input={handleSeek} on:change={handleSeek} bind:this={playHead} />
<br />
<button on:click={handlePlayPause}>Play</button>
<button on:click={handleRender}>Render</button>

<style>
	canvas {
		border: 1px solid var(--purple);
	}
</style>
