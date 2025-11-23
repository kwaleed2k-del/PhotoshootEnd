import { NextResponse } from 'next/server';

type RenderBody = {
	html?: string;
	data?: Record<string, unknown>;
};

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as RenderBody;
		const html = body.html ?? '<p>No HTML provided.</p>';
		const rendered = interpolate(html, body.data ?? {});
		return NextResponse.json({ html: rendered });
	} catch (error) {
		return NextResponse.json({ html: '<p>Render failed.</p>', error: String(error) }, { status: 500 });
	}
}

function interpolate(template: string, data: Record<string, unknown>): string {
	return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
		const value = key.split('.').reduce<unknown>((acc, segment) => {
			if (acc && typeof acc === 'object') {
				return (acc as Record<string, unknown>)[segment];
			}
			return undefined;
		}, data);
		return value === undefined ? '' : String(value);
	});
}


