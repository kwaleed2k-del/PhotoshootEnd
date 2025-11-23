'use client';

import { createSupabaseBrowser } from '@/lib/supabaseBrowser';
import { jfetch } from '@/lib/api';
import type { Me, MePatch } from '@/lib/types.user';

function normalizeMe(apiResponse: any): Me {
	const metadata = apiResponse?.user_metadata ?? apiResponse?.user?.user_metadata ?? null;
	return {
		id: apiResponse?.id ?? apiResponse?.user?.id ?? '',
		email: apiResponse?.email ?? apiResponse?.user?.email ?? '',
		display_name: apiResponse?.display_name ?? metadata?.display_name ?? null,
		billing_email: apiResponse?.billing_email ?? metadata?.billing_email ?? null,
		stripe_customer_id: apiResponse?.stripe_customer_id ?? null,
		user_metadata: metadata
	};
}

export async function getMe(): Promise<Me> {
	try {
		const response = await jfetch<Me>('/api/users/me');
		return response;
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			const supabase = createSupabaseBrowser();
			const { data, error: supabaseError } = await supabase.auth.getUser();
			if (supabaseError || !data.user) {
				throw new Error(supabaseError?.message ?? 'Unable to resolve user session');
			}
			return normalizeMe(data.user);
		}
		throw error;
	}
}

export async function patchMe(patch: MePatch): Promise<{ me: Me; message?: string }> {
	try {
		const response = await jfetch<Me>('/api/users/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		return { me: response };
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			const supabase = createSupabaseBrowser();
			let message: string | undefined;

			const { error: metadataError, data } = await supabase.auth.updateUser({
				data: {
					display_name: patch.display_name,
					billing_email: patch.billing_email
				}
			});
			if (metadataError) {
				throw new Error(metadataError.message);
			}

			if (patch.email) {
				const { error: emailError } = await supabase.auth.updateUser({
					email: patch.email
				});
				if (emailError) {
					throw new Error(emailError.message);
				}
				message = 'Check your inbox to confirm the email change.';
			}

			return { me: normalizeMe(data?.user), message };
		}
		throw error;
	}
}


