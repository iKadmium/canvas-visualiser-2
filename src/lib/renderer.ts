import { AudioPlayer } from './audioPlayer';
import { LineRenderer } from './lineRenderer';
import { reduceBands } from './mean';
import { coverRect, fitRect, getRect, type Rect } from './rect';
import { sleep } from './sleep';
import { intervalToDuration } from 'date-fns';
import JsZip from 'jszip';

const defaultBandCount = 8;

export interface RendererOptions {
	artist: string;
	title: string;
	eqBandCount?: number;
	eqLineStyle?: string | CanvasGradient | CanvasPattern;
	eqLineWidth?: number;
	eqGlowStyle?: string | CanvasGradient | CanvasPattern;
	eqGlowWidth?: number;
	lowerThirdFillStyle?: string | CanvasGradient | CanvasPattern;
	playheadStrokeStyle?: string | CanvasGradient | CanvasPattern;
	playheadTrackStrokeStyle?: string | CanvasGradient | CanvasPattern;
	playheadLineWidth?: number;
	artistFillStyle?: string | CanvasGradient | CanvasPattern;
	titleFillStyle?: string | CanvasGradient | CanvasPattern;
	timeFillStyle?: string | CanvasGradient | CanvasPattern;
	font?: string;
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
		if (MediaStreamTrackProcessor) {
			await this.exportToVideo();
		} else {
			await this.exportToZip();
		}
	}

	private async exportToVideo() {
		const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
		const writer = trackGenerator.writable.getWriter();
		const chunks: Blob[] = [];

		const result = this.audioPlayer.getAudioTrack();
		if (!result) {
			throw new Error();
		}
		const { bufferSource, destination } = result;

		const stream = new MediaStream();
		stream.addTrack(trackGenerator);
		for (const track of destination.stream.getTracks()) {
			stream.addTrack(track);
		}
		const recorder = new MediaRecorder(stream, {
			audioBitsPerSecond: 192000,
			videoBitsPerSecond: 20_000_000
		});

		recorder.addEventListener('stop', () => {
			const blob = new Blob(chunks);
			this.downloadBlob(blob, 'file.webm');
		});
		recorder.addEventListener('dataavailable', (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		});
		bufferSource.start();
		recorder.start();
		const duration = Math.floor(1_000_000 / this.frameRate);
		for (let i = 0; i < this.totalFrames && i < 600; i++) {
			this.seek(i, false);
			await this.update();
			this.draw();
			const timestamp = Math.floor((1_000_000 * i) / this.frameRate);
			const frame = new VideoFrame(this.canvas2d, { timestamp, duration });
			writer.write(frame);
		}
		recorder.stop();
	}

	private async exportToZip() {
		const zip = new JsZip();
		const zeroes = Math.ceil(Math.log10(this.totalFrames));
		for (let i = 0; i < this.totalFrames; i++) {
			this.seek(i, false);
			await this.update();
			this.draw();
			const promise = new Promise<Blob>((resolve, reject) => {
				this.canvas2d.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject();
					}
				});
			});
			const blob = await promise;
			const filename = 'frame' + i.toString().padStart(zeroes, '0') + '.png';
			zip.file(filename, blob);
		}
		const zipBlob = await zip.generateAsync({ type: 'blob' });
		this.downloadBlob(zipBlob, 'frames.zip');
		this.seek(0);
	}

	private downloadBlob(blob: Blob, filename: string) {
		const link = document.createElement('a');
		link.download = filename;
		link.href = URL.createObjectURL(blob);
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	public seek(frame: number, resetSmoothing = true) {
		if (resetSmoothing) {
			this.audioPlayer.resetAnalyser();
		}
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
				await this.update();

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

	public async update() {
		await this.audioPlayer.renderFrame(this.currentFrame, this.frameRate);
	}

	public async loadAudio(file: File) {
		await this.audioPlayer.load(file);
		this.totalFrames = this.audioPlayer.length * this.frameRate;
		this.playHead.value = '0';
		this.playHead.max = this.totalFrames.toString();
	}

	public draw(interpolation = false) {
		const edgePadding = 32;
		this.renderContex2d.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);
		this.drawBackground(32);

		this.drawEq(interpolation);
		this.drawForeground(edgePadding);

		const elementGap = 16;

		this.drawLowerThird(edgePadding * 2 + 22 * 3 + elementGap * 2);

		this.renderContex2d.font = this.options.font || `normal 300 32px Roboto`;
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

	private drawLowerThird(height: number) {
		this.renderContex2d.fillStyle = this.options.lowerThirdFillStyle || 'rgba(0,0,0,0.7)';
		this.renderContex2d.fillRect(0, this.canvas2d.height - height, this.canvas2d.width, height);
	}

	private drawEq(interpolation = true) {
		const fft = this.audioPlayer.getFft();

		const outputBands = reduceBands(fft, defaultBandCount);
		//draw glow
		this.renderContex2d.strokeStyle = this.options.eqGlowStyle || 'yellow';
		this.renderContex2d.lineCap = 'round';
		this.renderContex2d.filter = `blur(16px)`;
		for (let i = 0; i < outputBands.length; i++) {
			const strength = outputBands[i] / 255;
			this.renderContex2d.lineWidth = (this.options.eqLineWidth || 32) * strength;
			this.lines[i].render(this.renderContex2d, strength, interpolation);
		}

		//draw actual eq
		this.renderContex2d.strokeStyle = this.options.eqLineStyle || 'black';
		this.renderContex2d.lineWidth = this.options.eqLineWidth || 16;
		this.renderContex2d.lineCap = 'round';
		this.renderContex2d.filter = `blur(0)`;
		for (let i = 0; i < outputBands.length; i++) {
			const strength = outputBands[i] / 255;
			this.lines[i].render(this.renderContex2d, strength, interpolation);
		}
	}

	private debugDraw(rect: Rect) {
		this.renderContex2d.fillStyle = 'rgba(255,0,0,0.4)';
		this.renderContex2d.fillRect(rect.x, rect.y, rect.w, rect.h);
	}

	private drawArtistText(padding: number, offset: Rect): Rect {
		this.renderContex2d.fillStyle = this.options.artistFillStyle || 'black';
		this.renderContex2d.fillText(this.options.artist, offset.x, offset.y - padding);
		return getRect(this.renderContex2d, this.options.artist, offset.x, offset.y - padding);
	}

	private drawTitleText(padding: number, offset: Rect): Rect {
		this.renderContex2d.fillStyle = this.options.titleFillStyle || 'black';
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

		this.renderContex2d.fillStyle = this.options.timeFillStyle || 'black';
		this.renderContex2d.fillText(timeText, padding, this.canvas2d.height - padding);
		return getRect(this.renderContex2d, timeText, padding, this.canvas2d.height - padding);
	}

	private drawPlayhead(padding: number, textBounds: Rect, progress: number) {
		this.renderContex2d.strokeStyle = this.options.playheadTrackStrokeStyle || 'black';
		this.renderContex2d.lineWidth = this.options.playheadLineWidth || 4;
		this.renderContex2d.lineCap = 'round';

		this.renderContex2d.beginPath();
		const y = textBounds.y + textBounds.h / 2;
		const startX = padding + textBounds.x + textBounds.w;
		const endX = this.canvas2d.width - padding;
		this.renderContex2d.moveTo(startX, y);
		this.renderContex2d.lineTo(endX, y);
		this.renderContex2d.stroke();

		this.renderContex2d.strokeStyle = this.options.playheadStrokeStyle || 'black';
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
		const bandCount = this.options.eqBandCount || defaultBandCount;
		for (let i = 0; i < bandCount; i++) {
			const progress = i / bandCount;
			const bandX = x + w / 2 - progress * (w / 2) - w / (bandCount * 4);
			const bandMirrorX = x + w / 2 + progress * (w / 2) + w / (bandCount * 4);

			lines.push(new LineRenderer(bandX, bandMirrorX, bandYCentre, h));
		}
		return lines;
	}
}
