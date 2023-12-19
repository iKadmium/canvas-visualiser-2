import type { RendererOptions } from './sceneGraph';
import fragmentShader from './shaders/webGpuFragmentShader.frag.wgsl?raw';
import vertexShader from './shaders/webGpuVertexShader.vert.wgsl?raw';
import { StructManager } from './structManager';

const fftSize = 40;

interface OptionsStruct {
	iResolution: Float32Array;
	uBaseColor: Float32Array;
	uLineColor: Float32Array;
	uSegmentWidth: number;
	uGlowIntensity: number;
	uLineHeightMultiplier: number;
	[key: string]: unknown;
}

export class RendererWebGpu {
	private renderContext: GPUCanvasContext;
	private canvas: HTMLCanvasElement;
	private frameRate: number;
	private pipeline: GPURenderPipeline | undefined;
	private device: GPUDevice | undefined;
	private optionsBuffer: GPUBuffer | undefined;
	private optionsStructManager: StructManager<OptionsStruct>;
	private fftBuffer: GPUBuffer | undefined;
	private fftBufferArray: Float32Array;
	private samplesBuffer: GPUBuffer | undefined;
	private bindGroup: GPUBindGroup | undefined;

	constructor(frameRate: number, canvas: HTMLCanvasElement, options: RendererOptions) {
		this.canvas = canvas;
		const gl = canvas.getContext('webgpu');
		if (gl) {
			this.renderContext = gl;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.fftBufferArray = new Float32Array(fftSize);
		this.optionsStructManager = new StructManager<OptionsStruct>('Options', fragmentShader);
		this.optionsStructManager.setMembers(this.getOptions(options));
		this.frameRate = frameRate;
	}

	public async init() {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error('Could not get GPU');
		}
		this.device = await adapter.requestDevice();

		const devicePixelRatio = window.devicePixelRatio;
		this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
		this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
		const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

		this.renderContext.configure({
			device: this.device,
			format: presentationFormat,
			alphaMode: 'premultiplied'
		});

		this.pipeline = this.device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: this.device.createShaderModule({
					code: vertexShader
				}),
				entryPoint: 'main'
			},
			fragment: {
				module: this.device.createShaderModule({
					code: fragmentShader
				}),
				entryPoint: 'main',
				targets: [
					{
						format: presentationFormat
					}
				]
			},
			primitive: {
				topology: 'triangle-strip'
			}
		});

		this.optionsBuffer = this.device.createBuffer(this.optionsStructManager.getBufferDescriptor());

		this.fftBuffer = this.device.createBuffer({
			label: 'Fft',
			size: this.fftBufferArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.samplesBuffer = this.device.createBuffer({
			label: 'Samples',
			size: (48000 / this.frameRate) * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		this.bindGroup = this.device.createBindGroup({
			label: 'FFT renderer Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: { buffer: this.optionsBuffer }
				},
				{
					binding: 1,
					resource: { buffer: this.fftBuffer }
				},
				{
					binding: 2,
					resource: { buffer: this.samplesBuffer }
				}
			]
		});
	}

	private hexStringToFloats(hexString: string): Float32Array {
		const mainPart = hexString.slice(1);
		const bytes: Float32Array = new Float32Array(3);
		for (let i = 0; i < mainPart.length; i++) {
			const nibbleMsb = parseInt(mainPart[i * 2], 16);
			const nibbleLsb = parseInt(mainPart[i * 2 + 1], 16);
			const byte = nibbleMsb * 16 + nibbleLsb;
			bytes[i] = byte / 255.0;
		}
		return bytes;
	}

	public draw(fft: number[], channelData: Float32Array) {
		if (!this.device) {
			throw new Error('Device not initialised');
		}
		if (!this.pipeline) {
			throw new Error('Pipeline not initialised');
		}
		if (!this.fftBuffer) {
			throw new Error('FFT Buffer not initialised');
		}
		if (!this.samplesBuffer) {
			throw new Error('Samples buffer not initialisid');
		}
		if (!this.bindGroup) {
			throw new Error('Bind group not initialised');
		}
		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.renderContext.getCurrentTexture().createView();

		for (let i = 0; i < fft.length; i++) {
			this.fftBufferArray[i * 4] = fft[i];
		}
		this.device.queue.writeBuffer(this.fftBuffer, 0, this.fftBufferArray);
		this.device.queue.writeBuffer(this.samplesBuffer, 0, channelData);

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		};

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);
		passEncoder.draw(5);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	public setOptions(options: RendererOptions) {
		this.optionsStructManager.setMembers(this.getOptions(options));
		this.device?.queue.writeBuffer(this.optionsBuffer!, 0, this.optionsStructManager.getBuffer());
	}

	private getOptions(options: RendererOptions): OptionsStruct {
		const struct: OptionsStruct = {
			iResolution: new Float32Array([this.canvas.width, this.canvas.height, 0]),
			uBaseColor: this.hexStringToFloats(options.eqGlowStyle),
			uLineColor: this.hexStringToFloats(options.eqLineStyle),
			uGlowIntensity: options.eqGlowIntensity,
			uLineHeightMultiplier: options.eqLineHeightMultiplier,
			uSegmentWidth: options.eqSegmentWidth
		};
		return struct;
	}
}
