// Usage: ts-node scripts/dev/smokeUsage.ts <user-id>
import { recordUsageEvent, newRequestId } from '../../src/server/services/usageService';

(async () => {
	const userId = process.argv[2];
	if (!userId) {
		console.error('Usage: ts-node scripts/dev/smokeUsage.ts <user-id>');
		process.exit(2);
	}
	const reqId = newRequestId();
	console.log('first call:', await recordUsageEvent({
		userId,
		eventType: 'image.generate',
		cost: 2,
		tokens: 123,
		requestId: reqId,
		metadata: { env: 'dev' }
	}));
	console.log('duplicate call:', await recordUsageEvent({
		userId,
		eventType: 'image.generate',
		cost: 2,
		tokens: 123,
		requestId: reqId,
		metadata: { env: 'dev' }
	}));
})().catch((e) => {
	console.error(e);
	process.exit(1);
});


