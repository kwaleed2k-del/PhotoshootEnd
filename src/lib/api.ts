export async function jfetch<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
	const response = await fetch(input, {
		credentials: 'include',
		...init
	});

	if (!response.ok) {
		let message = `Request failed with status ${response.status}`;
		try {
			const data = await response.json();
			if (data?.error) {
				message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
			}
		} catch {
			// ignore json parse errors
		}
		throw new Error(message);
	}

	return (await response.json()) as T;
}


