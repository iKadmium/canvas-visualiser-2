import { coverRect, type Rect } from '$lib/rect';
import { describe, expect, it } from 'vitest';

describe('coverRect', () => {
	describe('aspect ratio changes', () => {
		it('landscape to portrait', () => {
			const original: Rect = {
				w: 10,
				h: 5,
				x: 0,
				y: 0
			};
			const target: Rect = {
				w: 5,
				h: 10,
				x: 0,
				y: 0
			};
			const expected: Rect = {
				w: 20,
				h: 10,
				x: -7.5,
				y: 0
			};
			const actual = coverRect(original, target);
			expect(actual).toEqual(expected);
		});

		it('portrait to landscape', () => {
			const original: Rect = {
				w: 5,
				h: 10,
				x: 0,
				y: 0
			};
			const target: Rect = {
				w: 10,
				h: 5,
				x: 0,
				y: 0
			};
			const expected: Rect = {
				w: 10,
				h: 20,
				x: 0,
				y: -7.5
			};
			const actual = coverRect(original, target);
			expect(actual).toEqual(expected);
		});
	});
});
