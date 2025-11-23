import { jfetch } from '@/lib/api';
import type { CreditPackage } from '@/lib/types.billing';
import type { AdminLowCreditLog, TestEmailResult } from '@/lib/types.admin';

type ListResult<T> = {
	available: boolean;
	data: T;
	message?: string;
};

type UpdateResult = {
	available: boolean;
	ok: boolean;
	message?: string;
};

const READONLY_RESULT = { available: false, data: [] as never[] };

export async function listCreditPackages(): Promise<ListResult<CreditPackage[]>> {
	try {
		const res = await jfetch<{ packages: any[] }>('/api/credit-packages');
		const data =
			res.packages?.map((pkg) => ({
				id: pkg.id,
				name: pkg.name,
				credits: pkg.credits_amount ?? pkg.credits ?? 0,
				price_minor: pkg.price_minor ?? Math.round((pkg.price_usd ?? 0) * 100),
				stripe_price_id: pkg.stripe_price_id ?? '',
				is_active: pkg.is_active ?? true
			})) ?? [];
		return { available: true, data };
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			return { available: false, data: [] };
		}
		throw error;
	}
}

export async function updateCreditPackage(id: string, patch: Partial<CreditPackage>): Promise<UpdateResult> {
	const payload = {
		stripe_price_id: patch.stripe_price_id,
		is_active: patch.is_active
	};

	const attempts: Array<{ url: string; method: string; body?: unknown }> = [
		{ url: `/api/credit-packages/${id}`, method: 'PATCH', body: payload },
		{ url: `/api/credit-packages/${id}`, method: 'PUT', body: payload },
		{ url: `/api/credit-packages/update`, method: 'POST', body: { id, ...payload } }
	];

	for (const attempt of attempts) {
		try {
			const response = await fetch(attempt.url, {
				method: attempt.method,
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(attempt.body)
			});

			if (response.status === 404) {
				continue;
			}

			if (!response.ok) {
				const message = await response.text();
				return { available: true, ok: false, message: message || 'Update failed' };
			}

			return { available: true, ok: true };
		} catch (error) {
			return { available: true, ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	}

	return { available: false, ok: false, message: 'Write endpoints unavailable' };
}

export async function listLowCreditLogs(limit = 50): Promise<ListResult<AdminLowCreditLog[]>> {
	try {
		const res = await jfetch<{ logs: AdminLowCreditLog[] }>(`/api/admin/low-credit/logs?limit=${limit}`);
		return {
			available: true,
			data: res.logs ?? []
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			return { available: false, data: [] };
		}
		throw error;
	}
}

export async function sendTestEmail(): Promise<UpdateResult & TestEmailResult> {
	try {
		const res = await fetch('/api/admin/test-email', {
			method: 'POST',
			credentials: 'include'
		});
		if (res.status === 404) {
			return { available: false, ok: false, message: 'Endpoint not available' };
		}
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			return { available: true, ok: false, message: body.error ?? 'Failed to send test email' };
		}
		const json = (await res.json().catch(() => ({}))) as TestEmailResult;
		return { available: true, ok: true, message: json.message ?? 'Email queued' };
	} catch (error) {
		return {
			available: true,
			ok: false,
			message: error instanceof Error ? error.message : String(error)
		};
	}
}


