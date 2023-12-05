import { intervalToDuration } from 'date-fns';
import type { Writable } from 'svelte/store';
import { FileSystemWritableFileStreamTarget, Muxer } from 'webm-muxer';
import { AudioPlayer } from './audioPlayer';
import { LineRenderer } from './lineRenderer';
import { coverRect, fitRect, getRect, type Rect } from './rect';
import { sleep } from './sleep';

export interface RendererOptions {
	artist: string;
	title: string;
	audioBitrate: number;
	videoBitrate: number;

	eqBandCount: number;
	eqLineStyle: string | CanvasGradient | CanvasPattern;
	eqLineWidth: number;
	eqGlowWidth: number;
	eqGlowStyle: string | CanvasGradient | CanvasPattern;
	lowerThirdFillStyle: string | CanvasGradient | CanvasPattern;
	lowerThirdOpacity: number;
	playheadStrokeStyle: string | CanvasGradient | CanvasPattern;
	playheadLineWidth: number;
	textFillStyle: string | CanvasGradient | CanvasPattern;
	font: string;
	imageSmoothing: boolean;
}

export class Renderer2d {
	private playing: boolean;
	private currentFrame: number;
	private frameRate: number;
	private audioPlayer: AudioPlayer;
	private playHead: HTMLInputElement;
	private totalFrames: number;
	private renderContex2d: CanvasRenderingContext2D;
	private canvas2d: HTMLCanvasElement;
	private lines: LineRenderer[];
	private backgroundImage?: HTMLImageElement;
	public options: RendererOptions;

