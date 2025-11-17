/**
 * Credit Cost Configuration
 * 
 * Defines base credit costs per generation type and plan-specific overrides.
 * Aligns with PRD: Apparel (2), Product (1), Video (5) credits per unit.
 */

export const BASE_CREDIT_COSTS = {
  apparel: 2,      // per image
  product: 1,      // per image
  video: 5,        // per video
} as const;

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type GenerationType = 'apparel' | 'product' | 'video';

/**
 * Plan-specific cost rule allowing overrides and multipliers
 */
export interface PlanCostRule {
  // Override per generation type (optional)
  overrides?: Partial<Record<GenerationType, number>>;
  // Multiplier applied after override/base (optional)
  multiplier?: number; // e.g., 1 = no change
  // Set to true if this plan skips credit checks (enterprise)
  unlimited?: boolean;
}

/**
 * Plan-specific cost rules
 * Enterprise plan has unlimited credits per PRD
 */
export const PLAN_COST_RULES: Record<PlanTier, PlanCostRule> = {
  free: { multiplier: 1 },
  starter: { multiplier: 1 },
  professional: { multiplier: 1 },
  enterprise: { unlimited: true }, // PRD: unlimited credits
};

/**
 * Computes the credit cost for a generation request.
 * 
 * @param plan      The user's plan tier
 * @param type      'apparel' | 'product' | 'video'
 * @param count     Number of images (for apparel/product); for video use 1
 * @returns total credits required (integer), or 0 if unlimited
 * @throws Error if generation type is unknown
 */
export function computeCreditCost(
  plan: PlanTier,
  type: GenerationType,
  count: number
): number {
  // Enforce minimum count
  if (count < 1) {
    throw new Error(`Count must be at least 1, got ${count}`);
  }

  // Enterprise plan: unlimited credits
  const rule = PLAN_COST_RULES[plan];
  if (rule.unlimited) {
    return 0;
  }

  // Get base cost for generation type
  const baseCost = BASE_CREDIT_COSTS[type];
  if (baseCost === undefined) {
    throw new Error(`Unknown generation type: ${type}`);
  }

  // Apply plan-specific override if present
  const overrideCost = rule.overrides?.[type];
  const unitCost = overrideCost ?? baseCost;

  // Apply multiplier if present
  const multiplier = rule.multiplier ?? 1;
  const costPerUnit = unitCost * multiplier;

  // Multiply by count and round to integer
  return Math.round(costPerUnit * count);
}

