/**
 * Credit utility functions
 */

/**
 * Check if credit balance is low (below threshold)
 * @param balance Credit balance to check
 * @returns true if balance is below 10 credits
 */
export const isLowCredit = (balance: number): boolean => {
  return balance < 10;
};