	constructor(frameRate: number, playHead: HTMLInputElement, canvas2d: HTMLCanvasElement, options: RendererOptions) {
		this.playing = false;
		this.currentFrame = 0;
		this.frameRate = frameRate;
		this.audioPlayer = new AudioPlayer();
		this.lines = [];

		this.playHead = playHead;
		this.totalFrames = 0;
		this.canvas2d = canvas2d;
		this.options = options;
		const renderContex2d = canvas2d.getContext('2d');
		if (renderContex2d) {
			this.renderContex2d = renderContex2d;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.lines = this.createFftLines(32);
	}

	public loadImage(file: File) {
		const image = new Image();
		image.src = window.URL.createObjectURL(file);
		this.backgroundImage = image;
	}

	public async export() {
		// if (MediaStreamTrackProcessor) {
		// 	await this.exportToVideo();
		// } else {
		// 	await this.exportToZip();
		// }
		await this.exportToEncoder();
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

	// private async exportToVideo() {
	// 	const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
	// 	const writer = trackGenerator.writable.getWriter();
	// 	const chunks: Blob[] = [];

	// 	const result = this.audioPlayer.getAudioTrack();
	// 	if (!result) {
	// 		throw new Error();
	// 	}
	// 	const { bufferSource, destination } = result;

	// 	const stream = new MediaStream();
	// 	stream.addTrack(trackGenerator);
	// 	for (const track of destination.stream.getTracks()) {
	// 		stream.addTrack(track);
	// 	}
	// 	const recorder = new MediaRecorder(stream, {
	// 		audioBitsPerSecond: this.options.audioBitrate * 1000,
	// 		videoBitsPerSecond: this.options.videoBitrate * 1_000_000
	// 	});

	// 	recorder.addEventListener('stop', () => {
	// 		const blob = new Blob(chunks);
	// 		this.downloadBlob(blob, 'file.webm');
	// 	});
	// 	recorder.addEventListener('dataavailable', (event) => {
	// 		if (event.data.size > 0) {
	// 			chunks.push(event.data);
	// 		}
	// 	});
	// 	bufferSource.start();
	// 	recorder.start();
	// 	const duration = Math.floor(1_000_000 / this.frameRate);
	// 	for (let i = 0; i < this.totalFrames; i++) {
	// 		this.seek(i);
	// 		this.draw();
	// 		const timestamp = Math.floor((1_000_000 * i) / this.frameRate);
	// 		const frame = new VideoFrame(this.canvas2d, { timestamp, duration });
	// 		writer.write(frame);
	// 		frame.close();
	// 	}
	// 	recorder.stop();
	// }

	// private async exportToZip() {
	// 	const zip = new JsZip();
	// 	const zeroes = Math.ceil(Math.log10(this.totalFrames));
	// 	for (let i = 0; i < this.totalFrames; i++) {
	// 		this.seek(i);
	// 		this.draw();
	// 		const promise = new Promise<Blob>((resolve, reject) => {
	// 			this.canvas2d.toBlob((blob) => {
	// 				if (blob) {
	// 					resolve(blob);
	// 				} else {
	// 					reject();
	// 				}
	// 			});
	// 		});
	// 		const blob = await promise;
	// 		const filename = 'frame' + i.toString().padStart(zeroes, '0') + '.png';
	// 		zip.file(filename, blob);
	// 	}
	// 	const zipBlob = await zip.generateAsync({ type: 'blob' });
	// 	this.downloadBlob(zipBlob, 'frames.zip');
	// 	this.seek(0);
	// }

	// private downloadBlob(blob: Blob, filename: string) {
	// 	const link = document.createElement('a');
	// 	link.download = filename;
	// 	link.href = URL.createObjectURL(blob);
	// 	link.style.display = 'none';
	// 	document.body.appendChild(link);
	// 	link.click();
	// 	link.remove();
	// }

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

	public draw(interpolation = false) {
		const edgePadding = 32;
		this.renderContex2d.imageSmoothingEnabled = this.options.imageSmoothing;
		this.renderContex2d.imageSmoothingQuality = 'high';
		this.renderContex2d.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);
		this.drawBackground(32);

		this.drawEq(interpolation);
		this.drawForeground(edgePadding);

		const elementGap = 16;

		this.drawLowerThird(edgePadding * 2 + 22 * 3 + elementGap * 2);

		this.renderContex2d.font = this.options.font;
		const timeTextRect = this.drawTimeText(edgePadding);
		this.drawPlayhead(edgePadding, timeTextRect, this.currentFrame / this.totalFrames);
		const titleTextRect = this.drawTitleText(elementGap, timeTextRect);
		this.drawArtistText(elementGap, titleTextRect);
	}

	private drawForeground(padding: number) {
		if (this.backgroundImage) {
			const width = this.canvas2d.width / 4;
			const height = this.canvas2d.height / 4;
			const targetRect = fitRect(
				{ x: 0, y: 0, w: this.backgroundImage.width, h: this.backgroundImage.height },
				{ x: this.canvas2d.width - width - padding, y: padding, w: width, h: height }
			);
			targetRect.x = this.canvas2d.width - targetRect.w - padding;
			this.renderContex2d.drawImage(this.backgroundImage, targetRect.x, targetRect.y, targetRect.w, targetRect.h);
		}
	}

	private drawBackground(blurRadius: number) {
		if (this.backgroundImage) {
			this.renderContex2d.filter = `blur(${blurRadius}px)`;
			const targetRect = coverRect(
				{ x: 0, y: 0, w: this.backgroundImage.width, h: this.backgroundImage.height },
				{ x: 0, y: 0, w: this.canvas2d.width, h: this.canvas2d.height }
			);
			this.renderContex2d.drawImage(this.backgroundImage, targetRect.x, targetRect.y, targetRect.w, targetRect.h);
			this.renderContex2d.filter = 'blur(0px)';
		}
	}

	private addOpacity(color: string | CanvasPattern | CanvasGradient, opacity: number) {
		if (typeof color === 'string') {
			const opacityByte = Math.round(opacity * 255);
			const opacityStr = opacityByte.toString(16).padStart(2, '0');
			return color + opacityStr;
		}
		return color;
	}

	private drawLowerThird(height: number) {
		this.renderContex2d.fillStyle = this.addOpacity(this.options.lowerThirdFillStyle, this.options.lowerThirdOpacity);
		this.renderContex2d.fillRect(0, this.canvas2d.height - height, this.canvas2d.width, height);
	}

	private drawEq(interpolation = true) {
		const fft = this.audioPlayer.getFft(this.currentFrame);
		//draw glow
		this.renderContex2d.strokeStyle = this.options.eqGlowStyle;
		this.renderContex2d.lineCap = 'round';
		this.renderContex2d.filter = `blur(16px)`;
		for (let i = 0; i < fft.length; i++) {
			const strength = fft[i];
			this.renderContex2d.lineWidth = this.options.eqGlowWidth * strength;
			this.lines[i].render(this.renderContex2d, strength, interpolation);
		}

		//draw actual eq
		this.renderContex2d.strokeStyle = this.options.eqLineStyle;
		this.renderContex2d.lineWidth = this.options.eqLineWidth;
		this.renderContex2d.lineCap = 'round';
		this.renderContex2d.filter = `blur(0)`;
		for (let i = 0; i < fft.length; i++) {
			const strength = fft[i];
			this.lines[i].render(this.renderContex2d, strength, interpolation);
		}
	}

	private debugDraw(rect: Rect) {
		this.renderContex2d.fillStyle = 'rgba(255,0,0,0.4)';
		this.renderContex2d.fillRect(rect.x, rect.y, rect.w, rect.h);
	}

	private drawArtistText(padding: number, offset: Rect): Rect {
		this.renderContex2d.fillStyle = this.options.textFillStyle;
		this.renderContex2d.fillText(this.options.artist, offset.x, offset.y - padding);
		return getRect(this.renderContex2d, this.options.artist, offset.x, offset.y - padding);
	}

	private drawTitleText(padding: number, offset: Rect): Rect {
		this.renderContex2d.fillStyle = this.options.textFillStyle;
		this.renderContex2d.fillText(this.options.title, offset.x, offset.y - padding);
		return getRect(this.renderContex2d, this.options.title, offset.x, offset.y - padding);
	}

	private drawTimeText(padding: number): Rect {
		const time: Duration = intervalToDuration({
			start: 0,
			end: (this.currentFrame / this.frameRate) * 1000
		});
		const totalTime: Duration = intervalToDuration({
			start: 0,
			end: (this.totalFrames / this.frameRate) * 1000
		});

		const minutePad = (totalTime.minutes ?? 0) > 10 ? 2 : 1;
		const timeText = `${this.formatTime(time, minutePad)} / ${this.formatTime(totalTime, minutePad)}`;

		this.renderContex2d.fillStyle = this.options.textFillStyle;
		this.renderContex2d.fillText(timeText, padding, this.canvas2d.height - padding);
		return getRect(this.renderContex2d, timeText, padding, this.canvas2d.height - padding);
	}

	private drawPlayhead(padding: number, textBounds: Rect, progress: number) {
		this.renderContex2d.strokeStyle = this.options.playheadStrokeStyle;
		this.renderContex2d.lineWidth = this.options.playheadLineWidth;
		this.renderContex2d.lineCap = 'round';

		this.renderContex2d.beginPath();
		const y = textBounds.y + textBounds.h / 2;
		const startX = padding + textBounds.x + textBounds.w;
		const endX = this.canvas2d.width - padding;
		this.renderContex2d.moveTo(startX, y);
		this.renderContex2d.lineTo(endX, y);
		this.renderContex2d.stroke();

		this.renderContex2d.strokeStyle = this.options.playheadStrokeStyle;
		this.renderContex2d.beginPath();
		const width = endX - startX;
		const x = width * progress + startX;
		this.renderContex2d.moveTo(x, textBounds.y);
		this.renderContex2d.lineTo(x, textBounds.y + textBounds.h);
		this.renderContex2d.stroke();
	}

	private formatTime(duration: Duration, minutePad: number) {
		const minutesString = duration.minutes?.toString().padStart(minutePad, '0');
		const secondsString = duration.seconds?.toString().padStart(2, '0');
		const time = `${minutesString}:${secondsString}`;
		return time;
	}

	private createFftLines(padding: number) {
		const x = padding;
		const y = padding;
		const w = this.canvas2d.width - padding * 2;
		const h = this.canvas2d.height - padding * 2;

		const bandYCentre = y + h / 2;
		const lines: LineRenderer[] = [];
		const bandCount = 10;
		for (let i = 0; i < bandCount; i++) {
			const progress = i / bandCount;
			const bandX = x + w / 2 - progress * (w / 2) - w / (bandCount * 4);
			const bandMirrorX = x + w / 2 + progress * (w / 2) + w / (bandCount * 4);

			lines.push(new LineRenderer(bandX, bandMirrorX, bandYCentre, h));
		}
		return lines;
	}
}
