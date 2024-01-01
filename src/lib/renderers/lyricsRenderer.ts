import { rescale } from '$lib';
import type { RendererOptions } from '$lib/sceneGraph';

interface Lyrics {
	bar: number;
	beat: number;
	time: number;
	seconds: number;
	lyric: string;
}

interface Period {
	startTime: number;
	endTime: number;
}

interface Bar {
	fadeIn: Period;
	present: Period;
	fadeOut: Period;
	lyrics: string;
}

export class LyricsRenderer {
	private lyrics: Lyrics[] | undefined;
	private options: RendererOptions;
	private canvas: HTMLCanvasElement;
	private bars: Bar[];

	constructor(options: RendererOptions) {
		this.options = options;
		this.canvas = document.createElement('canvas');
		this.setOptions(options);
		this.bars = [];
	}

	public load(file: File) {
		const reader = new FileReader();
		return new Promise<void>((resolve, reject) => {
			reader.addEventListener('loadend', () => {
				const str = reader.result as string;
				this.lyrics = JSON.parse(str) as Lyrics[];
				this.createBars(this.options.lyricsFadeInTime, this.options.lyricsFadeOutTime);
				resolve();
			});
			reader.addEventListener('error', (event) => reject(event));
			reader.addEventListener('abort', (event) => reject(event));
			reader.readAsText(file);
		});
	}

	private createBars(fadeInTime: number, fadeOutTime: number) {
		if (!this.lyrics) {
			throw new Error('Lyrics were null');
		}
		this.bars.splice(0, this.bars.length);
		const allBars = this.lyrics.map((x) => x.bar).filter((val, index, arr) => arr.indexOf(val) === index);
		for (const barNumber of allBars) {
			const lyricsInBar = this.lyrics.filter((x) => x.bar === barNumber);
			const lyricStr = lyricsInBar.map((x) => x.lyric).join(' ');
			const firstLyric = lyricsInBar[0];
			const lastLyric = lyricsInBar[lyricsInBar.length - 1];
			const bar: Bar = {
				fadeIn: {
					startTime: firstLyric.seconds - fadeInTime,
					endTime: firstLyric.seconds
				},
				present: {
					startTime: firstLyric.seconds,
					endTime: lastLyric.seconds
				},
				fadeOut: {
					startTime: lastLyric.seconds,
					endTime: lastLyric.seconds + fadeOutTime
				},
				lyrics: lyricStr
			};
			this.bars.push(bar);
		}
	}

	public setOptions(options: RendererOptions) {
		if (options.width !== this.canvas.width || options.height !== this.canvas.height) {
			this.canvas.height = options.height;
			this.canvas.width = options.width;
		}
		if (options.lyricsFadeInTime !== this.options.lyricsFadeInTime || options.lyricsFadeOutTime !== this.options.lyricsFadeOutTime) {
			this.createBars(options.lyricsFadeInTime, options.lyricsFadeOutTime);
		}
		this.options = options;
	}

	public render(frame: number, frameRate: number) {
		if (!this.lyrics) {
			return;
		}
		const context = this.canvas.getContext('2d');
		if (!context) {
			return;
		}
		const edgePadding = 32;
		context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		const time = frame / frameRate;
		const fadingIn = this.bars.filter((x) => x.fadeIn.startTime <= time && x.fadeIn.endTime > time);
		const present = this.bars.filter((x) => x.present.startTime <= time && x.present.endTime > time);
		const fadingOut = this.bars.filter((x) => x.fadeOut.startTime <= time && x.fadeOut.endTime > time);
		let y = edgePadding;
		context.font = this.options.font;
		const { red, green, blue } = this.parseHex(this.options.textFillStyle);

		for (const lyric of fadingOut) {
			const alpha = rescale(time, lyric.fadeOut.startTime, lyric.fadeOut.endTime, 1, 0);
			const fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
			context.fillStyle = fillStyle;
			const size = context.measureText(lyric.lyrics);
			y += (size.fontBoundingBoxDescent + size.fontBoundingBoxAscent) * alpha;
			context.fillText(lyric.lyrics, edgePadding, y);
		}

		context.fillStyle = this.options.textFillStyle;
		for (const lyric of present) {
			const size = context.measureText(lyric.lyrics);
			y += size.fontBoundingBoxDescent + size.fontBoundingBoxAscent;
			context.fillText(lyric.lyrics, edgePadding, y);
		}

		for (const lyric of fadingIn) {
			const alpha = rescale(time, lyric.fadeIn.startTime, lyric.fadeIn.endTime, 0, 1);
			const fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
			context.fillStyle = fillStyle;
			const size = context.measureText(lyric.lyrics);
			y += size.fontBoundingBoxDescent + size.fontBoundingBoxAscent;
			context.fillText(lyric.lyrics, edgePadding, y);
		}
	}

	private parseHex(hexString: string) {
		if (hexString.length !== 7 || hexString[0] !== '#') {
			throw new Error('Wrong format');
		}
		const red = parseInt(hexString.substring(1, 3), 16);
		const green = parseInt(hexString.substring(3, 5), 16);
		const blue = parseInt(hexString.substring(5, 7), 16);
		return { red, green, blue };
	}

	public draw(context: CanvasRenderingContext2D) {
		context.drawImage(this.canvas, 0, 0);
	}
}
