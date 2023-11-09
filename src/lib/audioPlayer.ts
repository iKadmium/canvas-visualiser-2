export class AudioPlayer {
	private analyser: AnalyserNode;
	private ctx: AudioContext;
	private analyserBuffer: Uint8Array;
	private audioBuffer: AudioBuffer | undefined;
	public length: number;

	constructor() {
		this.ctx = new AudioContext();
		this.analyser = this.createAnalyser();
		this.analyserBuffer = new Uint8Array(this.analyser.frequencyBinCount);
		this.length = 0;
	}

	public async load(file: File) {
		const buf = await file.arrayBuffer();
		this.audioBuffer = await this.ctx.decodeAudioData(buf);
		this.length = this.audioBuffer.duration;
	}

	public resetAnalyser() {
		this.analyser = this.createAnalyser();
	}

	private createAnalyser() {
		const analyser = this.ctx.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.95;
		return analyser;
	}

	public renderFrame(frame: number, frameRate: number) {
		return new Promise<void>((resolve) => {
			if (this.audioBuffer) {
				const time = frame / frameRate;
				const duration = 1 / frameRate;
				const bufferSource = this.ctx.createBufferSource();
				bufferSource.buffer = this.audioBuffer;
				bufferSource.connect(this.analyser);
				bufferSource.start(0, time, duration);
				bufferSource.addEventListener('ended', () => {
					this.analyser.getByteFrequencyData(this.analyserBuffer);
					resolve();
				});
			}
		});
	}

	public getAudioTrack() {
		if (this.audioBuffer) {
			const bufferSource = this.ctx.createBufferSource();
			bufferSource.buffer = this.audioBuffer;
			const destination = this.ctx.createMediaStreamDestination();
			bufferSource.connect(destination);
			return { bufferSource, destination };
		}
	}

	public getFft() {
		return this.analyserBuffer;
	}
}
