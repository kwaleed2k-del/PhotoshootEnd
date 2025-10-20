import type { UserPlan } from '../types';

export type Feature = 
  | 'batchProcessing' 
  | 'packshotMode' 
  | 'postProductionSuite' // Main toggle for color grade, realism boost, etc.
  | 'generativeEdit' // Specific toggle for the editor
  | 'videoGeneration'
  | 'imagenGeneration'; // New permission for Imagen-powered features

export const PLAN_DETAILS: Record<UserPlan, { generations: number; name: string; }> = {
    solo: { generations: 200, name: 'Solo Creator' },
    studio: { generations: 600, name: 'Studio' },
    brand: { generations: 2500, name: 'Brand' },
};

const PLAN_PERMISSIONS: Record<UserPlan, Feature[]> = {
    solo: [
        // Solo has core features, but none of the advanced ones.
    ],
    studio: [
        'packshotMode',
        'postProductionSuite',
        'generativeEdit',
        'videoGeneration',
        'imagenGeneration',
    ],
    brand: [
        'batchProcessing',
        'packshotMode',
        'postProductionSuite',
        'generativeEdit',
        'videoGeneration',
        'imagenGeneration',
    ],
};

export const hasPermission = (plan: UserPlan, feature: Feature): boolean => {
    // Higher plans inherit permissions from lower plans, but defining explicitly is safer.
    return PLAN_PERMISSIONS[plan].includes(feature);
};

export const getRequiredPlan = (feature: Feature): UserPlan | null => {
    // This function helps in creating informative tooltips.
    if (PLAN_PERMISSIONS.solo.includes(feature)) return 'solo';
    if (PLAN_PERMISSIONS.studio.includes(feature)) return 'studio';
    if (PLAN_PERMISSIONS.brand.includes(feature)) return 'brand';
    return null;
}