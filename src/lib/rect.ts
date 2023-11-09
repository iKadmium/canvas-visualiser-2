export interface Rect {
	x: number;
	y: number;
	h: number;
	w: number;
}

export function getRect(context: CanvasRenderingContext2D, text: string, x: number, y: number): Rect {
	const textMetrics = context.measureText(text);
	const height = textMetrics.fontBoundingBoxAscent - textMetrics.fontBoundingBoxDescent;
	const bounds: Rect = {
		x,
		y: y - height,
		w: textMetrics.width,
		h: height
	};
	return bounds;
}

export function coverRect(original: Rect, target: Rect): Rect {
	const originalAspectRatio = original.w / original.h;
	const targetAspectRatio = target.w / target.h;

	let height: number, width: number, rect: Rect;
	if (originalAspectRatio > targetAspectRatio) {
		height = target.h;
		width = (height / original.h) * original.w;
		rect = {
			x: target.x - (width - target.w) / 2,
			y: target.y,
			w: width,
			h: height
		};
	} else {
		width = target.w;
		height = (width / original.w) * original.h;
		rect = {
			x: target.x,
			y: target.y - (height - target.h) / 2,
			w: width,
			h: height
		};
	}
	return rect;
}

export function fitRect(original: Rect, target: Rect): Rect {
	const originalAspectRatio = original.w / original.h;
	const targetAspectRatio = target.w / target.h;

	let height: number, width: number, rect: Rect;
	if (originalAspectRatio > targetAspectRatio) {
		width = target.w;
		height = (width / original.w) * original.h;
		rect = {
			x: target.x,
			y: target.y - (height - target.h) / 2,
			w: width,
			h: height
		};
	} else {
		height = target.h;
		width = (height / original.h) * original.w;
		rect = {
			x: target.x - (width - target.w) / 2,
			y: target.y,
			w: width,
			h: height
		};
	}
	return rect;
}
