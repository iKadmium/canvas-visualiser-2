<script lang="ts">
	import type { RendererOptions } from '$lib/renderer';
	import FileSelector from '../components/FileSelector/FileSelector.svelte';
	import Options from '../components/Options/Options.svelte';
	import Preview from '../components/Preview/Preview.svelte';

	let files: File[] = [];
	let options: RendererOptions = {
		artist: 'Kadmium',
		title: "Don't Pay the Ferryman",
		audioBitrate: 256,
		videoBitrate: 20,

		eqBandCount: 8,
		eqLineWidth: 16,
		eqGlowWidth: 64,
		textFillStyle: '#f8f8f2',
		playheadStrokeStyle: '#f8f8f2',
		playheadLineWidth: 2,
		lowerThirdFillStyle: '#282a36',
		lowerThirdOpacity: 0,
		eqLineStyle: '#282a36',
		eqGlowStyle: '#bd93f9',
		font: 'normal 300 32px Roboto',
		imageSmoothing: true
	};

	let width = 1920;
	let height = 1080;
</script>

<h1>Visualiser generator</h1>

<FileSelector on:fileSelected={(event) => (files = event.detail)} />
<Options bind:options bind:width bind:height />

{#if files.length > 0}
	<Preview {files} {options} {width} {height} />
{/if}
