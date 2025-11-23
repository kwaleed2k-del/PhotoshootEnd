'use client';

import type { StudioJobDraft, StudioJobCreated, StudioKind } from '@/lib/types.studios';
import { jfetch } from '@/lib/api';

const draftKey = (kind: StudioKind) => `studios:${kind}:draft`;

export function loadDraft(kind: StudioKind): StudioJobDraft | null {
	if (typeof window === 'undefined') return null;
	const raw = window.localStorage.getItem(draftKey(kind));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return parsed;
	} catch {
		return null;
	}
}

export function saveDraft(kind: StudioKind, draft: StudioJobDraft) {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(draftKey(kind), JSON.stringify({ ...draft, files: undefined }));
}

export function clearDraft(kind: StudioKind) {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(draftKey(kind));
}

export async function createStudioJob(
	kind: StudioKind,
	body: Omit<StudioJobDraft, 'files'>
): Promise<StudioJobCreated | { preview: true }> {
	try {
		const res = await jfetch<StudioJobCreated>(`/api/studios/${kind}/jobs`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		return res;
	} catch (error) {
		if (error instanceof Error && (error.message.includes('404') || error.message.includes('405'))) {
			return { preview: true };
		}
		throw error;
	}
}

export async function listStudioJobs(limit = 20) {
	try {
		const res = await jfetch<{ jobs: Array<{ id: string; kind: StudioKind; status: string; created_at?: string }> }>(
			`/api/studios/jobs?limit=${limit}`
		);
		return res.jobs ?? [];
	} catch (error) {
		if (error instanceof Error && error.message.includes('404')) {
			return { available: false };
		}
		throw error;
	}
}


