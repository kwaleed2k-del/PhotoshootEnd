export const SCOPES = {
	default: 'api.v1.default',
	generate: 'api.v1.generate',
	admin: 'api.v1.admin'
} as const;

export type Scope = typeof SCOPES[keyof typeof SCOPES];


