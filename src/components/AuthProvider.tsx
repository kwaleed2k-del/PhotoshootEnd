'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseBrowser } from '@/lib/supabaseBrowser';

type AuthContextValue = {
	user: User | null;
	session: Session | null;
	supabase: SupabaseClient;
	loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_COOKIE = 'sb-access-token';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function persistAccessToken(token: string | null) {
	if (typeof document === 'undefined') return;

	const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
	if (token) {
		document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${
			secure ? '; Secure' : ''
		}`;
	} else {
		document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [supabase] = useState(() => createSupabaseBrowser());
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const init = async () => {
			const { data, error } = await supabase.auth.getSession();
			if (!mounted) return;
			if (error) {
				setSession(null);
				setUser(null);
				persistAccessToken(null);
			} else {
				setSession(data.session);
				setUser(data.session?.user ?? null);
				persistAccessToken(data.session?.access_token ?? null);
			}
			setLoading(false);
		};

		void init();

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			setSession(nextSession);
			setUser(nextSession?.user ?? null);
			persistAccessToken(nextSession?.access_token ?? null);
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, [supabase]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			session,
			supabase,
			loading
		}),
		[user, session, supabase, loading]
	);

	return (
		<AuthContext.Provider value={value}>
			{loading ? (
				<div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-400">
					Initializing session…
				</div>
			) : (
				children
			)}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return ctx;
}


