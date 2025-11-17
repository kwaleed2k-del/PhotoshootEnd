type PlanCheckoutCode = 'starter' | 'professional';

function defaultReturnUrl() {
	if (typeof window === 'undefined') return '';
	return `${window.location.origin}/billing`;
}

async function postJson(path: string, body: Record<string, unknown>) {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Request failed: ${response.status}`);
	}
	return (await response.json()) as { url: string };
}

export async function startCheckout(planCode: PlanCheckoutCode): Promise<void> {
	const url = defaultReturnUrl();
	const data = await postJson('/api/stripe/checkout', {
		planCode,
		successUrl: url,
		cancelUrl: url
	});
	if (!data.url) {
		throw new Error('Missing checkout URL');
	}
	window.location.href = data.url;
}

export async function openPortal(): Promise<void> {
	const url = defaultReturnUrl();
	const data = await postJson('/api/stripe/portal', {
		returnUrl: url
	});
	if (!data.url) {
		throw new Error('Missing portal URL');
	}
	window.location.href = data.url;
}


