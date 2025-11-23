export function formatMoney(amountInMinor: number, currency = 'SAR'): string {
	const safeAmount = typeof amountInMinor === 'number' ? amountInMinor : 0;
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
	}).format(safeAmount / 100);
}


