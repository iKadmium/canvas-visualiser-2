<script lang="ts">
	import type { RendererOptions } from '$lib/sceneGraph';
	import Tab from '../Tab/Tab.svelte';
	import TabStrip, { type TabConfig } from '../TabStrip/TabStrip.svelte';

	export let options: RendererOptions;
	export let width: number;
	export let height: number;

	const tabs: TabConfig[] = [
		{
			id: 'main',
			title: 'Main'
		},
		{
			id: 'rendering',
			title: 'Rendering'
		},
		{
			id: 'style',
			title: 'Style'
		}
	];
</script>

<TabStrip {tabs}>
	<Tab id="main">
		<div class="options">
			<label for="width">Width</label><input type="number" bind:value={width} min="1" id="width" />
			<label for="height">Height</label><input type="number" bind:value={height} min="1" id="height" />
			<label for="artist">Artist</label><input type="text" bind:value={options.artist} id="artist" />
			<label for="title">Title</label><input type="text" bind:value={options.title} id="title" />
		</div>
	</Tab>
	<Tab id="style">
		<div class="options">
			<label for="eqBandCount">EQ Band Count</label><input type="number" bind:value={options.eqBandCount} min="1" max="32" id="eqBandCount" />
			<label for="eqLineWidth">EQ Line Width</label><input type="number" bind:value={options.eqSegmentWidth} min="1" max="64" id="eqLineWidth" />
			<label for="eqGlowIntensity">EQ Glow Intensity</label><input
				type="number"
				bind:value={options.eqGlowIntensity}
				min="0"
				max="1"
				step="0.001"
				id="eqGlowIntensity"
			/>
			<label for="eqLineStyle">EQ Line Style</label><input type="color" bind:value={options.eqLineStyle} id="eqLineStyle" />
			<label for="eqGlowStyle">EQ Glow Style</label><input type="color" bind:value={options.eqGlowStyle} id="eqGlowStyle" />
			<label for="lowerThirdFillStyle">Lower Third Fill Style</label><input type="color" bind:value={options.lowerThirdFillStyle} id="lowerThirdFillStyle" />
			<label for="lowerThirdOpacity">Lower Third Opacity</label>
			<input type="number" bind:value={options.lowerThirdOpacity} min="0" max="1" step="0.01" id="lowerThirdOpacity" />
			<label for="playheadStrokeStyle">Playhead Stroke Style</label><input type="color" bind:value={options.playheadStrokeStyle} id="playheadStrokeStyle" />
			<label for="playheadLineWidth">Playhead Line Width</label>
			<input type="number" bind:value={options.playheadLineWidth} min="1" max="32" id="playheadLineWidth" />
			<label for="textFillStyle">Text Fill Style</label><input type="color" bind:value={options.textFillStyle} id="textFillStyle" />
			<label for="font">Font</label><input type="text" bind:value={options.font} id="font" />
			<label for="imageSmoothing">Image Smoothing Enabled</label><input type="checkbox" bind:checked={options.imageSmoothing} />
		</div>
	</Tab>
	<Tab id="rendering">
		<div class="options">
			<label for="video-bitrate">Video Bitrate (mbps)</label><input type="number" bind:value={options.videoBitrate} min="1" id="video-bitrate" />
			<label for="audio-bitrate">Audio Bitrate (kbps)</label><input type="number" bind:value={options.audioBitrate} min="1" id="audio-bitrate" />
		</div>
	</Tab>
</TabStrip>

<style>
	.options {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 2rem;
		row-gap: 0.5rem;
	}

	input[type='text'],
	input[type='number'] {
		max-width: 12rem;

		background: none;
		border: 1px solid var(--purple);
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;

		color: unset;
	}

	input[type='checkbox'] {
		max-width: 1rem;
	}

	input[type='color'] {
		background: none;
		border: 1px solid var(--purple);
		border-radius: 1rem;
		padding: 0.25rem 0.25rem;

		color: unset;
	}
</style>
