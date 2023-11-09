<script lang="ts">
	import { Renderer2d, type RendererOptions } from '$lib/renderer';
	import { onDestroy, onMount } from 'svelte';

	let canvas2d: HTMLCanvasElement;
	let playHead: HTMLInputElement;

	export let files: File[];
	let audioFiles: File[] = [];
	let imageFiles: File[] = [];
	let loading = false;
	let width = 1280;
	let height = 720;
	let frameRate = 60;
	let currentFrame = 0;

	let renderer: Renderer2d;
	const audio = new Audio();

	async function handleAudioFileChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const index = parseInt(event.currentTarget.value);
		await loadAudio(audioFiles[index]);
	}

	async function handleImageFileChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const index = parseInt(event.currentTarget.value);
		await loadImage(imageFiles[index]);
	}

	async function loadAudio(file: File) {
		loading = true;
		try {
			await renderer.loadAudio(file);
			const url = URL.createObjectURL(file);
			audio.src = url;
			await renderer.update();
			renderer.draw();
		} catch (reason) {
			console.error(reason);
		} finally {
			loading = false;
		}
	}

	async function loadImage(file: File) {
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
		await renderer.update();
		renderer.draw(false);
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

	onMount(async () => {
		const options: RendererOptions = {
			artist: 'Kadmium',
			title: "Don't Pay the Ferryman",
			artistFillStyle: '#282a36',
			titleFillStyle: '#282a36',
			timeFillStyle: '#282a36',
			playheadStrokeStyle: '#282a36',
			playheadTrackStrokeStyle: '#282a36',
			lowerThirdFillStyle: '#282a3600',
			eqLineStyle: '#282a36',
			eqGlowStyle: '#bd93f9'
		};
		renderer = new Renderer2d(frameRate, playHead, canvas2d, options);

		if (audioFiles.length > 0) {
			await loadAudio(audioFiles[0]);
		}
		if (imageFiles.length > 0) {
			await loadImage(imageFiles[0]);
		}
		await renderer.update();
		renderer.draw(false);
	});

	onDestroy(() => {
		renderer.stop();
		audio.pause();
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
	{/if}
{:else}
	<span>Error: at least one audio file (and optionally at least one image file) is required.</span>
{/if}

<br />
<canvas bind:this={canvas2d} {width} {height} />

<input type="range" style={`width: ${width}px`} on:input={handleSeek} on:change={handleSeek} bind:this={playHead} />
<br />
<button on:click={handlePlayPause}>Play</button>
<button on:click={handleRender}>Render</button>

<style>
	canvas {
		border: 1px solid var(--purple);
	}
</style>
