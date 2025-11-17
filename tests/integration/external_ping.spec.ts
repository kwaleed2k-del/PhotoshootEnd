import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

const baseUrl = process.env.TEST_API_BASE_URL;
const apiKey = process.env.TEST_PRO_API_KEY;

const describeOrSkip = baseUrl && apiKey ? describe : describe.skip;

describeOrSkip('external ping API', () => {
	it('responds with plan metadata for a valid API key', async () => {
		const response = await supertest(baseUrl as string)
			.get('/api/external/ping')
			.set('Authorization', `Bearer ${apiKey}`)
			.expect(200);

		expect(response.body).toHaveProperty('ok', true);
		expect(response.headers).toHaveProperty('x-auth-mode', 'api_key');
		expect(response.headers).toHaveProperty('x-ratelimit-limit');
		expect(response.headers).toHaveProperty('x-ratelimit-remaining');
	});
});

