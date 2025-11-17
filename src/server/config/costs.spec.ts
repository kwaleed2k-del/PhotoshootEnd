import { describe, expect, it } from 'vitest';
import { costOf } from './costs';

describe('costs config', () => {
	it('returns expected costs', () => {
		expect(costOf('image.generate')).toBe(2);
		expect(costOf('text.generate')).toBe(1);
	});
});


