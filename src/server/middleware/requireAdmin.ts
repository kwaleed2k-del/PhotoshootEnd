import type { NextFunction, Request, Response } from 'express';
import { getSessionUser } from '../auth/expressAuth';
import { admin } from '../supabaseAdmin';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
	try {
		const user = await getSessionUser(req, res);
		const { data, error } = await admin
			.from('users')
			.select('is_admin')
			.eq('id', user.id)
			.single();
		if (error) throw new Error(error.message);
		if (!data?.is_admin) {
			return res.status(403).json({ error: 'forbidden_admin_only' });
		}
		(req as any).user = user;
		next();
	} catch (e) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		return res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
}


