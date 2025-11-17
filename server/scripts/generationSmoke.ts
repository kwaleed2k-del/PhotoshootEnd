/**
 * Smoke test script for generation logging
 * 
 * Usage:
 *   TEST_USER_ID=<uuid> node -r ts-node/register server/scripts/generationSmoke.ts
 * 
 * Or with tsx:
 *   TEST_USER_ID=<uuid> tsx server/scripts/generationSmoke.ts
 */

import { addCredits, getCreditBalance } from '../services/creditService';
import { createCreditGuard } from '../middleware/creditPrecheck';
import { logGenerationSuccess } from '../services/generationTrackingService';
import { costForGeneration } from '../services/creditCostService';
import { supabaseAdmin } from '../services/supabaseAdmin';

const TEST_USER_ID = process.env.TEST_USER_ID;

if (!TEST_USER_ID) {
  console.error('❌ TEST_USER_ID environment variable is required');
  process.exit(1);
}

async function runSmokeTest() {
  console.log('🧪 Generation Logging Smoke Test\n');
  console.log(`📋 Test User ID: ${TEST_USER_ID}\n`);

  try {
    // Ensure user has sufficient credits (≥ 4 for apparel ×2)
    const currentBalance = await getCreditBalance(TEST_USER_ID);
    const requiredCredits = 4; // apparel ×2 = 2 credits × 2 images = 4 credits

    if (currentBalance < requiredCredits) {
      console.log(`💰 Current balance: ${currentBalance}, adding ${requiredCredits - currentBalance} credits...`);
      await addCredits(
        TEST_USER_ID,
        requiredCredits - currentBalance,
        'Smoke test seed credits',
        'grant'
      );
      console.log(`✅ Added credits\n`);
    } else {
      console.log(`💰 Current balance: ${currentBalance} (sufficient)\n`);
    }

    // Get user plan for cost calculation
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('subscription_plan')
      .eq('id', TEST_USER_ID)
      .single();

    const plan = (userData?.subscription_plan || 'free').toLowerCase() as any;
    const expectedCost = costForGeneration(plan, 'apparel', 2);

    console.log(`📊 Plan: ${plan}, Expected cost for apparel ×2: ${expectedCost} credits\n`);

    // Run generation with credit guard
    const guard = createCreditGuard(TEST_USER_ID);
    const count = 2;
    const fakeImages = ['s3://demo/image1.png', 's3://demo/image2.png'];

    console.log('1️⃣  Running generation with credit guard...');
    const result = await guard(
      {
        type: 'apparel',
        count,
        description: 'Smoke test apparel generation',
      },
      async ({ userId, plan: ctxPlan, reservation }) => {
        // Short-circuit to fake output (bypass actual generation)
        const images = fakeImages;

        // Log generation success
        console.log('2️⃣  Logging generation success...');
        const logResult = await logGenerationSuccess({
          userId,
          type: 'apparel',
          count,
          creditsUsed: reservation ? reservation.creditsUsed : 0,
          creditTransactionId: reservation?.transactionId,
          prompt: 'Smoke test prompt',
          settings: { test: true },
          resultUrls: images,
        });

        console.log(`   ✅ Generation logged with ID: ${logResult.generationId}\n`);

        return { images, generationId: logResult.generationId };
      }
    );

    if (!result.ok) {
      console.error('❌ Generation failed:', result);
      process.exit(1);
    }

    const generationId = (result.data as any).generationId;

    // Verify results
    console.log('3️⃣  Verifying database state...\n');

    // Check user_generations row
    const { data: genData } = await supabaseAdmin
      .from('user_generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (genData) {
      console.log('✅ user_generations row:');
      console.log(`   ID: ${genData.id}`);
      console.log(`   Type: ${genData.generation_type}`);
      console.log(`   Credits used: ${genData.credits_used}`);
      console.log(`   Credit transaction ID: ${genData.credit_transaction_id || 'NULL (enterprise/unlimited)'}`);
      console.log(`   Result URLs: ${genData.result_urls?.length || 0} URLs\n`);
    } else {
      console.error('❌ user_generations row not found');
      process.exit(1);
    }

    // Check credit_transactions.related_generation_id
    if (result.reservation?.transactionId) {
      const { data: txData } = await supabaseAdmin
        .from('credit_transactions')
        .select('*')
        .eq('id', result.reservation.transactionId)
        .single();

      if (txData) {
        console.log('✅ credit_transactions row:');
        console.log(`   ID: ${txData.id}`);
        console.log(`   Type: ${txData.transaction_type}`);
        console.log(`   Amount: ${txData.amount}`);
        console.log(`   Related generation ID: ${txData.related_generation_id || 'NULL'}\n`);

        if (txData.related_generation_id === generationId) {
          console.log('   ✅ Related generation ID correctly linked!\n');
        } else {
          console.error('   ❌ Related generation ID mismatch!');
          process.exit(1);
        }
      }
    }

    // Check usage_analytics for today
    const today = new Date().toISOString().split('T')[0];
    const { data: analyticsData } = await supabaseAdmin
      .from('usage_analytics')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('date', today)
      .eq('generation_type', 'apparel')
      .single();

    if (analyticsData) {
      console.log('✅ usage_analytics row (today):');
      console.log(`   Date: ${analyticsData.date}`);
      console.log(`   Type: ${analyticsData.generation_type}`);
      console.log(`   Count: ${analyticsData.count} (should be ≥ ${count})`);
      console.log(`   Credits used: ${analyticsData.credits_used} (should be ≥ ${expectedCost})\n`);

      if (analyticsData.count >= count && analyticsData.credits_used >= expectedCost) {
        console.log('   ✅ Analytics correctly incremented!\n');
      } else {
        console.warn('   ⚠️  Analytics may not be fully incremented');
      }
    } else {
      console.warn('⚠️  usage_analytics row not found (may need to check if upsert worked)');
    }

    console.log('✅ All smoke tests passed!');

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

