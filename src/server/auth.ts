/**
 * Server-only: read Supabase user from cookies.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Never import this from client-side code.
 * 
 * Note: In Vite/Express setup, cookies are read from request object.
 */
import { createServerClient } from '@supabase/ssr';
import type { Request } from 'express';

export async function getSessionUser(req?: Request): Promise<{ id: string; email?: string | null }> {
	const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY environment variables');
	}

	const getCookie = (key: string): string | undefined => {
		if (req?.cookies) {
			return req.cookies[key];
		}
		return undefined;
	};

	const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			get: getCookie,
			set: () => {},
			remove: () => {}
		}
	});

	const accessToken = getCookie('sb-access-token');
	const { data, error } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser();
	if (error || !data?.user) {
		const fallback = resolveDemoSession();
		if (fallback) return fallback;
		throw new Error('UNAUTHENTICATED');
	}
	return { id: data.user.id, email: data.user.email };
}

function resolveDemoSession() {
	const enforce = process.env.AUTH_ENFORCE !== 'false';
	const demoId = process.env.DEMO_SESSION_USER_ID;
	if (!enforce && demoId) {
		return { id: demoId, email: null };
	}
	return null;
}

