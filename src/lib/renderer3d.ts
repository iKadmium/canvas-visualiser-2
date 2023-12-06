import { mat4 } from 'gl-matrix';
import { initBuffers, type Buffers } from './3d/init-buffers';
import type { RendererOptions } from './sceneGraph';
import fragmentShader from './shaders/fragmentShader.frag?raw';
import vertexShader from './shaders/vertexShader.vert?raw';

interface ProgramInfo {
	program: WebGLProgram;
	attribLocations: {
		vertexPosition: number;
		vertexColor: number;
	};
	uniformLocations: {
		projectionMatrix: WebGLUniformLocation | null;
		modelViewMatrix: WebGLUniformLocation | null;
		resolution: WebGLUniformLocation | null;
		fft: WebGLUniformLocation | null;
		baseColor: WebGLUniformLocation | null;
		glowIntensity: WebGLUniformLocation | null;
		segmentWidth: WebGLUniformLocation | null;
		lineHeightMultiplier: WebGLUniformLocation | null;
		lineColor: WebGLUniformLocation | null;
	};
}

export class Renderer3d {
	private renderContext: WebGL2RenderingContext;
	private canvas: HTMLCanvasElement;
	private frameRate: number;
	private programInfo: ProgramInfo;
	private buffers: Buffers;
	public options: RendererOptions;

	constructor(frameRate: number, canvas: HTMLCanvasElement, options: RendererOptions) {
		this.canvas = canvas;
		this.options = options;
		const gl = canvas.getContext('webgl2');
		if (gl) {
			this.renderContext = gl;
		} else {
			throw new Error('Could not get 2D render context');
		}
		this.frameRate = frameRate;

		const shaderProgram = this.initShaderProgram(this.renderContext, vertexShader, fragmentShader);
		if (!shaderProgram) {
			throw new Error('Shader program creation failed');
		}
		this.programInfo = {
			program: shaderProgram,
			attribLocations: {
				vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
				vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor')
			},
			uniformLocations: {
				projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
				modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
				resolution: gl.getUniformLocation(shaderProgram, 'iResolution'),
				fft: gl.getUniformLocation(shaderProgram, 'uFft'),
				baseColor: gl.getUniformLocation(shaderProgram, 'uBaseColor'),
				glowIntensity: gl.getUniformLocation(shaderProgram, 'uGlowIntensity'),
				segmentWidth: gl.getUniformLocation(shaderProgram, 'uSegmentWidth'),
				lineHeightMultiplier: gl.getUniformLocation(shaderProgram, 'uLineHeightMultiplier'),
				lineColor: gl.getUniformLocation(shaderProgram, 'uLineColor')
			}
		};
		this.buffers = initBuffers(gl);
	}

