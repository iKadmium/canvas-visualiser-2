export function mean(arr: Uint8Array) {
	const sum = arr.reduce((previous, current) => previous + current);
	return sum / arr.length;
}

export function reduceBands(arr: Uint8Array, bands: number) {
	const elementsPerBand = arr.length / bands;
	const outputBands: number[] = [];
	for (let i = 0; i < bands; i++) {
		const index = elementsPerBand * i;
		const bandElements = arr.slice(index, index + elementsPerBand);
		const bandValue = mean(bandElements);
		outputBands.push(bandValue);
	}
	return outputBands;
}
