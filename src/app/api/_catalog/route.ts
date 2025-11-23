import { promises as fs } from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { API_FALLBACK_LIST } from '@/config/apiCatalog';
import type { ApiCatalogEntry } from '@/lib/types.console';

const API_ROOTS = [path.join(process.cwd(), 'src', 'app', 'api'), path.join(process.cwd(), 'app', 'api')];

export async function GET(_req: Request, res: Response) {
	try {
		const entries = await discoverApiEntries();
		return res.json({ items: entries });
	} catch (error) {
		console.error('[api-catalog] discovery failed', error);
		const fallback: ApiCatalogEntry[] = API_FALLBACK_LIST.map((p) => ({ path: p }));
		return res.json({ items: fallback });
	}
}

async function discoverApiEntries(): Promise<ApiCatalogEntry[]> {
	for (const root of API_ROOTS) {
		try {
			const stats = await fs.stat(root);
			if (!stats.isDirectory()) {
				continue;
			}
			const files = await walkRoutes(root);
			return files;
		} catch {
			// try next root
		}
	}
	throw new Error('API directory not found');
}

async function walkRoutes(root: string): Promise<ApiCatalogEntry[]> {
	const entries: ApiCatalogEntry[] = [];

	async function walk(current: string) {
		const dirents = await fs.readdir(current, { withFileTypes: true });
		for (const dirent of dirents) {
			const fullPath = path.join(current, dirent.name);
			if (dirent.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			if (dirent.isFile() && dirent.name === 'route.ts') {
				const relative = path.relative(root, fullPath);
				const routePath = formatRoutePath(relative);
				if (routePath === '/api/_catalog') continue;
				const methods = await detectMethods(fullPath);
				entries.push({ path: routePath, methods: methods.length ? methods : undefined });
			}
		}
	}

	await walk(root);
	return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function formatRoutePath(relativeFilePath: string): string {
	const dir = path.dirname(relativeFilePath);
	const normalized = dir.split(path.sep).join('/');
	return `/api/${normalized}`;
}

async function detectMethods(filePath: string): Promise<string[]> {
	try {
		const content = await fs.readFile(filePath, 'utf8');
		const methods: string[] = [];
		['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'HEAD'].forEach((method) => {
			if (content.includes(`export async function ${method}`)) {
				methods.push(method);
			}
		});
		return methods;
	} catch {
		return [];
	}
}


