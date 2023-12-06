import {
	blackman,
	blackman_harris,
	blackman_nuttall,
	cosine,
	exact_blackman,
	flat_top,
	gaussian,
	hamming,
	hann,
	kaiser,
	lanczos,
	nuttall,
	tukey,
	type WindowFunctionName
} from 'fft-windowing-ts';
import { FFTR } from 'kissfft-js';
import { sum } from 'mathjs';

export interface SpectralAnalysisMessage {
	channelData: Float32Array;
	sampleRate: number;
	frameRate: number;
	length: number;
}

export interface SpectralResultMessage {
	type: 'result';
	result: number[][];
}

export interface SpectralProgressMessage {
	type: 'progress';
	progress: number;
}

const findWindowFunction = (name: WindowFunctionName) => {
	switch (name) {
		case 'hann':
			return hann;
		case 'hamming':
			return hamming;
		case 'cosine':
			return cosine;
		case 'lanczos':
			return lanczos;
		case 'gaussian':
			return gaussian;
		case 'tukey':
			return tukey;
		case 'blackman':
			return blackman;
		case 'exact_blackman':
			return exact_blackman;
		case 'kaiser':
			return kaiser;
		case 'nuttall':
			return nuttall;
		case 'blackman_harris':
			return blackman_harris;
		case 'blackman_nuttall':
			return blackman_nuttall;
		case 'flat_top':
			return flat_top;
	}
};

const calculateMagnitude = (complexData: number[]) => {
	const newData = [];
	for (let i = 0; i < complexData.length; i = i + 2) {
		newData.push(Math.sqrt(complexData[i] * complexData[i] + complexData[i + 1] * complexData[i + 1]));
	}
	return newData;
};

const fft = (inputData: number[]) => {
	const dataLength = inputData.length;
	const fftr = new FFTR(dataLength);
	const transform = fftr.forward(inputData);
	fftr.dispose();
	const magnitude = calculateMagnitude(transform);
	return magnitude;
};

const calculateFFTFreq = (dataLength: number, sampleRate: number) => {
	const fftfreq = Array.from(Array(dataLength), (x, i) => i * (sampleRate / dataLength));
	return fftfreq;
};

const calculateWindows = (inputData: number[], windowSize: number, overlap = 0.5, windowingFunction: WindowFunctionName) => {
	const wf = findWindowFunction(windowingFunction);
	let overlapFactor = 1 / (1 - overlap);
	[overlap, windowSize, overlapFactor] = roundOverlapAndWindowSize(windowSize, overlap);
	const dataLength = inputData.length;
	if (windowSize > dataLength) {
		throw new Error('Window size must be smaller than data size');
	}
	if (overlapFactor > windowSize / 2) {
		throw new Error('Too much overlap for the window size');
	}
	const numberOfWindows = Math.floor((overlapFactor * dataLength) / windowSize) - (overlapFactor - 1);
	const windows = [];
	const stepSize = windowSize / overlapFactor;
	//Run window funciton on raw data
	for (let i = 0; i < numberOfWindows; i++) {
		windows.push(wf(inputData.slice(i * stepSize, i * stepSize + windowSize)));
	}
	return windows;
};

const calculatePSDWindows = (inputData: number[], sampleRate: number, windowSize: number, overlap = 0.5, windowingFunction: WindowFunctionName) => {
	[overlap, windowSize] = roundOverlapAndWindowSize(windowSize, overlap);
	const windows = calculateWindows(inputData, windowSize, overlap, windowingFunction);
	const scalingFactor =
		1 /
		(sampleRate *
			hann(Array(windowSize).fill(1))
				.map((element) => element ^ 2)
				.reduce((prev, current) => prev + current));
	//Calculate PSD for each window
	const psdWindows = windows.map((window) => fft(window).map((result) => (result ^ 2) * scalingFactor));
	return psdWindows;
};

/**
 * Raw FFT of data. 50% window overlap is standard.
 *
 * @return  {[number[], number[]]}  [Frequencies, FFT]
 */
const calculateFFT = (inputData: number[], sampleRate: number, windowSize: number, overlap = 0.5, windowingFunction: WindowFunctionName = 'hann') => {
	[overlap, windowSize] = roundOverlapAndWindowSize(windowSize, overlap);
	const windows = calculateWindows(inputData, windowSize, overlap, windowingFunction);

	const fftWindows = windows.map((window) => fft(window));
	//Combine windows
	const fftResult = fftWindows.reduce((total, current) => current.map((item, i) => total[i] + item), Array(windowSize).fill(0));
	const fftfreq = calculateFFTFreq(windowSize, sampleRate);
	return [fftfreq, fftResult];
};

