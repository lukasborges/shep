export function withoutAppTokens(userAgent: string): string {
	return userAgent.replace(/\s(Tesselium|Electron)\/\S+/g, '');
}
