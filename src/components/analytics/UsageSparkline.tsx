import React from 'react';

interface Props {
	data: Array<{ date: string; value: number }>;
	label: string;
}

export function UsageSparkline({ data, label }: Props) {
	const width = 240;
	const height = 80;
	const values = data.map((d) => d.value);
	const min = Math.min(...values, 0);
	const max = Math.max(...values, 0);
	const range = max - min || 1;

	const points = data.map((point, idx) => {
		const x = (idx / Math.max(1, data.length - 1)) * width;
		const y = height - ((point.value - min) / range) * height;
		return { x, y };
	});

	const path = points
		.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
		.join(' ');

	const areaPath = `${path} L${width},${height} L0,${height} Z`;
	const latest = data[data.length - 1]?.value ?? 0;

	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 flex flex-col gap-2">
			<div className="text-sm text-zinc-400">{label}</div>
			<div className="text-xl font-semibold text-white">{latest}</div>
			<svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 text-violet-400">
				<path d={areaPath} fill="currentColor" opacity={0.15} />
				<path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
			</svg>
		</div>
	);
}


