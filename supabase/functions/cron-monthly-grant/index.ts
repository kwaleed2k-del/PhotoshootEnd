import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const ADMIN_GRANT_URL = Deno.env.get('ADMIN_GRANT_URL')!;

function currentRiyadhYYYYMM(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}

Deno.serve(async () => {
	try {
		const period = currentRiyadhYYYYMM();
		const url = new URL(ADMIN_GRANT_URL);
		url.searchParams.set('period', period);

		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: {
				'x-cron-secret': CRON_SECRET
			}
		});
		const text = await response.text();
		return new Response(text, {
			status: response.status,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store'
			}
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
});


