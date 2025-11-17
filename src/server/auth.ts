/**
 * Server-only: read Supabase user from cookies.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Never import this from client-side code.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSessionUser(): Promise<{ id: string; email?: string | null }> {
	const cookieStore = cookies();
	const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY environment variables');
	}

	const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			get: (key: string) => cookieStore.get(key)?.value,
			set: () => {},
			remove: () => {},
		},
	});

	const { data, error } = await supabase.auth.getUser();
	if (error || !data?.user) {
		throw new Error('UNAUTHENTICATED');
	}
	return { id: data.user.id, email: data.user.email };
}

