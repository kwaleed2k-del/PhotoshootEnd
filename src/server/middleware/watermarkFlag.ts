import type { NextFunction, Request, Response } from 'express';
import { getSessionUser } from '../auth/expressAuth';
import { getEffectivePlanCode, shouldWatermark } from '../services/subscriptionService';

export async function attachWatermarkFlag(req: Request, res: Response, next: NextFunction) {
	try {
		const authed = req as Request & { user?: { id: string } };
		const user = authed.user ?? (await getSessionUser(req, res));
		const [required, planCode] = await Promise.all([
			shouldWatermark(user.id),
			getEffectivePlanCode(user.id)
		]);
		authed.user = user;
		(authed as any).watermarkRequired = required;
		(authed as any).planCode = planCode;
		res.setHeader('X-Plan-Code', planCode);
		res.setHeader('X-Watermarked', String(required));
		next();
	} catch (e) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
}


