// place files you want to import through the `$lib` alias in this folder.

export function rescale(value: number, origMin: number, origMax: number, newMin: number, newMax: number) {
	const origRange = origMax - origMin;
	const newRange = newMax - newMin;
	const pct = (value - origMin) / origRange;
	const newVal = pct * newRange + newMin;
	return newVal;
}
