import type { Writable } from 'svelte/store';
import { AudioPlayer } from './audioPlayer';
import { EncoderExporter } from './encoderExporter';
import type { IExporter } from './exporter';
import { Renderer2d } from './renderer2d';
import { RendererWebGpu } from './rendererWebGpu';

export interface RendererOptions {
	artist: string;
	title: string;
	audioBitrate: number;
	videoBitrate: number;

	smoothingFrames: number;
	eqLineHeightMultiplier: number;
	eqLineStyle: string;
	eqSegmentWidth: number;
	eqGlowIntensity: number;
	eqGlowStyle: string;
	lowerThirdFillStyle: string | CanvasGradient | CanvasPattern;
	lowerThirdOpacity: number;
	playheadStrokeStyle: string | CanvasGradient | CanvasPattern;
	playheadLineWidth: number;
	textFillStyle: string | CanvasGradient | CanvasPattern;
	font: string;
	imageSmoothing: boolean;
}

export class SceneGraph {
	private playing: boolean;
	private currentFrame: number;
	private frameRate: number;
	private audioPlayer: AudioPlayer;
	private playHead: HTMLInputElement;
	private totalFrames: number;
	private renderer2d: Renderer2d;
	private renderer3d: RendererWebGpu;
	private canvas2d: HTMLCanvasElement;
	private canvas3d: HTMLCanvasElement;
	private options: RendererOptions;
	private exporter: IExporter;

	constructor(frameRate: number, playHead: HTMLInputElement, canvas2d: HTMLCanvasElement, canvas3d: HTMLCanvasElement, options: RendererOptions) {
		this.playing = false;
		this.currentFrame = 0;
		this.frameRate = frameRate;
		this.audioPlayer = new AudioPlayer();

		this.playHead = playHead;
		this.totalFrames = 0;
		this.options = options;
		this.canvas2d = canvas2d;
		this.canvas3d = canvas3d;
		this.renderer2d = new Renderer2d(frameRate, canvas2d, options);
		this.renderer3d = new RendererWebGpu(frameRate, canvas3d, options);
		this.exporter = new EncoderExporter();
	}

	public loadImage(file: File | undefined) {
		return new Promise<void>((resolve) => {
			if (file) {
				const image = new Image();
				image.src = window.URL.createObjectURL(file);
				image.addEventListener('load', () => {
					this.renderer2d.setBackgroundImage(image);
					resolve();
				});
			} else {
				this.renderer2d.setBackgroundImage(undefined);
				resolve();
			}
		});
	}

	public async export() {
		await this.exporter.export(this.canvas2d, this.audioPlayer, this.frameRate, 0, this.totalFrames, this);
	}

	public async draw() {
		const fft = this.audioPlayer.getSmoothedFft(this.currentFrame, this.options.smoothingFrames);
		const channelData = this.audioPlayer.getChannelData(this.currentFrame, this.frameRate, 0);
		this.renderer3d.draw(fft, channelData);
		this.renderer2d.draw(this.currentFrame, this.totalFrames, this.canvas3d);
	}

	public seek(frame: number) {
		this.currentFrame = frame;
		this.audioPlayer.seek(frame / this.frameRate);
	}

	public isPlaying() {
		return this.playing;
	}

	public async play() {
		if (this.currentFrame >= this.totalFrames) {
			this.seek(0);
		}
		this.playing = true;
		await this.audioPlayer.play();
		window.setInterval(async () => {
			if (this.currentFrame >= this.totalFrames) {
				this.stop();
				this.seek(this.totalFrames);
				return;
			}
			this.currentFrame = Math.round(this.audioPlayer.getAudioTime() * this.frameRate);
			this.playHead.value = this.currentFrame.toString();
			await this.draw();
		}, 1 / this.frameRate);
	}

	public stop() {
		this.playing = false;
		this.audioPlayer.stop();
	}

	public async loadAudio(file: File, progress: Writable<number>) {
		await this.audioPlayer.load(file, this.frameRate, progress);
		this.totalFrames = this.audioPlayer.length * this.frameRate;
		this.playHead.value = '0';
		this.playHead.max = this.totalFrames.toString();
	}

	public async init() {
		await this.renderer3d.init();
	}

	public setOptions(options: RendererOptions) {
		this.renderer2d.options = options;
		this.renderer3d.setOptions(options);
	}
}
