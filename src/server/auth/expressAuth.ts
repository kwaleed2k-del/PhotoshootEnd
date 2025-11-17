/**
 * Express-specific auth helper - reads Supabase session from cookies.
 * Server-only; requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
import { createServerClient } from '@supabase/ssr';
import type { Request, Response } from 'express';

export class UnauthenticatedError extends Error {
	code = 'UNAUTHENTICATED' as const;
	constructor(message = 'No active session') {
		super(message);
		this.name = 'UnauthenticatedError';
	}
}

export async function getSessionUser(
	req: Request,
	res: Response
): Promise<{ id: string; email?: string | null }> {
	const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY environment variables');
	}

	const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			get: (key: string) => (req as { cookies?: Record<string, string> }).cookies?.[key],
			set: (key: string, value: string, options?: Record<string, unknown>) => {
				res.cookie(key, value, options as Parameters<typeof res.cookie>[2]);
			},
			remove: (key: string, options?: Record<string, unknown>) => {
				res.clearCookie(key, options as Parameters<typeof res.clearCookie>[1]);
			},
		},
	});

	const { data, error } = await supabase.auth.getUser();
	if (error || !data?.user) {
		throw new UnauthenticatedError();
	}
	return { id: data.user.id, email: data.user.email ?? undefined };
}

