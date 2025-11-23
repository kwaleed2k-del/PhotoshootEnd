import type { ReactNode } from 'react';

const navLinks = [
	{ href: '/studios/product', label: 'Product Studio' },
	{ href: '/studios/apparel', label: 'Apparel Studio' }
];

export default function StudiosLayout({ children }: { children: ReactNode }) {
	return (
		<div className="px-6 py-8 text-white">
			<div className="mb-6 flex flex-wrap gap-3 text-sm">
				{navLinks.map((link) => (
					<a key={link.href} href={link.href} className="rounded border border-white/20 px-3 py-1 hover:bg-white/10">
						{link.label}
					</a>
				))}
			</div>
			{children}
		</div>
	);
}


