/**
 * Supabase Admin client (singleton).
 * Requires environment vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Dev guardrails: throws descriptive errors if env vars are missing.
 * Do not import this from client-side code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv(name: string, value: string | undefined): string {
	if (!value || value.length === 0) {
		const msg =
			`Missing required environment variable ${name}. ` +
			`Set ${name} in your environment (e.g., .env).`;
		// In development, provide a descriptive error. In production, still throw.
		throw new Error(msg);
	}
	return value;
}

let _admin: SupabaseClient | null = null;

export const admin: SupabaseClient = (() => {
	if (_admin) return _admin;
	const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
	const serviceKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
	_admin = createClient(url, serviceKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
	return _admin;
})();


