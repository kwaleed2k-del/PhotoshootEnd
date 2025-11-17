import { computeCreditCost, PlanTier, GenerationType } from '../../src/constants/creditCosts';

/**
 * Server-side wrapper for credit cost computation.
 * Normalizes invalid counts and logs warnings.
 */
export function costForGeneration(
  plan: PlanTier,
  type: GenerationType,
  count: number
): number {
  // Normalize invalid count to 1 and log warning
  if (count < 1 || !Number.isInteger(count)) {
    console.warn(
      `[creditCostService] Invalid count ${count} for ${type}, normalizing to 1`
    );
    count = 1;
  }

  return computeCreditCost(plan, type, count);
}

