/**
 * Server-only middlewares for plan gating and per-plan rate limiting.
 */
import type { Request, Response, NextFunction } from 'express';
import { getSessionUser } from '../auth/expressAuth';
import { getEffectivePlanCode, featureEnabledForUser } from '../services/subscriptionService';
import { admin } from '../supabaseAdmin';
import { getPlanScopeLimit } from '../config/rateLimits';

interface AuthedRequest extends Request {
	user?: { id: string; email?: string | null };
	planCode?: string;
}

export async function requireApiAccess(req: Request, res: Response, next: NextFunction) {
	try {
		const authedReq = req as AuthedRequest;
		const user = authedReq.user ?? (await getSessionUser(req, res));
		const ok = await featureEnabledForUser(user.id, 'api_access');
		if (!ok) {
			return res.status(403).json({ error: 'api_access_disabled' });
		}
		authedReq.user = user;
		next();
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
}

export async function attachPlanCode(req: Request, res: Response, next: NextFunction) {
	try {
		const authedReq = req as AuthedRequest;
		const user = authedReq.user ?? (await getSessionUser(req, res));
		const planCode = (authedReq.planCode as string | undefined) ?? (await getEffectivePlanCode(user.id));
		authedReq.user = user;
		authedReq.planCode = planCode;
		next();
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
}

export function rateLimitByPlan(scope: string) {
	return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
		try {
			const authedReq = req as AuthedRequest;
			const user = authedReq.user ?? (await getSessionUser(req, res));
			const planCode = (authedReq.planCode as string | undefined) ?? (await getEffectivePlanCode(user.id));
			const { windowMs, limit } = getPlanScopeLimit(planCode, scope);
			const now = Date.now();
			const windowStartMs = Math.floor(now / windowMs) * windowMs;
			const windowStartIso = new Date(windowStartMs).toISOString();

			const { data, error } = await admin.rpc<number>('bump_rate_limit', {
				p_user_id: user.id,
				p_scope: scope,
				p_window_start: windowStartIso
			});

			if (error) {
				return res.status(500).json({ error: String(error.message ?? error) });
			}

			const hits = Number(data ?? 0);
			const resetSeconds = Math.floor((windowStartMs + windowMs) / 1000);
			res.setHeader('X-RateLimit-Limit', String(limit));
			res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - hits)));
			res.setHeader('X-RateLimit-Reset', String(resetSeconds));

			if (hits > limit) {
				return res.status(429).json({ error: 'rate_limit_exceeded', scope, plan: planCode });
			}

			authedReq.user = user;
			authedReq.planCode = planCode;
			next();
		} catch (e: unknown) {
			const err = e as { message?: string };
			if (String(err?.message).includes('UNAUTHENTICATED')) {
				return res.status(401).json({ error: 'unauthenticated' });
			}
			res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
		}
	};
}


