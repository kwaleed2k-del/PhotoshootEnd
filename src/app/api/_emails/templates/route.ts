import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { EmailTemplate } from '@/lib/types.email';

const TEMPLATE_DIRS = [path.join(process.cwd(), 'src', 'emails'), path.join(process.cwd(), 'emails')];
const ALLOWED_EXT = ['.html', '.mjml'];

export async function GET() {
	for (const dir of TEMPLATE_DIRS) {
		try {
			const stats = await fs.stat(dir);
			if (!stats.isDirectory()) continue;
			const templates = await readDirTemplates(dir);
			return NextResponse.json({ items: templates });
		} catch {
			continue;
		}
	}

	return NextResponse.json({ items: [] });
}

async function readDirTemplates(dir: string): Promise<EmailTemplate[]> {
	const entries = await fs.readdir(dir);
	const templates: EmailTemplate[] = [];

	for (const entry of entries) {
		const ext = path.extname(entry);
		if (!ALLOWED_EXT.includes(ext)) continue;
		const id = entry.replace(ext, '');
		templates.push({
			id,
			name: id,
			path: path.join(dir, entry),
			engine: ext === '.mjml' ? 'mjml' : 'html'
		});
	}

	return templates;
}


