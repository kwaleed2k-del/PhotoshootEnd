import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

const baseUrl = process.env.TEST_API_BASE_URL;
const freeKey = process.env.TEST_FREE_API_KEY;
const proKey = process.env.TEST_PRO_API_KEY;

const describeOrSkip = baseUrl && freeKey && proKey ? describe : describe.skip;

describeOrSkip('external text generation API', () => {
	it('returns watermarked output for free plans', async () => {
		const response = await supertest(baseUrl as string)
			.post('/api/external/generate/text')
			.set('Authorization', `Bearer ${freeKey}`)
			.send({ prompt: 'hello world', requestId: 'test-free-1' })
			.expect(200);

		expect(response.body.watermarked).toBe(true);
		expect(response.headers).toHaveProperty('x-watermarked', 'true');
	});

	it('returns non-watermarked output for paid plans', async () => {
		const response = await supertest(baseUrl as string)
			.post('/api/external/generate/text')
			.set('Authorization', `Bearer ${proKey}`)
			.send({ prompt: 'hello world pro', requestId: 'test-pro-1' })
			.expect(200);

		expect(response.body.watermarked).toBe(false);
		expect(response.headers).toHaveProperty('x-watermarked', 'false');
	});
});


