import React from 'react';

export function ApiKeyUsageNote() {
	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-300 space-y-3">
			<p className="font-semibold text-white">API usage example</p>
			<p className="text-xs text-zinc-400">Call our API with your key:</p>
			<pre className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white overflow-auto">
				curl -H "Authorization: Bearer &lt;YOUR_KEY&gt;" https://your.app/api/external/ping
			</pre>
		</div>
	);
}


