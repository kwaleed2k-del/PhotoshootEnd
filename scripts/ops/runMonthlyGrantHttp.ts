// Usage: tsx scripts/ops/runMonthlyGrantHttp.ts 2025-11 --dry
const [, , periodArg = '', dryArg = ''] = process.argv;
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_GRANT_URL = process.env.ADMIN_GRANT_URL;

if (!CRON_SECRET || !ADMIN_GRANT_URL) {
	console.error('Missing CRON_SECRET or ADMIN_GRANT_URL');
	process.exit(1);
}

const params = new URLSearchParams();
if (periodArg) params.set('period', periodArg);
if (dryArg) params.set('dry', '1');

const url = `${ADMIN_GRANT_URL}?${params.toString()}`;

fetch(url, {
	method: 'POST',
	headers: { 'x-cron-secret': CRON_SECRET }
})
	.then(async (response) => {
		const text = await response.text();
		console.log(response.status, text);
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

