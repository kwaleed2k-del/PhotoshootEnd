// Usage: ts-node scripts/dev/smokeCredits.ts <user-id>
import { getBalance, grant, consume } from '../../src/server/services/creditService';

const userId = process.argv[2];
if (!userId) {
	console.error('Usage: ts-node scripts/dev/smokeCredits.ts <user-id>');
	process.exit(2);
}

(async () => {
	console.log('balance@start', await getBalance(userId));
	console.log('after grant 5 =>', await grant(userId, 5, 'dev_grant', { env: 'dev' }));
	console.log('after consume 2 =>', await consume(userId, 2, 'dev_consume', { env: 'dev' }));
})().catch((e) => {
	console.error(e);
	process.exit(1);
});


