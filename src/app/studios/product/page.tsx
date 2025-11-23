'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { STUDIOS_TEMPLATES } from '@/config/studios';
import type { StudioJobDraft } from '@/lib/types.studios';
import { createStudioJob, loadDraft, saveDraft, clearDraft, listStudioJobs } from '@/lib/studiosClient';
import { jfetch } from '@/lib/api';
import { StudioStepper } from '@/components/studios/StudioStepper';
import { StudioEstimator } from '@/components/studios/StudioEstimator';
import { StudioSummaryCard } from '@/components/studios/StudioSummaryCard';

const DEFAULT_DRAFT: StudioJobDraft = {
	template_id: STUDIOS_TEMPLATES.product[0].id,
	images_count: 3,
	variations: 0,
	brand: '',
	palette: '',
	notes: '',
	files: []
};

export default function ProductStudioPage() {
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<StudioJobDraft>(() => loadDraft('product') ?? DEFAULT_DRAFT);
	const [submitState, setSubmitState] = useState<{ status: 'idle' | 'pending' | 'preview' | 'success'; message?: string }>({
		status: 'idle'
	});

	const { data: balance } = useSWR('studios:balance', async () => {
		try {
			const res = await jfetch<{ balance: number }>('/api/billing/balance');
			return res.balance;
		} catch {
			return null;
		}
	});

	const { data: jobs } = useSWR('studios:jobs', () => listStudioJobs(20));

	useEffect(() => {
		saveDraft('product', draft);
	}, [draft]);

	const steps = [
		{ id: 'template', title: 'Template' },
		{ id: 'inputs', title: 'Inputs' },
		{ id: 'review', title: 'Review & launch' }
	];

	const templates = STUDIOS_TEMPLATES.product;

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? Array.from(event.target.files) : [];
		setDraft((prev) => ({ ...prev, files }));
	};

	const handleNext = () => setStep((prev) => Math.min(prev + 1, steps.length - 1));
	const handlePrev = () => setStep((prev) => Math.max(prev - 1, 0));

	const handleSaveJob = async () => {
		setSubmitState({ status: 'pending' });
		try {
			const result = await createStudioJob('product', {
				template_id: draft.template_id,
				images_count: draft.images_count,
				variations: draft.variations,
				brand: draft.brand,
				palette: draft.palette,
				notes: draft.notes
			});
			if ('preview' in result && result.preview) {
				setSubmitState({
					status: 'preview',
					message: 'Endpoint not available yet—studio flow is in preview mode.'
				});
				return;
			}
			if ('id' in result) {
				setSubmitState({ status: 'success', message: `Job queued with ID ${result.id}` });
			} else {
				setSubmitState({ status: 'success', message: 'Job queued successfully' });
			}
			clearDraft('product');
		} catch (error) {
			setSubmitState({
				status: 'idle',
				message: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const renderedStep = useMemo(() => {
		switch (step) {
			case 0:
				return (
					<div className="space-y-4">
						{templates.map((template) => (
							<label
								key={template.id}
								className={`block cursor-pointer rounded border p-4 ${
									draft.template_id === template.id ? 'border-white bg-white/10' : 'border-white/20'
								}`}
							>
								<input
									type="radio"
									name="template"
									value={template.id}
									checked={draft.template_id === template.id}
									onChange={() => setDraft((prev) => ({ ...prev, template_id: template.id }))}
									className="sr-only"
								/>
								<h3 className="text-lg font-semibold">{template.name}</h3>
								<p className="text-sm text-zinc-400">{template.description}</p>
							</label>
						))}
					</div>
				);
			case 1:
				return (
					<form className="space-y-3">
						<label className="block text-sm text-zinc-300">
							Number of source images
							<input
								type="number"
								min={1}
								max={50}
								value={draft.images_count}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, images_count: Number(event.target.value) }))
								}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
								required
							/>
						</label>
						<label className="block text-sm text-zinc-300">
							Variations per image
							<input
								type="number"
								min={0}
								max={10}
								value={draft.variations}
								onChange={(event) =>
									setDraft((prev) => ({ ...prev, variations: Number(event.target.value) }))
								}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
							/>
						</label>
						<label className="block text-sm text-zinc-300">
							Brand
							<input
								type="text"
								value={draft.brand ?? ''}
								onChange={(event) => setDraft((prev) => ({ ...prev, brand: event.target.value }))}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white"
							/>
						</label>
						<label className="block text-sm text-zinc-300">
							Palette / art direction
							<input
								type="text"
								value={draft.palette ?? ''}
								onChange={(event) => setDraft((prev) => ({ ...prev, palette: event.target.value }))}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white"
							/>
						</label>
						<label className="block text-sm text-zinc-300">
							Notes
							<textarea
								value={draft.notes ?? ''}
								onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white"
								rows={3}
							/>
						</label>
						<label className="block text-sm text-zinc-300">
							Reference files (optional)
							<input
								type="file"
								multiple
								onChange={handleFileChange}
								className="mt-1 w-full text-white"
							/>
							{draft.files?.length ? (
								<ul className="mt-2 list-disc px-4 text-xs text-zinc-400">
									{draft.files.map((file) => (
										<li key={file.name}>{file.name}</li>
									))}
								</ul>
							) : null}
						</label>
						<div className="flex gap-2 text-sm">
							<button
								type="button"
								onClick={() => saveDraft('product', draft)}
								className="rounded border border-white/20 px-3 py-1 hover:bg-white/10"
							>
								Save draft
							</button>
							<button
								type="button"
								onClick={() => {
									const stored = loadDraft('product');
									if (stored) setDraft({ ...stored, files: [] });
								}}
								className="rounded border border-white/20 px-3 py-1 hover:bg-white/10"
							>
								Load draft
							</button>
						</div>
					</form>
				);
			case 2:
				return (
					<div className="space-y-4">
						<StudioSummaryCard kind="product" draft={draft} />
						<StudioEstimator kind="product" draft={draft} balance={balance ?? undefined} />
						<div className="flex flex-wrap gap-3">
							<button
								onClick={handleSaveJob}
								className="rounded bg-white px-4 py-2 text-sm font-semibold text-black"
								disabled={submitState.status === 'pending'}
							>
								{submitState.status === 'pending' ? 'Queuing…' : 'Start job'}
							</button>
							<button
								onClick={() => setStep(1)}
								className="rounded border border-white/20 px-4 py-2 text-sm text-white"
							>
								Back to inputs
							</button>
							<button
								onClick={() => {
									setDraft(DEFAULT_DRAFT);
									clearDraft('product');
								}}
								className="rounded border border-white/20 px-4 py-2 text-sm text-white"
							>
								Reset
							</button>
						</div>
						{submitState.message ? (
							<div
								className={`rounded border p-2 text-sm ${
									submitState.status === 'success'
										? 'border-green-500/40 bg-green-500/10 text-green-200'
										: submitState.status === 'preview'
											? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
											: 'border-red-500/40 bg-red-500/10 text-red-200'
								}`}
							>
								{submitState.message}
							</div>
						) : null}
					</div>
				);
			default:
				return null;
		}
	}, [balance, draft, handleSaveJob, step, submitState.message, submitState.status, templates]);

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<h1 className="text-3xl font-semibold text-white">Product Studio</h1>
				<p className="text-sm text-zinc-400">Set up clean product shots, estimate credits, and preview the experience.</p>
			</header>
			<StudioStepper steps={steps} active={step} onPrev={handlePrev} onNext={handleNext}>
				{renderedStep}
			</StudioStepper>
			<section className="space-y-3 rounded border border-white/10 bg-white/5 p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">My jobs</h2>
					<button
						onClick={() => void listStudioJobs(20)}
						className="text-xs text-blue-300 underline"
					>
						Refresh
					</button>
				</div>
				{Array.isArray(jobs) ? (
					jobs.length ? (
						<ul className="space-y-2 text-sm text-zinc-300">
							{jobs.map((job) => (
								<li key={job.id} className="rounded border border-white/10 px-3 py-2">
									<div className="flex justify-between">
										<span className="font-mono text-xs">{job.id}</span>
										<span className="text-xs uppercase">{job.status}</span>
									</div>
									<p className="text-xs text-zinc-400">
										{job.kind} • {job.created_at ? new Date(job.created_at).toLocaleString() : 'pending'}
									</p>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-zinc-400">No jobs yet. Once the endpoint is live, your history will appear here.</p>
					)
				) : jobs && 'available' in jobs && jobs.available === false ? (
					<p className="text-sm text-zinc-400">Jobs endpoint not available yet—preview mode only.</p>
				) : (
					<p className="text-sm text-zinc-400">Loading jobs…</p>
				)}
			</section>
		</div>
	);
}
