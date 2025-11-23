'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/roles';
import { listTemplates, renderTemplate, sendTestEmail } from '@/lib/emailApi';
import type { EmailTemplate } from '@/lib/types.email';

type Tab = 'templates' | 'manual';

export default function EmailPreviewPage() {
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState<Tab>('templates');
	const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
	const [jsonInput, setJsonInput] = useState('{}');
	const [previewHtml, setPreviewHtml] = useState('<p>Select a template to preview.</p>');
	const [manualHtml, setManualHtml] = useState('<p>Hello {{name}}</p>');
	const [manualData, setManualData] = useState('{"name":"Demo"}');
	const [subject, setSubject] = useState('Test Email');
	const [status, setStatus] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);

	const { data, error, isLoading } = useSWR('emails:templates', listTemplates);

	const templates = data?.items ?? [];
	const available = data?.available ?? false;

	useMemo(() => {
		if (templates.length && !selectedTemplate) {
			setSelectedTemplate(templates[0]);
			setJsonInput(JSON.stringify(templates[0].exampleData ?? {}, null, 2));
			setPreviewHtml('<p>Render to see preview.</p>');
		}
	}, [templates, selectedTemplate]);

	if (!isAdmin(user)) {
		return (
			<div className="mx-auto mt-20 max-w-lg rounded border border-white/10 bg-white/5 p-6 text-center text-white">
				<h1 className="text-2xl font-semibold">403 — Admins only</h1>
				<p className="mt-2 text-sm text-zinc-400">You don’t have access to the Email Preview Center.</p>
				<Link href="/dashboard" className="mt-4 inline-block rounded border border-white/20 px-4 py-2 text-sm text-white">
					Back to dashboard
				</Link>
			</div>
		);
	}

	const handleRender = async () => {
		try {
			const data = JSON.parse(jsonInput || '{}');
			if (!selectedTemplate) return;
			const response = await renderTemplate({
				templateId: selectedTemplate.id,
				data
			});
			setPreviewHtml(response.html);
			setStatus(response.notes ? { message: response.notes, variant: 'info' } : null);
		} catch (error) {
			setStatus({ message: error instanceof Error ? error.message : String(error), variant: 'error' });
		}
	};

	const handleManualRender = async () => {
		try {
			const data = JSON.parse(manualData || '{}');
			const response = await renderTemplate({
				html: manualHtml,
				data
			});
			setPreviewHtml(response.html);
			setStatus(response.notes ? { message: response.notes, variant: 'info' } : null);
		} catch (error) {
			setStatus({ message: error instanceof Error ? error.message : String(error), variant: 'error' });
		}
	};

	const handleSendTest = async (mode: 'templates' | 'manual') => {
		try {
			const dataObj = JSON.parse(mode === 'templates' ? jsonInput || '{}' : manualData || '{}');
			const payload =
				mode === 'templates'
					? { subject, templateId: selectedTemplate?.id, data: dataObj }
					: { subject, html: previewHtml, data: dataObj };
			const result = await sendTestEmail(payload);
			setStatus({
				message: result.message ?? (result.ok ? 'Test email queued' : 'Test email endpoint not available'),
				variant: result.ok ? 'success' : 'error'
			});
		} catch (error) {
			setStatus({ message: error instanceof Error ? error.message : String(error), variant: 'error' });
		}
	};

	const jsonLabel = activeTab === 'templates' ? 'Template data (JSON)' : 'Data (JSON)';

	return (
		<div className="space-y-6 px-6 py-8 text-white">
			<header className="space-y-1">
				<h1 className="text-3xl font-semibold">Email Preview Center</h1>
				<p className="text-sm text-zinc-400">Render transactional templates, adjust JSON, preview, and send test emails.</p>
			</header>

			{status ? (
				<div
					className={`rounded border p-3 text-sm ${
						status.variant === 'success'
							? 'border-green-500/40 bg-green-500/10 text-green-200'
							: status.variant === 'error'
								? 'border-red-500/40 bg-red-500/10 text-red-200'
								: 'border-amber-400/40 bg-amber-500/10 text-amber-200'
					}`}
					aria-live="polite"
				>
					{status.message}
				</div>
			) : null}

			<div className="flex gap-2 text-sm">
				<button
					onClick={() => setActiveTab('templates')}
					className={`rounded px-3 py-1 ${activeTab === 'templates' ? 'bg-white text-black' : 'border border-white/20'}`}
				>
					Templates
				</button>
				<button
					onClick={() => setActiveTab('manual')}
					className={`rounded px-3 py-1 ${activeTab === 'manual' ? 'bg-white text-black' : 'border border-white/20'}`}
				>
					Manual
				</button>
			</div>

			{activeTab === 'templates' ? (
				<section className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-3 rounded border border-white/10 bg-white/5 p-4">
						<h2 className="text-lg font-semibold">Templates</h2>
						{isLoading ? (
							<p className="text-sm text-zinc-400">Loading templates…</p>
						) : error ? (
							<p className="text-sm text-red-400">Failed to load templates.</p>
						) : templates.length ? (
							<ul className="space-y-2">
								{templates.map((template) => (
									<li key={template.id}>
										<button
											onClick={() => {
												setSelectedTemplate(template);
												setJsonInput(JSON.stringify(template.exampleData ?? {}, null, 2));
												setPreviewHtml('<p>Render to see preview.</p>');
											}}
											className={`w-full rounded border px-3 py-2 text-left ${
												selectedTemplate?.id === template.id ? 'border-white bg-white/10' : 'border-white/20'
											}`}
										>
											<div className="flex justify-between text-sm">
												<span>{template.name}</span>
												<span className="text-xs uppercase text-zinc-400">{template.engine ?? 'unknown'}</span>
											</div>
											<p className="text-xs text-zinc-400">{template.description}</p>
										</button>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-zinc-400">
								No templates exposed. Use the manual tab to paste HTML. You can also add files under `/src/emails`.
							</p>
						)}
					</div>
					<div className="space-y-3 rounded border border-white/10 bg-white/5 p-4">
						<label className="block text-sm">
							Subject
							<input
								type="text"
								value={subject}
								onChange={(event) => setSubject(event.target.value)}
								className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
							/>
						</label>
						<label className="block text-sm">
							{jsonLabel}
							<textarea
								value={jsonInput}
								onChange={(event) => setJsonInput(event.target.value)}
								className="mt-1 h-48 w-full rounded border border-white/20 bg-black/30 px-3 py-2 font-mono text-xs text-white"
							/>
						</label>
						<div className="flex gap-2 text-sm">
							<button onClick={handleRender} className="rounded bg-white px-3 py-1 font-semibold text-black">
								Re-render
							</button>
							<button onClick={() => handleSendTest('templates')} className="rounded border border-white/20 px-3 py-1">
								Send test to me
							</button>
						</div>
					</div>
				</section>
			) : (
				<section className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-3 rounded border border-white/10 bg-white/5 p-4">
						<label className="block text-sm">
							HTML or MJML
							<textarea
								value={manualHtml}
								onChange={(event) => setManualHtml(event.target.value)}
								className="mt-1 h-48 w-full rounded border border-white/20 bg-black/30 px-3 py-2 font-mono text-xs text-white"
							/>
						</label>
						<label className="block text-sm">
							{jsonLabel}
							<textarea
								value={manualData}
								onChange={(event) => setManualData(event.target.value)}
								className="mt-1 h-48 w-full rounded border border-white/20 bg-black/30 px-3 py-2 font-mono text-xs text-white"
							/>
						</label>
						{manualHtml.trim().startsWith('<mjml') ? (
							<p className="text-xs text-amber-300">MJML compile not available; showing raw MJML.</p>
						) : null}
						<div className="flex gap-2 text-sm">
							<button onClick={handleManualRender} className="rounded bg-white px-3 py-1 font-semibold text-black">
								Re-render
							</button>
							<button
								onClick={() => {
									void navigator.clipboard.writeText(previewHtml);
									setStatus({ message: 'HTML copied to clipboard', variant: 'info' });
								}}
								className="rounded border border-white/20 px-3 py-1"
							>
								Copy HTML
							</button>
							<button onClick={() => handleSendTest('manual')} className="rounded border border-white/20 px-3 py-1">
								Send test to me
							</button>
						</div>
					</div>
					<div className="space-y-3 rounded border border-white/10 bg-white/5 p-4">
						<h3 className="text-sm text-zinc-300">Preview</h3>
						<div className="min-h-[320px] rounded border border-white/10 bg-white">
							<iframe className="h-full w-full" title="Email preview" srcDoc={previewHtml} />
						</div>
					</div>