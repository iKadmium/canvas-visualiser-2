<script lang="ts">
	import type { RendererOptions } from '$lib/sceneGraph';
	import { writable } from 'svelte/store';
	import FileSelector from '../components/FileSelector/FileSelector.svelte';
	import Options from '../components/Options/Options.svelte';
	import Preview from '../components/Preview/Preview.svelte';

	const audioFile = writable<File | undefined>();
	const imageFile = writable<File | undefined>();
	let options: RendererOptions = {
		artist: 'Kadmium',
		title: "Don't Pay the Ferryman",
		audioBitrate: 256,
		videoBitrate: 20,

		smoothingFrames: 10,
		eqSegmentWidth: 0.04,
		eqGlowIntensity: 0.01,
		textFillStyle: '#f8f8f2',
		playheadStrokeStyle: '#f8f8f2',
		playheadLineWidth: 2,
		lowerThirdFillStyle: '#282a36',
		lowerThirdOpacity: 0,
		eqLineHeightMultiplier: 1,
		eqLineStyle: '#282a36',
		eqGlowStyle: '#bd93f9',
		font: 'normal 300 32px Roboto',
		imageSmoothing: true
	};

	let width = 1920;
	let height = 1080;
</script>

<h1>Visualiser generator</h1>

<div class="file-selectors">
	<FileSelector title="Audio Files" on:fileSelected={(event) => audioFile.set(event.detail)} />
	<FileSelector title="Background" on:fileSelected={(event) => imageFile.set(event.detail)} />
</div>
<Options bind:options bind:width bind:height />

{#if audioFile}
	<Preview {audioFile} {imageFile} {options} {width} {height} />
{/if}

<style>
	.file-selectors {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
</style>
