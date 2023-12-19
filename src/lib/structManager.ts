import { StructInfo, WgslReflect } from 'wgsl_reflect';

export class StructManager<T extends Record<string, unknown>> {
	private info: StructInfo;
	private buffer: ArrayBuffer;

	constructor(name: string, shaderSource: string) {
		const shaderInfo = new WgslReflect(shaderSource);
		const structInfo = shaderInfo.structs.find((x) => x.name === name);
		if (!structInfo) {
			throw new Error(`Could not find struct called ${name}`);
		}
		this.info = structInfo;
		this.buffer = new ArrayBuffer(this.info.size);
	}

	public setMembers(values: T) {
		for (const member of this.info.members) {
			if (!Object.hasOwn(values, member.name)) {
				throw new Error(`Object did not contain a member called ${member.name}`);
			}
			const value = values[member.name];
			if (value === null || value === undefined) {
				throw new Error(`${this.info.name} was undefined`);
			}

			switch (member.type.name) {
				case 'f32':
					if (typeof value !== 'number') {
						throw new Error(`${member.name} was not a number`);
					}
					new Float32Array(this.buffer, member.offset, member.size / Float32Array.BYTES_PER_ELEMENT).set([value as number]);
					break;
				case 'vec2f':
				case 'vec3f':
				case 'vec4f':
					if (typeof value !== 'object' || (!Array.isArray(value) && !ArrayBuffer.isView(value))) {
						throw new Error(`${member.name} was not an array`);
					}
					new Float32Array(this.buffer, member.offset, member.size / Float32Array.BYTES_PER_ELEMENT).set(value as ArrayLike<number>);
					break;
				default:
					throw new Error(`No way to set values for type ${member.type.name}`);
			}
		}
	}

	public getBufferDescriptor(): GPUBufferDescriptor {
		return {
			label: this.info.name,
			size: this.info.size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		};
	}

	public getBuffer(): BufferSource | SharedArrayBuffer {
		return this.buffer;
	}
}
