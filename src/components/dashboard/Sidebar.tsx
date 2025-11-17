import React from 'react';
import { Home, Compass, PlusSquare, Users2, Wand2, BookOpen, HelpCircle, Crown, Activity, Shield } from 'lucide-react';
import { usePlan } from '../../hooks/usePlan';

type NavItem = {
	label: string;
	icon: React.ReactNode;
	href: string;
};

const main: NavItem[] = [
	{ label: 'Home', icon: <Home size={18} />, href: '/dashboard' },
	{ label: 'Discover', icon: <Compass size={18} />, href: '/dashboard#discover' },
	{ label: 'Create', icon: <PlusSquare size={18} />, href: '/studio/apparel' },
	{ label: 'Models', icon: <Users2 size={18} />, href: '/dashboard#models' },
	{ label: 'Edit', icon: <Wand2 size={18} />, href: '/studio/product' },
	{ label: 'Library', icon: <BookOpen size={18} />, href: '/dashboard#library' },
	{ label: 'Usage', icon: <Activity size={18} />, href: '/usage' },
	{ label: 'Billing', icon: <Crown size={18} />, href: '/billing' },
];

export function Sidebar() {
	const { features } = usePlan();
	return (
		<aside
			className="hidden md:flex md:flex-col w-56 flex-shrink-0 h-[calc(100vh-0px)] sticky top-0 border-r border-white/10 bg-zinc-950/80 backdrop-blur"
			aria-label="Primary"
		>
			<div className="px-3 pt-4 pb-2">
				<a href="/" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-900/60">
					<Wand2 className="text-violet-400" size={20} />
					<span className="font-semibold text-zinc-100">Lenci Studio</span>
				</a>
			</div>
			<nav className="px-2 space-y-1">
				{main.map((item) => (
					<a
						key={item.label}
						href={item.href}
						className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
						aria-label={item.label}
					>
						{item.icon}
						<span className="text-sm">{item.label}</span>
					</a>
				))}
				{features.admin && (
					<a
						href="/admin"
						className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
						aria-label="Admin"
					>
						<Shield size={18} />
						<span className="text-sm">Admin</span>
					</a>
				)}
			</nav>
			<div className="mt-auto px-3 pb-4">
				<a
					href="https://help.lenci.app"
					className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
					aria-label="Help"
				>
					<HelpCircle size={16} />
					<span className="text-sm">Help</span>
				</a>
			</div>
		</aside>
	);
}

export default Sidebar;


