const maxSpeed = 0.002;
const maxStrength = 0.9;
const multiplier = 1;

export class LineRenderer {
	private x: number;
	private mirrorX: number;
	private y: number;
	private maxHeight: number;

	private lastStrength: number;

	constructor(x: number, mirrorX: number, y: number, maxHeight: number) {
		this.x = x;
		this.mirrorX = mirrorX;
		this.y = y;
		this.maxHeight = maxHeight;
		this.lastStrength = 0;
	}

	public render(renderContex2d: CanvasRenderingContext2D, strength: number, interpolation = true) {
		const difference = this.lastStrength - strength;
		let currentStrength: number;
		if (interpolation && Math.abs(difference) > maxSpeed) {
			if (strength > this.lastStrength) {
				currentStrength = this.lastStrength + maxSpeed;
			} else {
				currentStrength = this.lastStrength - maxSpeed;
			}
		} else {
			strength *= multiplier;
			currentStrength = Math.min(strength, maxStrength);
		}

		const height = this.maxHeight * currentStrength;

		renderContex2d.beginPath();
		renderContex2d.moveTo(this.x, this.y - height / 2);
		renderContex2d.lineTo(this.x, this.y + height / 2);
		renderContex2d.stroke();

		renderContex2d.beginPath();
		renderContex2d.moveTo(this.mirrorX, this.y - height / 2);
		renderContex2d.lineTo(this.mirrorX, this.y + height / 2);
		renderContex2d.stroke();

		this.lastStrength = currentStrength;
	}
}
