import { coverRect } from '$lib/rect';
import type { RendererOptions } from '$lib/sceneGraph';

const blurRadius = 32;

export class BackgroundRenderer {
	private canvas: HTMLCanvasElement;
	private options: RendererOptions;
	private image: HTMLImageElement | undefined;

	constructor(options: RendererOptions) {
		this.options = options;
		this.canvas = document.createElement('canvas');
		this.canvas.width = options.width;
		this.canvas.height = options.height;
	}

	public draw(context: CanvasRenderingContext2D) {
		context.drawImage(this.canvas, 0, 0);
	}

	public loadFromFile(file: File | undefined) {
		return new Promise<void>((resolve) => {
			if (file) {
				const image = new Image();
				image.src = window.URL.createObjectURL(file);
				image.addEventListener('load', () => {
					this.setBackgroundImage(image);
					resolve();
				});
			} else {
				this.setBackgroundImage(undefined);
				resolve();
			}
		});
	}

	public setBackgroundImage(image: HTMLImageElement | undefined) {
		this.image = image;
		if (image) {
			this.renderImage(image, blurRadius);
		} else {
			const context = this.canvas.getContext('2d');
			if (!context) {
				throw new Error('Could not get render context');
			}
			context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}

	private renderImage(image: HTMLImageElement, blurRadius: number) {
		const offscreenRenderContext = this.canvas.getContext('2d');
		if (!offscreenRenderContext) {
			throw new Error("Couldn't get offscreen render context");
		}
		offscreenRenderContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
		offscreenRenderContext.filter = `blur(${blurRadius}px)`;

		const targetRect = coverRect({ x: 0, y: 0, w: image.width, h: image.height }, { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height });
		offscreenRenderContext.drawImage(image, targetRect.x, targetRect.y, targetRect.w, targetRect.h);
	}

	public setOptions(options: RendererOptions) {
		if (this.image && (this.canvas.width !== options.width || this.canvas.height !== options.height)) {
			this.canvas.width = options.width;
			this.canvas.height = options.height;
			this.renderImage(this.image, blurRadius);
		}
		this.options = options;
	}
}
