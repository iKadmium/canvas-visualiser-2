import type { RendererOptions } from './sceneGraph';
import fragmentShader from './shaders/webGpuFragmentShader.frag.wgsl?raw';
import vertexShader from './shaders/webGpuVertexShader.vert.wgsl?raw';

const optionsSize = 16;
const fftSize = 40;

export class RendererWebGpu {
	private renderContext: GPUCanvasContext;
	private canvas: HTMLCanvasElement;
	private frameRate: number;
	private pipeline: GPURenderPipeline | undefined;
	private device: GPUDevice | undefined;
	private optionsBufferArray: Float32Array;
	private optionsBuffer: GPUBuffer | undefined;
	private fftBuffer: GPUBuffer | undefined;
	private fftBufferArray: Float32Array;
	private bindGroup: GPUBindGroup | undefined;

	constructor(frameRate: number, canvas: HTMLCanvasElement, options: RendererOptions) {
		this.canvas = canvas;
		const gl = canvas.getContext('webgpu');
		if (gl) {
			this.renderContext = gl;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.optionsBufferArray = new Float32Array(optionsSize);
		this.fftBufferArray = new Float32Array(fftSize);
		this.setOptions(options);
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

		this.optionsBuffer = this.device.createBuffer({
			label: 'Options',
			size: this.optionsBufferArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.fftBuffer = this.device.createBuffer({
			label: 'Fft',
			size: this.fftBufferArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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

	public draw(fft: number[]) {
		if (!this.device) {
			throw new Error('Device not initialised');
		}
		if (!this.pipeline) {
			throw new Error('Pipeline not initialised');
		}
		if (!this.fftBuffer) {
			throw new Error('FFT Buffer not initialised');
		}
		if (!this.bindGroup) {
			throw new Error('Bind group not initialised');
		}
		const commandEncoder = this.device.createCommandEncoder();
		const textureView = this.renderContext.getCurrentTexture().createView();

		for (let i = 0; i < fft.length; i++) {
			this.fftBufferArray[i * 4] = fft[i];
		}
		this.device.queue.writeBuffer(this.optionsBuffer!, 0, this.optionsBufferArray);
		this.device.queue.writeBuffer(this.fftBuffer, 0, this.fftBufferArray);

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
		// 	00 iResolution : vec3 < f32>,
		//  03 uBaseColor : vec3 < f32>,
		//  06 uLineColor : vec3 < f32>,
		//  09 uSegmentWidth : f32,
		//  10 uGlowIntensity : f32,
		//  11 uLineHeightMultiplier : f32
		this.optionsBufferArray[0] = this.canvas.width;
		this.optionsBufferArray[1] = this.canvas.height;
		const glowColor = this.hexStringToFloats(options.eqGlowStyle);
		this.optionsBufferArray.set(glowColor, 4);
		const lineColor = this.hexStringToFloats(options.eqLineStyle);
		this.optionsBufferArray.set(lineColor, 8);
		this.optionsBufferArray[11] = options.eqSegmentWidth;
		this.optionsBufferArray[12] = options.eqGlowIntensity;
		this.optionsBufferArray[13] = options.eqLineHeightMultiplier;
	}
}
