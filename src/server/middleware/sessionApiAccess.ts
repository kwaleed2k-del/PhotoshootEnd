import type { Request, Response, NextFunction } from 'express';
import { getSessionUser } from '../auth/expressAuth';
import { featureEnabledForUser } from '../services/subscriptionService';

export async function requireSessionApiAccess(req: Request, res: Response, next: NextFunction) {
	try {
		const user = await getSessionUser(req, res);
		const allowed = await featureEnabledForUser(user.id, 'api_access');
		if (!allowed) {
			return res.status(403).json({ error: 'api_access_disabled' });
		}
		(req as any).user = user;
		res.setHeader('X-Auth-Mode', 'session');
		next();
	} catch (e) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
}