	public draw(fft: number[]) {
		const gl = this.renderContext;
		gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to black, fully opaque
		gl.clearDepth(1.0); // Clear everything
		gl.enable(gl.DEPTH_TEST); // Enable depth testing
		gl.depthFunc(gl.LEQUAL); // Near things obscure far things

		// Clear the canvas before we start drawing on it.

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Create a perspective matrix, a special matrix that is
		// used to simulate the distortion of perspective in a camera.
		// Our field of view is 45 degrees, with a width/height
		// ratio that matches the display size of the canvas
		// and we only want to see objects between 0.1 units
		// and 100 units away from the camera.

		const fieldOfView = (45 * Math.PI) / 180; // in radians
		const aspect = (gl.canvas as HTMLCanvasElement).clientWidth / (gl.canvas as HTMLCanvasElement).clientHeight;
		const zNear = 0.1;
		const zFar = 100.0;
		const projectionMatrix = mat4.create();

		// note: glmatrix.js always has the first argument
		// as the destination to receive the result.
		mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

		// Set the drawing position to the "identity" point, which is
		// the center of the scene.
		const modelViewMatrix = mat4.create();

		// Now move the drawing position a bit to where we want to
		// start drawing the square.
		mat4.translate(
			modelViewMatrix, // destination matrix
			modelViewMatrix, // matrix to translate
			[-0.0, 0.0, -6.0]
		); // amount to translate

		// Tell WebGL how to pull out the positions from the position
		// buffer into the vertexPosition attribute.
		this.setPositionAttribute(gl);

		//this.setColorAttribute(gl);

		// Tell WebGL to use our program when drawing
		gl.useProgram(this.programInfo.program);

		const glowColor = this.hexStringToFloats(this.options.eqGlowStyle);
		const lineColor = this.hexStringToFloats(this.options.eqLineStyle);
		const glowIntensity = this.options.eqGlowIntensity;
		const segmentWidth = this.options.eqSegmentWidth;

		// Set the shader uniforms
		gl.uniformMatrix4fv(this.programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
		gl.uniform3f(this.programInfo.uniformLocations.resolution, this.canvas.width, this.canvas.height, 1);
		gl.uniform1fv(this.programInfo.uniformLocations.fft, fft, 0, fft.length);
		gl.uniform3fv(this.programInfo.uniformLocations.baseColor, glowColor, 0, glowColor.length);
		gl.uniform3fv(this.programInfo.uniformLocations.lineColor, lineColor, 0, lineColor.length);
		gl.uniform1f(this.programInfo.uniformLocations.glowIntensity, glowIntensity);
		gl.uniform1f(this.programInfo.uniformLocations.segmentWidth, segmentWidth);
		gl.uniform1f(this.programInfo.uniformLocations.lineHeightMultiplier, this.options.eqLineHeightMultiplier);

		{
			const offset = 0;
			const vertexCount = 4;
			gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
		}
	}

	//
	// Initialize a shader program, so WebGL knows how to draw our data
	//
	private initShaderProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
		const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
		if (!vertexShader) {
			throw new Error('Vertex Shader failed');
		}
		const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
		if (!fragmentShader) {
			throw new Error('Fragment Shader failed');
		}

		// Create the shader program

		const shaderProgram = gl.createProgram();
		if (!shaderProgram) {
			throw new Error('Shader program failed');
		}
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		// If creating the shader program failed, alert

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
			return null;
		}

		return shaderProgram;
	}

	//
	// creates a shader of the given type, uploads the source and
	// compiles it.
	//
	private loadShader(gl: WebGL2RenderingContext, type: number, source: string) {
		const shader = gl.createShader(type);
		if (!shader) {
			throw new Error('Shader creation failed');
		}

		// Send the source to the shader object

		gl.shaderSource(shader, source);

		// Compile the shader program

		gl.compileShader(shader);

		// See if it compiled successfully

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
			gl.deleteShader(shader);
			return null;
		}

		return shader;
	}

	// Tell WebGL how to pull out the positions from the position
	// buffer into the vertexPosition attribute.
	private setPositionAttribute(gl: WebGL2RenderingContext) {
		const numComponents = 2; // pull out 2 values per iteration
		const type = gl.FLOAT; // the data in the buffer is 32bit floats
		const normalize = false; // don't normalize
		const stride = 0; // how many bytes to get from one set of values to the next
		// 0 = use type and numComponents above
		const offset = 0; // how many bytes inside the buffer to start from
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
		gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);
		gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
	}

	// Tell WebGL how to pull out the colors from the color buffer
	// into the vertexColor attribute.
	private setColorAttribute(gl: WebGL2RenderingContext) {
		const numComponents = 4;
		const type = gl.FLOAT;
		const normalize = false;
		const stride = 0;
		const offset = 0;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
		gl.vertexAttribPointer(this.programInfo.attribLocations.vertexColor, numComponents, type, normalize, stride, offset);
		gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);
	}

	private hexStringToFloats(hexString: string): number[] {
		const mainPart = hexString.slice(1);
		const bytes: number[] = [];
		for (let i = 0; i < mainPart.length; i += 2) {
			const nibbleMsb = parseInt(mainPart[i], 16);
			const nibbleLsb = parseInt(mainPart[i + 1], 16);
			const byte = nibbleMsb * 16 + nibbleLsb;
			bytes.push(byte / 255.0);
		}
		return bytes;
	}
}
