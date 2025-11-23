export const STUDIOS_PRICING = {
	product: { base: 5, per_image: 3, per_variation: 2 },
	apparel: { base: 6, per_image: 4, per_variation: 2 }
} as const;

export const STUDIOS_TEMPLATES = {
	product: [
		{ id: 'clean-ecom', name: 'Clean E-com', description: 'Shadow, soft light, catalog-ready' },
		{ id: 'lifestyle', name: 'Lifestyle', description: 'Natural scenes, props' }
	],
	apparel: [
		{ id: 'on-model', name: 'On-Model', description: 'Human model composites' },
		{ id: 'ghost-mannequin', name: 'Ghost Mannequin', description: 'Flat or 3D look' }
	]
} as const;


