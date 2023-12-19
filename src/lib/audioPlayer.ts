import type { Writable } from 'svelte/store';
import type { SpectralAnalysisMessage, SpectralProgressMessage, SpectralResultMessage } from './spectral-analysis';
import SpectralAnalysis from './spectral-analysis?worker';
import { mean } from './mean';

export class AudioPlayer {
	private offlineCtx: OfflineAudioContext | undefined;
	private audioBuffer: AudioBuffer | undefined;
	private rawBuffer: ArrayBuffer | undefined;
	private frameFft: number[][] | undefined;
	private spectral: Worker;
	private audio: HTMLAudioElement;
	public length: number;

	constructor() {
		this.length = 0;
		this.spectral = new SpectralAnalysis();
		this.audio = new Audio();
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
		this.frameFft = await this.cacheFft(frameRate, progress);
		const url = URL.createObjectURL(file);
		this.audio.src = url;
	}

	public getSmoothedFft(frame: number, smoothingFrames: number): number[] {
		if (!this.audioBuffer) {
			return new Array(10).fill(0);
			//throw new Error('Audio Buffer not initialised');
		}
		if (!this.frameFft) {
			throw new Error('Samples have not been loaded');
		}
		const smoothed: number[] = [];
		for (let i = 0; i < this.frameFft[frame].length; i++) {
			const values: number[] = [];
			for (let j = frame; j < smoothingFrames + frame && j < this.frameFft.length; j++) {
				values.push(this.frameFft[j][i]);
			}
			smoothed.push(mean(values));
		}
		return smoothed;
	}

	public getFft(frame: number) {
		if (!this.audioBuffer) {
			return new Array(10).fill(0);
		}
		if (!this.frameFft) {
			throw new Error('Samples have not been loaded');
		}
		return this.frameFft[frame];
	}

	public getChannelData(frame: number, frameRate: number, channel: number) {
		if (!this.audioBuffer) {
			return new Float32Array(800);
		}
		const samplesPerFrame = this.audioBuffer.sampleRate / frameRate;
		const from = samplesPerFrame * frame;
		const to = samplesPerFrame * (frame + 1);
		return this.audioBuffer.getChannelData(channel).subarray(from, to);
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

	public async play() {
		await this.audio.play();
	}

	public stop() {
		this.audio.pause();
	}

	public getAudioTime() {
		return this.audio.currentTime;
	}

	public seek(time: number) {
		this.audio.currentTime = time;
	}

	private cacheFft(frameRate: number, progress: Writable<number>) {
		return new Promise<number[][]>((resolve) => {
			if (!this.audioBuffer) {
				throw new Error('Audio buffer not initialized');
			}
			const handler = (event: MessageEvent<SpectralResultMessage | SpectralProgressMessage>) => {
				switch (event.data.type) {
					case 'progress':
						progress.set(event.data.progress);
						break;
					case 'result':
						this.spectral.removeEventListener('message', handler);
						resolve(event.data.result);
						break;
				}
			};
			this.spectral.addEventListener('message', handler);
			this.frameFft = [];
			const rawChannelData = this.audioBuffer.getChannelData(0);
			const message: SpectralAnalysisMessage = {
				channelData: rawChannelData,
				frameRate,
				length: this.audioBuffer.length,
				sampleRate: this.audioBuffer.sampleRate
			};
			this.spectral.postMessage(message);
		});
	}
}
