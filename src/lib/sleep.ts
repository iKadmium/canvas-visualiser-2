export async function sleep(durationMs: number) {
	return new Promise<void>((resolve) => {
		window.setTimeout(resolve, durationMs);
	});
}
