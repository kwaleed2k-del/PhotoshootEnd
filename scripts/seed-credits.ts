/**
 * Seed Credits Script
 * 
 * Seeds test credits for a QA user using service role RPCs.
 * 
 * Usage:
 *   QA_USER_ID=<uuid> tsx scripts/seed-credits.ts
 * 
 * Or with npm:
 *   QA_USER_ID=<uuid> npm run qa:seed-credits
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let userId = process.env.QA_USER_ID;
const userEmail = process.env.QA_USER_EMAIL;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Note: If QA_USER_ID is not provided, we will try to resolve it from QA_USER_EMAIL

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function callRPC(name: string, args: any) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw new Error(`${name}: ${error.message} (code: ${error.code || 'unknown'})`);
  }
  return data;
}

async function main() {
  console.log('💰 Seeding credits for test user...');

  // Resolve userId via email if needed
  if (!userId) {
    if (!userEmail) {
      console.error('❌ Missing QA_USER_ID and QA_USER_EMAIL environment variables');
      console.error('   Provide QA_USER_ID, or set QA_USER_EMAIL to look up the user by email.');
      process.exit(1);
    }
    console.log(`   Resolving user ID for email: ${userEmail}`);
    const { data: foundUser, error: findErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();
    if (findErr || !foundUser?.id) {
      console.error(`❌ Could not find user by email (${userEmail}): ${findErr?.message || 'not found'}`);
      process.exit(1);
    }
    userId = foundUser.id as string;
  }

  console.log(`   User ID: ${userId}\n`);

  try {
    // Get current balance
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits_balance, email')
      .eq('id', userId)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    console.log(`   Current balance: ${userData.credits_balance} credits`);
    console.log(`   User email: ${userData.email}\n`);

    // Add credits (grant)
    console.log('1️⃣  Adding 200 credits (grant)...');
    const grantResult = await callRPC('fn_add_credits', {
      p_user_id: userId,
      p_amount: 200,
      p_description: 'QA seed grant',
      p_tx_type: 'grant',
    });
    const grantRow = Array.isArray(grantResult) ? grantResult[0] : grantResult;
    console.log(`   ✅ Added 200 credits`);
    console.log(`   Transaction ID: ${grantRow?.transaction_id ?? 'unknown'}`);
    console.log(`   Balance after: ${grantRow?.balance_after ?? 'unknown'} credits\n`);

    // Deduct credits (usage)
    console.log('2️⃣  Deducting 35 credits (usage)...');
    const deductResult = await callRPC('fn_deduct_credits', {
      p_user_id: userId,
      p_amount: 35,
      p_description: 'QA simulated generation',
    });
    const deductRow = Array.isArray(deductResult) ? deductResult[0] : deductResult;
    console.log(`   ✅ Deducted 35 credits`);
    console.log(`   Transaction ID: ${deductRow?.transaction_id ?? 'unknown'}`);
    console.log(`   Balance after: ${deductRow?.balance_after ?? 'unknown'} credits\n`);

    // Get final balance
    const { data: finalUserData } = await supabase
      .from('users')
      .select('credits_balance')
      .eq('id', userId)
      .single();

    console.log('✅ Credits seeded successfully!');
    console.log(`   Final balance: ${finalUserData?.credits_balance ?? 'unknown'} credits`);

    // Show the last 2 transactions for visibility
    const { data: tx } = await supabase
      .from('credit_transactions')
      .select('created_at, transaction_type, amount, balance_after, description')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2);
    if (tx?.length) {
      console.log('\nRecent transactions:');
      for (const t of tx) {
        console.log(`   - ${t.created_at}  ${t.transaction_type}  ${t.amount}  → ${t.balance_after}  (${t.description || ''})`);
      }
    }
    console.log(`\n💡 You can now login as ${userData.email} and view the credit history at /billing`);

  } catch (error: any) {
    console.error('\n❌ Failed to seed credits:');
    console.error(`   Error: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

