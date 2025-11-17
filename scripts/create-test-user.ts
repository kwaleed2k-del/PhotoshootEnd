/**
 * Create Test User Script
 * 
 * Creates a test user for QA purposes using service role.
 * 
 * Usage:
 *   QA_USER_EMAIL=qa1@siyada.local QA_USER_PASSWORD=StrongPass!123 tsx scripts/create-test-user.ts
 * 
 * Or with npm:
 *   QA_USER_EMAIL=qa1@siyada.local QA_USER_PASSWORD=StrongPass!123 npm run qa:create-user
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userEmail = process.env.QA_USER_EMAIL || 'qa1@siyada.local';
const userPassword = process.env.QA_USER_PASSWORD || 'StrongPass!123';
const userName = process.env.QA_USER_NAME || 'QA One';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🔧 Creating test user...');
  console.log(`   Email: ${userEmail}`);
  console.log(`   Name: ${userName}\n`);

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { name: userName },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('User creation succeeded but no user data returned');
    }

    console.log('✅ Test user created successfully!');
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Email: ${data.user.email}`);
    console.log(`\n💡 Set this in your .env:`);
    console.log(`   QA_USER_ID=${data.user.id}`);
    console.log(`\n💡 Login credentials:`);
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: ${userPassword}`);

    // Verify public.users row was created (should happen via trigger)
    const { data: publicUser, error: publicUserError } = await supabase
      .from('users')
      .select('id, email, subscription_plan, credits_balance')
      .eq('id', data.user.id)
      .single();

    if (publicUserError) {
      console.warn(`\n⚠️  Warning: Could not verify public.users row: ${publicUserError.message}`);
      console.warn('   The trigger may not have fired. Check Migration 1.12 is applied.');
    } else if (publicUser) {
      console.log(`\n✅ Verified: public.users row exists`);
      console.log(`   Plan: ${publicUser.subscription_plan}`);
      console.log(`   Credits: ${publicUser.credits_balance}`);
    }

  } catch (error: any) {
    console.error('\n❌ Failed to create test user:');
    console.error(`   Error: ${error.message}`);
    if (error.status) {
      console.error(`   Status: ${error.status}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

