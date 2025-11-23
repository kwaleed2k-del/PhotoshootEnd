'use client';

import type { StudioJobDraft, StudioKind } from '@/lib/types.studios';
import { STUDIOS_TEMPLATES } from '@/config/studios';

type Props = {
	kind: StudioKind;
	draft: StudioJobDraft;
};

export function StudioSummaryCard({ kind, draft }: Props) {
	const template = STUDIOS_TEMPLATES[kind].find((t) => t.id === draft.template_id);
	return (
		<div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white">
			<h3 className="text-lg font-semibold">Summary</h3>
			<ul className="mt-3 space-y-2 text-zinc-300">
				<li>
					<span className="text-zinc-400">Template: </span>
					{template ? template.name : 'Not selected'}
				</li>
				<li>
					<span className="text-zinc-400">Images: </span>
					{draft.images_count}
				</li>
				<li>
					<span className="text-zinc-400">Variations: </span>
					{draft.variations}
				</li>
				{draft.brand ? (
					<li>
						<span className="text-zinc-400">Brand: </span>
						{draft.brand}
					</li>
				) : null}
				{draft.palette ? (
					<li>
						<span className="text-zinc-400">Palette: </span>
						{draft.palette}
					</li>
				) : null}
				{draft.notes ? (
					<li>
						<span className="text-zinc-400">Notes: </span>
						{draft.notes}
					</li>
				) : null}
				{draft.files?.length ? (
					<li>
						<span className="text-zinc-400">Files: </span>
						{draft.files.map((file) => file.name).join(', ')}
					</li>
				) : null}
			</ul>
		</div>
	);
}


