import type { Workspace } from '../shared/workspace.ts';
import { ALL_SERVICES_IMAGE, WORKSPACE_IMAGE_PIXELS as SIZE } from '../shared/workspaceimages.ts';
import { WORKSPACE_ICON_NODES } from './workspaceIcons.ts';
import { initials } from './initials.ts';

const escape = (text: string) => text.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// WorkspaceAvatar's glyph on a tile of its hue, white on the darker shade, since a native menu's surface follows neither theme.
// The glyph is larger than on the rail: at the 16px a menu draws, the rail's proportion leaves it too small to tell apart.
function avatarSvg(workspace: Workspace): string {
	const glyph = Math.round(SIZE * 0.7);
	const offset = (SIZE - glyph) / 2;
	const drawing = workspace.icon
		? `<svg x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${
			WORKSPACE_ICON_NODES[workspace.icon].map(([tag, attributes]) =>
				`<${tag} ${Object.entries(attributes).map(([name, value]) => `${name}="${escape(String(value))}"`).join(' ')}/>`).join('')}</svg>`
		: `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.round(SIZE * 0.45)}" fill="#FFFFFF">${escape(initials(workspace.name))}</text>`;
	return `<rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.27}" fill="${token(`--rx-deep-hue-${workspace.hue}`)}"/>${drawing}`;
}

// The switcher's four squares, white on a grey tile as the workspaces' glyphs are on theirs.
function allServicesSvg(): string {
	const square = (x: number, y: number) => `<rect x="${x}" y="${y}" width="${SIZE * 0.22}" height="${SIZE * 0.22}" rx="${SIZE * 0.05}" fill="#FFFFFF"/>`;
	const [near, far] = [SIZE * 0.25, SIZE * 0.53];
	return `<rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.27}" fill="${token('--rx-deep-neutral')}"/>`
		+ square(near, near) + square(far, near) + square(near, far) + square(far, far);
}

async function png(drawing: string): Promise<string> {
	const image = new Image(SIZE, SIZE);
	image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${drawing}</svg>`);
	await image.decode();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	canvas.getContext('2d')?.drawImage(image, 0, 0);
	return canvas.toDataURL('image/png');
}

export async function workspaceImages(workspaces: readonly Workspace[]): Promise<Record<string, string>> {
	const drawn = await Promise.all(workspaces.map(async workspace => [workspace.id, await png(avatarSvg(workspace))] as const));
	return Object.fromEntries([...drawn, [ALL_SERVICES_IMAGE, await png(allServicesSvg())]]);
}
