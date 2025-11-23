import type { User } from '@supabase/supabase-js';

export function isAdmin(user: User | null | undefined): boolean {
	return Boolean(user?.user_metadata && user.user_metadata.role === 'admin');
}


