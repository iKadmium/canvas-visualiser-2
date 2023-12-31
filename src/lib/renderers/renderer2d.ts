import { intervalToDuration, type Duration } from 'date-fns';
import { fitRect, getRect, type Rect } from '../rect';
import type { RendererOptions } from '../sceneGraph';

export class Renderer2d {
	private renderContex2d: CanvasRenderingContext2D;
	private canvas: HTMLCanvasElement;
	private backgroundImage?: HTMLImageElement;
	private frameRate: number;
	private options: RendererOptions;

	constructor(frameRate: number, options: RendererOptions) {
		this.canvas = document.createElement('canvas');
		const renderContex2d = this.canvas.getContext('2d');
		if (renderContex2d) {
			this.renderContex2d = renderContex2d;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.options = options;
		this.setOptions(options);
		this.frameRate = frameRate;
	}

	public render(currentFrame: number, totalFrames: number) {
		const edgePadding = 32;
		const elementGap = 16;

		this.renderContex2d.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.drawForeground(edgePadding);
		this.drawLowerThird(edgePadding * 2 + 22 * 3 + elementGap * 2);

		const timeTextRect = this.drawTimeText(edgePadding, currentFrame, totalFrames);
		this.drawPlayhead(edgePadding, timeTextRect, currentFrame / totalFrames);
		const titleTextRect = this.drawTitleText(elementGap, timeTextRect);
		this.drawArtistText(elementGap, titleTextRect);
		//this.drawGrid();
	}

	public draw(context: CanvasRenderingContext2D) {
		context.drawImage(this.canvas, 0, 0);
	}

	private drawGrid() {
		const horizontalSections = 4;
		for (let i = 1; i < horizontalSections; i++) {
			this.renderContex2d.moveTo(0, (this.canvas.height * i) / horizontalSections);
			this.renderContex2d.lineTo(this.canvas.width, (this.canvas.height * i) / horizontalSections);
			this.renderContex2d.stroke();
		}

		const verticalSections = 4;
		for (let i = 1; i < verticalSections; i++) {
			this.renderContex2d.moveTo((this.canvas.width * i) / verticalSections, 0);
			this.renderContex2d.lineTo((this.canvas.width * i) / horizontalSections, this.canvas.height);
			this.renderContex2d.stroke();
		}
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

	public setOptions(options: RendererOptions) {
		this.options = options;
		this.canvas.width = options.width;
		this.canvas.height = options.height;
		this.renderContex2d.font = this.options.font;
	}
}
