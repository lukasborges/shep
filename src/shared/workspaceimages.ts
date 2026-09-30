// All Services is not a workspace, so its image goes under the id no workspace has.
export const ALL_SERVICES_IMAGE = '';
export const WORKSPACE_IMAGE_PIXELS = 32;
const WORKSPACE_IMAGE_BYTES_LIMIT = 16 * 1024;
const PNG_DATA_URL = 'data:image/png;base64,';

export function acceptWorkspaceImages(sent: unknown, workspaceIds: readonly string[]): Record<string, string> {
	if ( !sent || typeof sent !== 'object' ) return {};
	const known = new Set([...workspaceIds, ALL_SERVICES_IMAGE]);
	return Object.fromEntries(Object.entries(sent).filter(([id, image]) =>
		known.has(id) && typeof image === 'string' && image.startsWith(PNG_DATA_URL) && image.length <= WORKSPACE_IMAGE_BYTES_LIMIT));
}
