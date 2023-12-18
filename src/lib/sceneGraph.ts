import type { Writable } from 'svelte/store';
import { FileSystemWritableFileStreamTarget, Muxer } from 'webm-muxer';
import { AudioPlayer } from './audioPlayer';
import { sleep } from './sleep';
import { Renderer2d } from './renderer2d';
import { Renderer3d } from './renderer3d';

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
	private renderer3d: Renderer3d;
	private canvas2d: HTMLCanvasElement;
	private canvas3d: HTMLCanvasElement;

	public options: RendererOptions;

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
		this.renderer3d = new Renderer3d(frameRate, canvas3d, options);
	}

	public loadImage(file: File | undefined) {
		if (file) {
			const image = new Image();
			image.src = window.URL.createObjectURL(file);
			this.renderer2d.setBackgroundImage(image);
		} else {
			this.renderer2d.setBackgroundImage(undefined);
		}
	}

	public async export() {
		await this.exportToEncoder();
	}

	public async draw() {
		const fft = this.audioPlayer.getSmoothedFft(this.currentFrame, this.options.smoothingFrames);
		this.renderer3d.draw(fft);
		this.renderer2d.draw(fft, this.currentFrame, this.totalFrames, this.canvas3d);
	}

	private async exportToEncoder() {
		const handle = await window.showSaveFilePicker({
			types: [
				{
					accept: {
						'video/webm': ['.webm']
					},
					description: 'webm'
				}
			]
		});
		const writable = await handle.createWritable();

		const muxer = new Muxer({
			target: new FileSystemWritableFileStreamTarget(writable),
			video: {
				codec: 'V_VP9',
				width: this.canvas2d.width,
				height: this.canvas2d.height
			},
			audio: {
				codec: 'A_AAC/MPEG4/LC',
				numberOfChannels: this.audioPlayer.getChannelCount(),
				sampleRate: this.audioPlayer.getSampleRate()
			},
			firstTimestampBehavior: 'offset'
		});
		const duration = Math.floor(1_000_000 / this.frameRate);

		const videoEncoder = new VideoEncoder({
			output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
			error: (err) => {
				console.error(err);
			}
		});

		const videoCodec = 'vp09.00.10.08';

		const videoEncoderConfig: VideoEncoderConfig = {
			codec: videoCodec,
			width: this.canvas2d.width,
			height: this.canvas2d.height,
			framerate: this.frameRate
		};

		videoEncoder.configure(videoEncoderConfig);

		const audioEncoder = new AudioEncoder({
			output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
			error: (err) => console.error(err)
		});

		const audioEncoderConfig: AudioEncoderConfig = {
			codec: 'mp4a.40.2',
			numberOfChannels: this.audioPlayer.getChannelCount(),
			sampleRate: this.audioPlayer.getSampleRate()
		};

		audioEncoder.configure(audioEncoderConfig);

		let firstTimestamp: number | undefined;

		const bufferSource = this.audioPlayer.getAudioTrack();
		const audioBuffer = bufferSource.buffer!;
		const channelData: Float32Array[] = [];
		for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
			channelData.push(audioBuffer.getChannelData(i));
		}
		const samples = new Float32Array(channelData[0].length * channelData.length);
		for (let sample = 0; sample < audioBuffer.length; sample++) {
			for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
				const offset = audioBuffer.numberOfChannels * sample + channel;
				samples[offset] = channelData[channel][sample];
			}
		}

		const audioData = new AudioData({
			sampleRate: bufferSource.context.sampleRate,
			numberOfChannels: this.audioPlayer.getChannelCount(),
			data: samples,
			timestamp: 0,
			numberOfFrames: audioBuffer.length,
			format: 'f32'
		});
		audioEncoder.encode(audioData);

		for (let i = 0; i < this.totalFrames; i++) {
			this.seek(i);
			this.draw();
			const timestamp = Math.floor((1_000_000 * i) / this.frameRate);
			const frame = new VideoFrame(this.canvas2d, { timestamp: timestamp + (firstTimestamp ?? 0), duration });
			const keyFrame = i % this.frameRate === 0;
			videoEncoder.encode(frame, { keyFrame });
			frame.close();
			await videoEncoder.flush();
		}
		muxer.finalize();
		await writable.close();
	}

	public seek(frame: number) {
		this.currentFrame = frame;
	}

	public isPlaying() {
		return this.playing;
	}

	public play() {
		this.playing = true;
		window.setTimeout(async () => {
			while (this.playing) {
				const startTime = Date.now();

				const renderPromise = new Promise<number>((resolve) => {
					requestAnimationFrame(() => {
						this.draw();
						resolve(Date.now());
					});
				});
				const endTime = await renderPromise;
				const frameTime = endTime - startTime;
				const remainingTime = 1000 / this.frameRate - frameTime;
				if (remainingTime > 0) {
					await sleep(remainingTime);
				}
				this.currentFrame++;
				this.playHead.value = this.currentFrame.toString();
				if (this.currentFrame >= this.totalFrames) {
					this.stop();
				}
			}
		}, 1 / this.frameRate);
	}

	public stop() {
		this.playing = false;
	}

	public async loadAudio(file: File, progress: Writable<number>) {
		await this.audioPlayer.load(file, this.frameRate, progress);
		this.totalFrames = this.audioPlayer.length * this.frameRate;
		this.playHead.value = '0';
		this.playHead.max = this.totalFrames.toString();
	}
}
