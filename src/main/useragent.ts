export function withoutAppTokens(userAgent: string): string {
	return userAgent.replace(/\s(Tessely|Electron)\/\S+/g, '');
}
