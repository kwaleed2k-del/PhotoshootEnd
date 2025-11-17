/**
 * Smoke test script for credit ledger operations
 * 
 * Usage:
 *   TEST_USER_ID=<uuid> node -r ts-node/register server/scripts/creditSmoke.ts
 * 
 * Or with tsx:
 *   TEST_USER_ID=<uuid> tsx server/scripts/creditSmoke.ts
 */

import {
  getCreditBalance,
  getCreditHistory,
  addCredits,
  deductCredits,
  refundCredits
} from '../services/creditService';

const TEST_USER_ID = process.env.TEST_USER_ID;

if (!TEST_USER_ID) {
  console.error('❌ TEST_USER_ID environment variable is required');
  process.exit(1);
}

async function runSmokeTest() {
  console.log('🧪 Starting credit ledger smoke test...\n');
  console.log(`📋 Test User ID: ${TEST_USER_ID}\n`);

  try {
    // Get initial balance
    const initialBalance = await getCreditBalance(TEST_USER_ID);
    console.log(`💰 Initial balance: ${initialBalance} credits\n`);

    // Test 1: Add credits (grant)
    console.log('1️⃣  Testing addCredits (grant +10)...');
    const addResult = await addCredits(
      TEST_USER_ID,
      10,
      'seed grant',
      'grant'
    );
    console.log(`   ✅ Added 10 credits`);
    console.log(`   Transaction ID: ${addResult.transactionId}`);
    console.log(`   New balance: ${addResult.balanceAfter} credits\n`);

    // Test 2: Deduct credits (usage)
    console.log('2️⃣  Testing deductCredits (usage -2)...');
    const deductResult = await deductCredits(
      TEST_USER_ID,
      2,
      'apparel single'
    );
    console.log(`   ✅ Deducted 2 credits`);
    console.log(`   Transaction ID: ${deductResult.transactionId}`);
    console.log(`   New balance: ${deductResult.balanceAfter} credits\n`);

    // Test 3: Refund credits
    console.log('3️⃣  Testing refundCredits...');
    const refundResult = await refundCredits(
      TEST_USER_ID,
      deductResult.transactionId,
      'oops'
    );
    console.log(`   ✅ Refunded 2 credits`);
    console.log(`   Refund Transaction ID: ${refundResult.transactionId}`);
    console.log(`   New balance: ${refundResult.balanceAfter} credits\n`);

    // Get final balance
    const finalBalance = await getCreditBalance(TEST_USER_ID);
    console.log(`💰 Final balance: ${finalBalance} credits`);
    console.log(`📊 Net change: ${finalBalance - initialBalance} credits\n`);

    // Get transaction history
    console.log('📜 Last 3 credit transactions:');
    const history = await getCreditHistory(TEST_USER_ID, 3);
    history.forEach((tx, idx) => {
      console.log(`   ${idx + 1}. [${tx.transaction_type}] ${tx.amount > 0 ? '+' : ''}${tx.amount} - ${tx.description || 'N/A'}`);
      console.log(`      Balance after: ${tx.balance_after} | Created: ${new Date(tx.created_at).toISOString()}`);
    });

    console.log('\n✅ All smoke tests passed!');

  } catch (error: any) {
    console.error('\n❌ Smoke test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Run the smoke test
runSmokeTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

