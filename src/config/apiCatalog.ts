export const API_UI_MAP: Record<string, { label: string; href: string }> = {
	'/api/credit-packages': { label: 'Credits page', href: '/billing/credits' },
	'/api/checkout/credits': { label: 'Credits checkout', href: '/billing/credits' },
	'/api/billing/invoices': { label: 'Invoices page', href: '/billing/invoices' },
	'/api/billing/balance': { label: 'Dashboard credits', href: '/dashboard' },
	'/api/admin/low-credit/logs': { label: 'Admin: low-credit logs', href: '/admin' },
	'/api/users/me': { label: 'Settings', href: '/settings' }
};

export const API_FALLBACK_LIST = [
	'/api/credit-packages',
	'/api/checkout/credits',
	'/api/billing/invoices',
	'/api/billing/balance',
	'/api/admin/low-credit/logs',
	'/api/users/me'
];

