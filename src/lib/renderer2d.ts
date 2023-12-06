import { intervalToDuration, type Duration } from 'date-fns';
import { LineRenderer } from './lineRenderer';
import { coverRect, fitRect, getRect, type Rect } from './rect';
import type { RendererOptions } from './sceneGraph';

export class Renderer2d {
	private renderContex2d: CanvasRenderingContext2D;
	private canvas: HTMLCanvasElement;
	private lines: LineRenderer[];
	private backgroundImage?: HTMLImageElement;
	private frameRate: number;
	public options: RendererOptions;

	constructor(frameRate: number, canvas: HTMLCanvasElement, options: RendererOptions) {
		this.lines = [];

		this.canvas = canvas;
		this.options = options;
		const renderContex2d = canvas.getContext('2d');
		if (renderContex2d) {
			this.renderContex2d = renderContex2d;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.frameRate = frameRate;
		this.lines = this.createFftLines(32);
	}

	public draw(fft: number[], currentFrame: number, totalFrames: number, otherCanvas: HTMLCanvasElement) {
		const edgePadding = 32;
		this.renderContex2d.globalCompositeOperation = 'source-over';
		this.renderContex2d.imageSmoothingEnabled = this.options.imageSmoothing;
		this.renderContex2d.imageSmoothingQuality = 'high';
		this.renderContex2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.drawBackground(32);

		//this.drawEq(false, fft);
		this.renderContex2d.globalCompositeOperation = 'screen';
		this.renderContex2d.drawImage(otherCanvas, 0, 0);
		this.renderContex2d.globalCompositeOperation = 'source-over';
		this.drawForeground(edgePadding);

		const elementGap = 16;

		this.drawLowerThird(edgePadding * 2 + 22 * 3 + elementGap * 2);

		this.renderContex2d.font = this.options.font;
		const timeTextRect = this.drawTimeText(edgePadding, currentFrame, totalFrames);
		this.drawPlayhead(edgePadding, timeTextRect, currentFrame / totalFrames);
		const titleTextRect = this.drawTitleText(elementGap, timeTextRect);
		this.drawArtistText(elementGap, titleTextRect);
	}

	public setBackgroundImage(image: HTMLImageElement) {
		this.backgroundImage = image;
	}

	private drawForeground(padding: number) {
		if (this.backgroundImage) {
			const width = this.canvas.width / 4;
			const height = this.canvas.height / 4;
			const targetRect = fitRect(
				{ x: 0, y: 0, w: this.backgroundImage.width, h: this.backgroundImage.height },
				{ x: this.canvas.width - width - padding, y: padding, w: width, h: height }
			);
			targetRect.x = this.canvas.width - targetRect.w - padding;
			this.renderContex2d.drawImage(this.backgroundImage, targetRect.x, targetRect.y, targetRect.w, targetRect.h);
		}
	}

	private drawBackground(blurRadius: number) {
		if (this.backgroundImage) {
			this.renderContex2d.filter = `blur(${blurRadius}px)`;
			const targetRect = coverRect(
				{ x: 0, y: 0, w: this.backgroundImage.width, h: this.backgroundImage.height },
				{ x: 0, y: 0, w: this.canvas.width, h: this.canvas.height }
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
		this.renderContex2d.fillRect(0, this.canvas.height - height, this.canvas.width, height);
	}

	private drawEq(interpolation = true, fft: number[]) {
		//draw glow
		this.renderContex2d.strokeStyle = this.options.eqGlowStyle;
		this.renderContex2d.lineCap = 'round';
		this.renderContex2d.filter = `blur(16px)`;
		for (let i = 0; i < fft.length; i++) {
			const strength = fft[i];
			this.renderContex2d.lineWidth = this.options.eqGlowIntensity * strength;
			this.lines[i].render(this.renderContex2d, strength, interpolation);
		}

		//draw actual eq
		this.renderContex2d.strokeStyle = this.options.eqLineStyle;
		this.renderContex2d.lineWidth = this.options.eqSegmentWidth;
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

	private drawTimeText(padding: number, currentFrame: number, totalFrames: number): Rect {
		const time: Duration = intervalToDuration({
			start: 0,
			end: (currentFrame / this.frameRate) * 1000
		});
		const totalTime: Duration = intervalToDuration({
			start: 0,
			end: (totalFrames / this.frameRate) * 1000
		});

		const minutePad = (totalTime.minutes ?? 0) > 10 ? 2 : 1;
		const timeText = `${this.formatTime(time, minutePad)} / ${this.formatTime(totalTime, minutePad)}`;

		this.renderContex2d.fillStyle = this.options.textFillStyle;
		this.renderContex2d.fillText(timeText, padding, this.canvas.height - padding);
		return getRect(this.renderContex2d, timeText, padding, this.canvas.height - padding);
	}

	private drawPlayhead(padding: number, textBounds: Rect, progress: number) {
		this.renderContex2d.strokeStyle = this.options.playheadStrokeStyle;
		this.renderContex2d.lineWidth = this.options.playheadLineWidth;
		this.renderContex2d.lineCap = 'round';

		this.renderContex2d.beginPath();
		const y = textBounds.y + textBounds.h / 2;
		const startX = padding + textBounds.x + textBounds.w;
		const endX = this.canvas.width - padding;
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
		const w = this.canvas.width - padding * 2;
		const h = this.canvas.height - padding * 2;

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
