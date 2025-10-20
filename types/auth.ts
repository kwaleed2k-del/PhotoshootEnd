export type UserPlan = 'solo' | 'studio' | 'brand';

export interface User {
  id: string;
  email: string;
  plan: UserPlan;
  generationsUsed: number;
}