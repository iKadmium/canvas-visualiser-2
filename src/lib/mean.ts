export function mean(arr: Float32Array | number[]) {
	let sum = 0;
	arr.forEach((value) => (sum += value / arr.length));
	return sum;
}

export function reduceBands(arr: Float32Array | number[], bands: number) {
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

export function reduceBandsOlympic(arr: Float32Array | number[], bands: number) {
	const newBands = reduceBands(arr, bands + 4);
	return newBands.slice(2, bands + 2);
}
