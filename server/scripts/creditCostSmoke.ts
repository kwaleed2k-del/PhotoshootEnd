/**
 * Smoke test script for credit cost configuration
 * 
 * Usage:
 *   node -r ts-node/register server/scripts/creditCostSmoke.ts
 * 
 * Or with tsx:
 *   tsx server/scripts/creditCostSmoke.ts
 */

import { computeCreditCost, PlanTier, GenerationType } from '../../src/constants/creditCosts';

const plans: PlanTier[] = ['free', 'starter', 'professional', 'enterprise'];

interface TestCase {
  type: GenerationType;
  count: number;
  label: string;
}

const testCases: TestCase[] = [
  { type: 'apparel', count: 1, label: 'apparel ×1' },
  { type: 'apparel', count: 3, label: 'apparel ×3' },
  { type: 'product', count: 1, label: 'product ×1' },
  { type: 'product', count: 4, label: 'product ×4' },
  { type: 'video', count: 1, label: 'video ×1' },
];

function runSmokeTest() {
  console.log('🧪 Credit Cost Configuration Smoke Test\n');
  const separator = '='.repeat(60);
  console.log(separator);
  console.log('Plan Cost Matrix');
  console.log(separator);
  console.log();

  // Print header
  const header = ['Plan', ...testCases.map(tc => tc.label)].join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length));

  // Print costs for each plan
  for (const plan of plans) {
    const costs = testCases.map(tc => {
      const cost = computeCreditCost(plan, tc.type, tc.count);
      return cost === 0 ? '0 (unlimited)' : cost.toString();
    });
    const row = [plan.padEnd(12), ...costs].join(' | ');
    console.log(row);
  }

  console.log();
  console.log(separator);
  console.log('✅ Smoke test complete');
  console.log();
  console.log('Expected behavior:');
  console.log('  - free/starter/professional: base costs × count');
  console.log('  - enterprise: all costs = 0 (unlimited)');
  console.log();
}

// Run the smoke test
try {
  runSmokeTest();
} catch (error: any) {
  console.error('❌ Smoke test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}

