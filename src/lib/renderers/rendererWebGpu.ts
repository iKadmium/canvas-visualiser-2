import type { RendererOptions } from '../sceneGraph';
import fragmentShader from '../shaders/webGpuFragmentShader.frag.wgsl?raw';
import vertexShader from '../shaders/webGpuVertexShader.vert.wgsl?raw';
import { StructManager } from '../structManager';

const fftSize = 40;

interface OptionsStruct {
	resolution: Float32Array;
	eqGlowColor: Float32Array;
	eqLineColor: Float32Array;
	scopeColor: Float32Array;
	waterColor: Float32Array;
	eqSegmentWidth: number;
	eqGlowIntensity: number;
	eqLineHeightMultiplier: number;
	eqEnabled: boolean;
	scopeEnabled: boolean;
	discoTeqEnabled: boolean;
	wetEnabled: boolean;
	[key: string]: unknown;
}

interface BufferSet {
	optionsBuffer: GPUBuffer;
	fftBuffer: GPUBuffer;
	samplesBuffer: GPUBuffer;
	timeBuffer: GPUBuffer;
	bindGroup: GPUBindGroup;
	textureView: GPUTextureView;
}

export class RendererWebGpu {
	private renderContext: GPUCanvasContext;
	private canvas: HTMLCanvasElement;
	private frameRate: number;
	private pipeline: GPURenderPipeline | undefined;
	private device: GPUDevice | undefined;
	private optionsStructManager: StructManager<OptionsStruct>;
	private fftBufferArray: Float32Array;
	private buffers: BufferSet | undefined;

	constructor(frameRate: number, options: RendererOptions) {
		this.canvas = document.createElement('canvas');
		const gl = this.canvas.getContext('webgpu');
		if (gl) {
			this.renderContext = gl;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.fftBufferArray = new Float32Array(fftSize);
		this.optionsStructManager = new StructManager<OptionsStruct>('Options', fragmentShader);
		this.setOptions(options, true);
		this.frameRate = frameRate;
	}

	public async init() {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error('Could not get GPU');
		}
		this.device = await adapter.requestDevice();

		const devicePixelRatio = window.devicePixelRatio;
		const presentationSize = [this.canvas.clientWidth * devicePixelRatio, this.canvas.clientHeight * devicePixelRatio];
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

		const optionsBuffer = this.device.createBuffer(this.optionsStructManager.getBufferDescriptor());

		const fftBuffer = this.device.createBuffer({
			label: 'Fft',
			size: this.fftBufferArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		const samplesBuffer = this.device.createBuffer({
			label: 'Samples',
			size: (48000 / this.frameRate) * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		const timeBuffer = this.device.createBuffer({
			label: 'Time',
			size: Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		const bindGroup = this.device.createBindGroup({
			label: 'FFT renderer Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: { buffer: optionsBuffer }
				},
				{
					binding: 1,
					resource: { buffer: fftBuffer }
				},
				{
					binding: 2,
					resource: { buffer: timeBuffer }
				},
				{
					binding: 3,
					resource: { buffer: samplesBuffer }
				}
			]
		});

		const texture = this.device.createTexture({
			size: presentationSize,
			format: presentationFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		});

		this.buffers = {
			bindGroup,
			fftBuffer,
			optionsBuffer,
			samplesBuffer,
			timeBuffer,
			textureView: texture.createView()
		};
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

	public render(frame: number, fft: number[], channelData: Float32Array) {
		if (!this.device) {
			throw new Error('Device not initialised');
		}
		if (!this.pipeline) {
			throw new Error('Pipeline not initialised');
		}
		if (!this.buffers) {
			throw new Error('Buffers not initialised');
		}
		const commandEncoder = this.device.createCommandEncoder();

		for (let i = 0; i < fft.length; i++) {
			this.fftBufferArray[i * 4] = fft[i];
		}

		this.device.queue.writeBuffer(this.buffers.fftBuffer, 0, this.fftBufferArray);
		this.device.queue.writeBuffer(this.buffers.timeBuffer, 0, new Float32Array([frame]));
		this.device.queue.writeBuffer(this.buffers.samplesBuffer, 0, channelData);

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: this.renderContext.getCurrentTexture().createView(),
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		};

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.buffers.bindGroup);
		passEncoder.draw(5);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	public draw(context: CanvasRenderingContext2D) {
		context.drawImage(this.canvas, 0, 0);
	}

	public async setOptions(options: RendererOptions, skipInit: boolean = false) {
		if (this.canvas.width !== options.width || this.canvas.height !== options.height) {
			this.canvas.width = options.width;
			this.canvas.height = options.height;
			if (!skipInit) {
				await this.init();
			}
		}
		this.optionsStructManager.setMembers(this.getOptions(options));
		this.device?.queue.writeBuffer(this.buffers!.optionsBuffer!, 0, this.optionsStructManager.getBuffer());
	}

	private getOptions(options: RendererOptions): OptionsStruct {
		const struct: OptionsStruct = {
			resolution: new Float32Array([this.canvas.width, this.canvas.height]),
			eqGlowColor: this.hexStringToFloats(options.eqGlowStyle || '#000000'),
			eqLineColor: this.hexStringToFloats(options.eqLineStyle || '#000000'),
			eqGlowIntensity: options.eqGlowIntensity,
			eqLineHeightMultiplier: options.eqLineHeightMultiplier,
			eqSegmentWidth: options.eqSegmentWidth,
			scopeColor: this.hexStringToFloats(options.scopeColor || '#000000'),
			waterColor: this.hexStringToFloats(options.waterColor || '#000000'),
			discoTeqEnabled: options.discoteqEnabled,
			eqEnabled: options.eqEnabled,
			scopeEnabled: options.scopeEnabled,
			wetEnabled: options.wetEnabled
		};
		return struct;
	}
}