/**
 * Implementation of Welch's method of spectral density estimation.
 *
 * @return  {[number[], number[]]}  [Frequencies, PSD]
 */
const welch = (inputData: number[], sampleRate: number, windowSize: number, overlap = 0.5, windowingFunction: WindowFunctionName = 'hann') => {
	[overlap, windowSize] = roundOverlapAndWindowSize(windowSize, overlap);
	const psdWindows = calculatePSDWindows(inputData, sampleRate, windowSize, overlap, windowingFunction);
	//Combine windows
	const psd = psdWindows.reduce((total, current) => current.map((item, i) => total[i] + item), Array(windowSize).fill(0));
	const fftfreq = calculateFFTFreq(windowSize, sampleRate);
	return [fftfreq, psd];
};

/**
 * Calcuate window size (rounded)
 *
 * @return  number  window size (rounded)
 */
const roundOverlapAndWindowSize = (windowSize: number, overlap: number): [number, number, number] => {
	const overlapFactor = Math.round(1 / (1 - overlap));
	//Rounds down the window size to an even number
	const roundedWindowSize = overlapFactor * 2 * Math.floor(windowSize / (overlapFactor * 2));
	const roundedOverlap = 1 - 1 / overlapFactor;
	return [roundedOverlap, roundedWindowSize, overlapFactor];
};

/**
 * Generates a two dimensional array, and set of corresponding frequencies
 * for plotting a spectogram of PSDs
 *
 * @return  {[number[], number[]]}  [Frequencies, PSDs]
 */
const spectrogram = (
	inputData: number[],
	sampleRate: number,
	windowSize: number,
	overlap = 0.5,
	windowingFunction: WindowFunctionName = 'hann'
): [number[], number[][]] => {
	[overlap, windowSize] = roundOverlapAndWindowSize(windowSize, overlap);
	const psdWindows = calculatePSDWindows(inputData, sampleRate, windowSize, overlap, windowingFunction);
	const psdWindowTranspose = psdWindows[0].map((x, i) => psdWindows.map((x) => x[i]));
	const fftfreq = calculateFFTFreq(windowSize, sampleRate);
	return [fftfreq, psdWindowTranspose];
};

addEventListener('message', (event: MessageEvent<SpectralAnalysisMessage>) => {
	const { channelData: rawChannelData, sampleRate, frameRate, length } = event.data;
	const frameFft: number[][] = [];
	const samplesPerFrame = sampleRate / frameRate;
	const totalFrames = Math.ceil(length / samplesPerFrame);

	const windowSize = 2048;
	const channelData: number[] = [...rawChannelData];
	channelData.push(...new Array(windowSize).fill(0));

	// get the per-frame FFT data
	for (let frame = 0; frame < totalFrames; frame++) {
		const start = Math.floor(samplesPerFrame * frame);
		const end = start + windowSize;
		const frameSamples = channelData.slice(start, end);
		const currentFrameFft = calculateFFT(frameSamples, sampleRate, windowSize, 0.99);
		frameFft[frame] = getEqBands(currentFrameFft[1]);
		const progressMessage: SpectralProgressMessage = {
			type: 'progress',
			progress: frame / totalFrames
		};
		postMessage(progressMessage);
	}

	// normalise the buckets
	for (let bucket = 0; bucket < frameFft[0].length; bucket++) {
		const bucketValues = frameFft.flatMap((x) => x);
		const fftMax = bucketValues.reduce((previous, current) => (current > previous ? current : previous));
		for (let frame = 0; frame < totalFrames; frame++) {
			frameFft[frame][bucket] = frameFft[frame][bucket] / fftMax;
		}
	}

	const resultMessage: SpectralResultMessage = {
		type: 'result',
		result: frameFft
	};
	postMessage(resultMessage);
});

function getEqBands(fft: number[]): number[] {
	const bandsData: number[] = [];
	const bandCount = Math.ceil(Math.log2(fft.length));
	for (let i = 0; i < bandCount; i++) {
		let start = 2 ** i;
		if (i === 0) {
			start = 0;
		}
		const end = 2 ** (i + 1) - 1;
		const bandData = fft.slice(start, end);
		bandsData.push(sum(bandData));
	}
	return bandsData;
}

export { calculateFFT, spectrogram, welch };
