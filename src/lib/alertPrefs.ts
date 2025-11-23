const THRESHOLD_KEY = 'pref:low_credit_threshold';
const SNOOZE_KEY = 'pref:low_credit_snooze_until';

export const LOW_CREDIT_THRESHOLD_KEY = THRESHOLD_KEY;
export const LOW_CREDIT_SNOOZE_UNTIL = SNOOZE_KEY;

export function getThreshold(): number {
	if (typeof window === 'undefined') return 50;
	const raw = window.localStorage.getItem(THRESHOLD_KEY);
	const value = raw ? Number(raw) : 50;
	return Number.isFinite(value) ? value : 50;
}

export function setThreshold(value: number): void {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(THRESHOLD_KEY, String(value));
}

export function getSnoozeUntil(): Date | null {
	if (typeof window === 'undefined') return null;
	const raw = window.localStorage.getItem(SNOOZE_KEY);
	if (!raw) return null;
	const date = new Date(raw);
	return Number.isNaN(date.valueOf()) ? null : date;
}

export function snooze(hours: number): void {
	if (typeof window === 'undefined') return;
	const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
	window.localStorage.setItem(SNOOZE_KEY, until);
}

export function clearSnooze(): void {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(SNOOZE_KEY);
}


