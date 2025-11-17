import type { Request, Response, NextFunction } from 'express';
import {
	findUserIdByKey,
	touchLastUsed
} from '../services/apiKeyService';
import { featureEnabledForUser, getEffectivePlanCode } from '../services/subscriptionService';
import { rateLimitByPlan } from './planGate';

function extractKey(req: Request): string | null {
	const auth = req.headers.authorization;
	if (auth && auth.startsWith('Bearer ')) {
		return auth.slice(7).trim();
	}
	const headerKey = req.headers['x-api-key'];
	if (typeof headerKey === 'string' && headerKey.length > 0) {
		return headerKey.trim();
	}
	return null;
}

export function authenticateApiKey(scope: string) {
	const limiter = rateLimitByPlan(scope);

	return async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
		try {
			const apiKey = extractKey(req);
			if (!apiKey) {
				return res.status(401).json({ error: 'invalid_api_key' });
			}

			const match = await findUserIdByKey(apiKey);
			if (!match) {
				return res.status(401).json({ error: 'invalid_api_key' });
			}

			const allowed = await featureEnabledForUser(match.userId, 'api_access');
			if (!allowed) {
				return res.status(403).json({ error: 'api_access_disabled' });
			}

			await touchLastUsed(match.keyId);
			const planCode = await getEffectivePlanCode(match.userId);
			(req as any).user = { id: match.userId };
			(req as any).apiKeyId = match.keyId;
			(req as any).planCode = planCode;
			res.setHeader('X-Auth-Mode', 'api_key');

			return limiter(req, res, next);
		} catch (e: unknown) {
			const err = e as { message?: string };
			res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
		}
	};
}


