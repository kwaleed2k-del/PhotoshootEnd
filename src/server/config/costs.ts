export const COSTS = {
	'image.generate': 2,
	'text.generate': 1
} as const;

export type EventType = keyof typeof COSTS;

export function costOf(event: EventType): number {
	return COSTS[event];
}


