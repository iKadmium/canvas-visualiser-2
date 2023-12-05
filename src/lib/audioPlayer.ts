import { sum } from 'mathjs';
import type { Writable } from 'svelte/store';
import SpectralAnalysis from './spectral-analysis?worker';

const graphicEqBands = [
	{
		name: '31.25Hz',
		from: 0,
		to: 1
	},
	{
		name: '62.5Hz',
		from: 2,
		to: 3
	},
	{
		name: '125Hz',
		from: 4,
		to: 6
	},
	{
		name: '250Hz',
		from: 7,
		to: 15
	},
	{
		name: '500Hz',
		from: 16,
		to: 31
	},
	{
		name: '1kHz',
		from: 32,
		to: 62
	},
	{
		name: '2kHz',
		from: 63,
		to: 125
	},
	{
		name: '4kHz',
		from: 126,
		to: 252
	},
	{
		name: '8kHz',
		from: 253,
		to: 501
	},
	{
		name: '16kHz',
		from: 502,
		to: 1488
	}
];

export class AudioPlayer {
	private offlineCtx: OfflineAudioContext | undefined;
	private audioBuffer: AudioBuffer | undefined;
	private rawBuffer: ArrayBuffer | undefined;
	private frameFft: number[][] | undefined;
	public length: number;

	constructor() {
		this.length = 0;
	}

	public async load(file: File, frameRate: number, progress: Writable<number>) {
		this.rawBuffer = await file.arrayBuffer();
		this.offlineCtx = new OfflineAudioContext({
			length: 1,
			sampleRate: 48000,
			numberOfChannels: 2
		});
		this.audioBuffer = await this.offlineCtx.decodeAudioData(this.rawBuffer);
		this.length = this.audioBuffer.duration;
		this.cacheFft(frameRate, progress);
	}

	public getFft(frame: number) {
		if (!this.audioBuffer) {
			throw new Error('Audio Buffer not initialised');
		}
		if (!this.frameFft) {
			throw new Error('Samples have not been loaded');
		}
		return this.frameFft[frame];
	}

	public getChannelCount(): number {
		if (!this.audioBuffer) {
			throw new Error('Audio buffer not initialized');
		}

		return this.audioBuffer.numberOfChannels;
	}

	public getSampleRate(): number {
		if (!this.audioBuffer) {
			throw new Error('Audio buffer not initialized');
		}

		return this.audioBuffer.sampleRate;
	}

	public getAudioTrack() {
		if (!this.offlineCtx || !this.audioBuffer) {
			throw new Error('Audio context not initialized');
		}
		const bufferSource = this.offlineCtx.createBufferSource();
		bufferSource.buffer = this.audioBuffer;
		return bufferSource;
	}

	private cacheFft(frameRate: number, progress: Writable<number>) {
		if (!this.audioBuffer) {
			throw new Error('Audio buffer not initialized');
		}
		const samplesPerFrame = this.audioBuffer.sampleRate / frameRate;
		const totalFrames = Math.floor(this.audioBuffer.length / samplesPerFrame);
		this.frameFft = [];
		const rawChannelData = this.audioBuffer.getChannelData(0);
		const windowSize = 2048;
		const channelData: number[] = [...rawChannelData];
		channelData.push(...new Array(windowSize).fill(0));
		const spectral = new SpectralAnalysis();

		// get the per-frame FFT data
		for (let frame = 0; frame < totalFrames; frame++) {
			const progressNum = frame / totalFrames;
			progress.set(progressNum);
			const start = Math.floor(samplesPerFrame * frame);
			const end = start + windowSize;
			const frameSamples = channelData.slice(start, end);
			const frameFft = calculateFFT(frameSamples, this.audioBuffer.sampleRate, windowSize, 0.99);
			this.frameFft[frame] = this.getEqBands(frameFft[1]);
		}

		//normalise the buckets
		for (let bucket = 0; bucket < this.frameFft[0].length; bucket++) {
			const bucketValues = this.frameFft.flatMap((x) => x);
			const max = Math.max(...bucketValues);
			for (let frame = 0; frame < totalFrames; frame++) {
				this.frameFft[frame][bucket] = this.frameFft[frame][bucket] / max;
			}
		}
	}

	private getEqBands(fft: number[]): number[] {
		const bandsData: number[] = [];
		for (const band of graphicEqBands) {
			const bandData = fft.slice(band.from, band.to);
			bandsData.push(sum(bandData));
		}
		return bandsData;
	}
}
