export function timed<T>(operation: () => T) {
	const before = performance.now();
	const result = operation();
	const after = performance.now();
	return { time: after - before, result };
}

export function logTimed<T>(name: string, operation: () => T) {
	const result = timed(operation);
	console.log(`${name} - ${result.time}`);
	return result.result;
}

export async function timedAsync<T>(operation: () => Promise<T>) {
	const before = performance.now();
	const result = await operation();
	const after = performance.now();
	return { time: after - before, result };
}

export async function logTimedAsync<T>(name: string, operation: () => Promise<T>) {
	const result = await timedAsync(operation);
	console.log(`${name} - ${result.time}`);
	return result.result;
}
