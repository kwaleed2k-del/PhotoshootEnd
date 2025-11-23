import { jfetch } from '@/lib/api';
import type { EmailTemplate, RenderRequest, RenderResponse } from '@/lib/types.email';

type TemplatesResponse = {
	items: EmailTemplate[];
};

export async function listTemplates(): Promise<{ items: EmailTemplate[]; available: boolean }> {
	try {
		const res = await jfetch<TemplatesResponse>('/api/admin/emails/templates');
		return { items: res.items, available: true };
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			try {
				const res = await jfetch<TemplatesResponse>('/api/_emails/templates');
				return { items: res.items, available: false };
			} catch {
				return { items: [], available: false };
			}
		}
		throw error;
	}
}

export async function renderTemplate(request: RenderRequest): Promise<RenderResponse> {
	try {
		return await jfetch<RenderResponse>('/api/admin/emails/render', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request)
		});
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			if (request.html) {
				try {
					return await jfetch<RenderResponse>('/api/_emails/render', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(request)
					});
				} catch {
					return { html: request.html, notes: 'Raw preview' };
				}
			}
			return { html: '<p>No renderer available.</p>' };
		}
		throw error;
	}
}

export async function sendTestEmail(payload: {
	subject: string;
	html?: string;
	templateId?: string;
	data?: Record<string, unknown>;
}): Promise<{ ok: boolean; message?: string }> {
	try {
		const res = await jfetch<{ message?: string }>('/api/admin/test-email', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		return { ok: true, message: res.message };
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			return { ok: false, message: 'Test-email endpoint not available' };
		}
		throw error;
	}
}


