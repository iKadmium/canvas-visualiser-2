<script lang="ts">
	import type { RendererOptions } from '$lib/sceneGraph';
	import { writable } from 'svelte/store';
	import FileSelector from '../components/FileSelector/FileSelector.svelte';
	import Options from '../components/Options/Options.svelte';
	import Preview from '../components/Preview/Preview.svelte';

	const audioFile = writable<File | undefined>();
	const imageFile = writable<File | undefined>();
	const lyricsFile = writable<File | undefined>();

	let options: RendererOptions = {
		artist: 'Kadmium',
		title: "Don't Pay the Ferryman",
		audioBitrate: 256,
		videoBitrate: 20,

		width: 1920,
		height: 1080,

		smoothingFrames: 10,
		eqSegmentWidth: 0.04,
		eqGlowIntensity: 0.01,
		scopeColor: '#bd93f9',
		waterColor: '#bd93f9',
		textFillStyle: '#f8f8f2',
		playheadStrokeStyle: '#f8f8f2',
		playheadLineWidth: 2,
		lowerThirdFillStyle: '#282a36',
		lowerThirdOpacity: 0,
		eqLineHeightMultiplier: 1,
		eqLineStyle: '#282a36',
		eqGlowStyle: '#bd93f9',
		font: 'normal 300 32px Roboto',
		imageSmoothing: true,

		eqEnabled: true,
		scopeEnabled: false,
		discoteqEnabled: false,
		wetEnabled: false,

		lyricsFadeInTime: 3,
		lyricsFadeOutTime: 3
	};
</script>

<h1>Visualiser generator</h1>

<div class="file-selectors">
	<FileSelector title="Audio Files" on:fileSelected={(event) => audioFile.set(event.detail)} />
	<FileSelector title="Background" on:fileSelected={(event) => imageFile.set(event.detail)} />
	<FileSelector title="Lyrics" on:fileSelected={(event) => lyricsFile.set(event.detail)} />
</div>
<Options bind:options />

{#if audioFile}
	<Preview {audioFile} {imageFile} {options} {lyricsFile} />
{/if}

<style>
	.file-selectors {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
</style>
