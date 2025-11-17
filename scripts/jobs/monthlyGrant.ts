// Usage: tsx scripts/jobs/monthlyGrant.ts [--period=YYYY-MM] [--limit=1000] [--dry]
import { runMonthlyGrantForAllUsers } from '../../src/server/services/monthlyGrantService';

interface Args {
	period?: string;
	limit?: number;
	dryRun?: boolean;
}

function parseArgs(): Args {
	const args: Args = { dryRun: false };
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith('--period=')) {
			args.period = arg.split('=')[1];
		} else if (arg.startsWith('--limit=')) {
			const value = Number(arg.split('=')[1]);
			if (!Number.isNaN(value)) args.limit = value;
		} else if (arg === '--dry') {
			args.dryRun = true;
		}
	}
	return args;
}

(async () => {
	const args = parseArgs();
	const results = await runMonthlyGrantForAllUsers(args);
	const summary = results.reduce(
		(acc, r) => {
			acc.total += 1;
			if (r.granted) acc.granted += 1;
			else acc.skipped += 1;
			return acc;
		},
		{ total: 0, granted: 0, skipped: 0 }
	);
	console.table(results);
	console.log('Summary:', summary);
})().catch((err) => {
	console.error(err);
	process.exit(1);
});


