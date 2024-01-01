import type { Writable } from 'svelte/store';
import { AudioPlayer } from './audioPlayer';
import { EncoderExporter } from './encoderExporter';
import type { IExporter } from './exporter';
import { Renderer2d } from './renderers/renderer2d';
import { RendererWebGpu } from './renderers/rendererWebGpu';
import { BackgroundRenderer } from './renderers/backgroundRenderer';
import { LyricsRenderer } from './renderers/lyricsRenderer';

export interface RendererOptions {
	artist: string;
	title: string;
	audioBitrate: number;
	videoBitrate: number;

	height: number;
	width: number;

	smoothingFrames: number;
	eqLineHeightMultiplier: number;
	eqLineStyle: string;
	scopeColor: string;
	waterColor: string;
	eqSegmentWidth: number;
	eqGlowIntensity: number;
	eqGlowStyle: string;
	lowerThirdFillStyle: string | CanvasGradient | CanvasPattern;
	lowerThirdOpacity: number;
	playheadStrokeStyle: string | CanvasGradient | CanvasPattern;
	playheadLineWidth: number;
	textFillStyle: string;
	font: string;
	imageSmoothing: boolean;

	eqEnabled: boolean;
	scopeEnabled: boolean;
	wetEnabled: boolean;
	discoteqEnabled: boolean;

	lyricsFadeOutTime: number;
	lyricsFadeInTime: number;
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
	private backgroundRenderer: BackgroundRenderer;
	private lyricsRenderer: LyricsRenderer;
	private canvas: HTMLCanvasElement;
	private options: RendererOptions;
	private exporter: IExporter;

	constructor(frameRate: number, playHead: HTMLInputElement, canvas2d: HTMLCanvasElement, options: RendererOptions) {
		this.playing = false;
		this.currentFrame = 0;
		this.frameRate = frameRate;
		this.audioPlayer = new AudioPlayer();

		this.playHead = playHead;
		this.totalFrames = 0;
		this.options = options;
		this.canvas = canvas2d;
		this.renderer2d = new Renderer2d(frameRate, options);
		this.renderer3d = new RendererWebGpu(frameRate, options);
		this.backgroundRenderer = new BackgroundRenderer(options);
		this.lyricsRenderer = new LyricsRenderer(options);
		this.exporter = new EncoderExporter();
	}

	public loadImage(file: File | undefined) {
		return this.backgroundRenderer.loadFromFile(file);
	}

	public async export() {
		await this.exporter.export(this.canvas, this.audioPlayer, this.frameRate, 0, this.totalFrames, this);
	}

	public draw() {
		const context = this.canvas.getContext('2d');
		if (context) {
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			const fft = this.audioPlayer.getSmoothedFft(this.currentFrame, this.options.smoothingFrames);
			const channelData = this.audioPlayer.getChannelData(this.currentFrame, this.frameRate, 0);

			this.renderer3d.render(this.currentFrame, fft, channelData);
			this.renderer2d.render(this.currentFrame, this.totalFrames);
			this.lyricsRenderer.render(this.currentFrame, this.frameRate);

			this.backgroundRenderer.draw(context);
			this.renderer3d.draw(context);
			this.renderer2d.draw(context);
			this.lyricsRenderer.draw(context);
		}
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
		const renderer = () => {
			if (this.currentFrame >= this.totalFrames) {
				this.stop();
				this.seek(this.totalFrames);
				return;
			}
			if (this.playing) {
				this.currentFrame = Math.round(this.audioPlayer.getAudioTime() * this.frameRate);
				this.playHead.value = this.currentFrame.toString();
				this.draw();
				requestAnimationFrame(renderer);
			}
		};
		requestAnimationFrame(renderer);
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

	public async loadLyrics(file: File) {
		await this.lyricsRenderer.load(file);
	}

	public async init() {
		await this.renderer3d.init();
	}

	public async setOptions(options: RendererOptions) {
		this.backgroundRenderer.setOptions(options);
		this.renderer2d.setOptions(options);
		await this.renderer3d.setOptions(options);
		this.lyricsRenderer.setOptions(options);
	}
}
