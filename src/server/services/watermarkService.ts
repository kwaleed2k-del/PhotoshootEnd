/**
 * Image watermark helper (server-only). Uses sharp if available; otherwise no-op.
 */
import type { Buffer as PngBuffer } from 'buffer';

export type { PngBuffer };

export interface WatermarkOptions {
	text?: string;
	opacity?: number;
	scale?: number;
	tile?: boolean;
}

let sharp: any = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	sharp = require('sharp');
} catch {
	sharp = null;
}

export function canWatermark(): boolean {
	return !!sharp;
}

export async function applyWatermarkIfRequired(
	buffer: PngBuffer,
	required: boolean,
	opts: WatermarkOptions = {}
): Promise<PngBuffer> {
	if (!required || !sharp) {
		return buffer;
	}

	const text = opts.text ?? 'SIYADA • DEMO';
	const opacity = Math.min(1, Math.max(0, opts.opacity ?? 0.25));
	const scale = opts.scale ?? 1;
	const tile = opts.tile ?? true;

	const base = sharp(buffer).png();
	const metadata = await base.metadata();
	const width = metadata.width ?? 1024;
	const height = metadata.height ?? 1024;
	const w = Math.max(512, Math.floor(width * 0.6 * scale));
	const h = Math.max(128, Math.floor(height * 0.18 * scale));

	const fontSize = Math.floor(h * 0.5);

	const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" patternUnits="userSpaceOnUse" width="${w}" height="${h}">
      <g transform="rotate(-30 ${w / 2} ${h / 2})" opacity="${opacity}">
        <rect width="${w}" height="${h}" fill="white" opacity="0"/>
        <text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="${fontSize}" fill="white" stroke="black" stroke-width="2" text-anchor="middle" dominant-baseline="middle">
          ${text}
        </text>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;

	const overlay = Buffer.from(svg);
	return await base.composite([{ input: overlay, gravity: 'center', tile }]).png().toBuffer();
}


