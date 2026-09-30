export type WindowOpenKind = 'blank' | 'popup' | 'window' | 'browser' | 'external' | 'drop';

const BLANK = ['about:blank', 'about:blank#blocked'];
const HANDED_TO_THE_SYSTEM = ['mailto:', 'tel:'];

export function isBlank(url: string): boolean {
	return BLANK.includes(url);
}

function parseFeatureBoolean(value: string): boolean {
	if ( value === '' || value === 'yes' || value === 'true' ) return true;
	const number = parseInt(value, 10);
	return !Number.isNaN(number) && number !== 0;
}

// https://html.spec.whatwg.org/multipage/nav-history-apis.html#popup-window-is-requested
export function isPopupRequested(features: string | undefined): boolean {
	if ( !features ) return false;
	const tokens = new Map<string, string>();
	for ( const pair of features.split(/[\s,]+/) ) {
		if ( !pair ) continue;
		const [key = '', value = ''] = pair.split('=');
		const name = key.trim().toLowerCase();
		if ( name === 'noopener' || name === 'noreferrer' ) continue;
		tokens.set(name, value.trim().toLowerCase());
	}
	if ( tokens.size === 0 ) return false;

	const feature = (name: string, fallback: boolean) => tokens.has(name) ? parseFeatureBoolean(tokens.get(name) ?? '') : fallback;
	if ( tokens.has('popup') ) return feature('popup', false);
	if ( feature('location', false) && feature('toolbar', false) ) return false;
	if ( feature('menubar', false) ) return false;
	if ( !feature('resizable', true) ) return true;
	if ( feature('scrollbars', false) ) return false;
	if ( feature('status', false) ) return false;
	return true;
}

// Ctrl+click, ⌘+click on a Mac and the middle button, also when the page's own script opens the link.
// Ctrl+Shift+click is left out: Chromium reports it as a plain click on a target="_blank" link.
const OPENED_IN_A_BACKGROUND_TAB = 'background-tab';

export const CLICK_OPENS_A_LINK_WITHIN_MS = 2000;

export interface HeldModifiers {
	control: boolean;
	meta: boolean;
}

// Meet opens its chat's links a while after the click, and by then Chromium no longer ties the window to the Ctrl held for it.
// Mouse events arrive without their modifiers, so the key held is read from the keyboard's own events.
export function createModifiedClickWatch(platform: NodeJS.Platform, now: () => number = Date.now) {
	let modifierHeld = false;
	let modifiedClickAt = -Infinity;
	return {
		keyboard(input: HeldModifiers): void {
			modifierHeld = platform === 'darwin' ? input.meta : input.control;
		},
		// the focus leaving takes the key's release with it
		focusLost(): void {
			modifierHeld = false;
		},
		mouseDown(button: string): void {
			modifiedClickAt = modifierHeld || button === 'middle' ? now() : -Infinity;
		},
		// a click opens one link, so the first window asked for after it takes it
		takeModifiedClick(): boolean {
			const follows = now() - modifiedClickAt <= CLICK_OPENS_A_LINK_WITHIN_MS;
			modifiedClickAt = -Infinity;
			return follows;
		}
	};
}

export function classifyWindowOpen(url: string, features: string | undefined, disposition?: string, followsModifiedClick = false): WindowOpenKind {
	if ( isBlank(url) ) return 'blank';

	let target: URL;
	try {
		target = new URL(url);
	} catch {
		return 'drop';
	}
	if ( HANDED_TO_THE_SYSTEM.includes(target.protocol) ) return 'external';
	if ( target.protocol !== 'http:' && target.protocol !== 'https:' ) return 'drop';

	if ( isPopupRequested(features) ) return 'popup';
	return disposition === OPENED_IN_A_BACKGROUND_TAB || followsModifiedClick ? 'browser' : 'window';
}

function originOf(url: string): string | null {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

// serviceUrls: the page the service is on, and the address it was added with. A service signed out
// can sit on another site, as chat.google.com sits on workspace.google.com, and its sign-in ends at its own address.
export function isReturnToService(serviceUrls: readonly string[], fromUrl: string, toUrl: string): boolean {
	const isOpaqueOrUnparsable = (origin: string | null) => !origin || origin === 'null';
	const services = serviceUrls.map(originOf).filter(origin => !isOpaqueOrUnparsable(origin));
	const from = originOf(fromUrl);
	if ( !services.length || isOpaqueOrUnparsable(from) ) return false;
	return services.includes(originOf(toUrl)) && !services.includes(from);
}

export function serviceOwningLink<T extends { id: string; url: string }>(services: readonly T[], openerId: string, url: string): T | null {
	const target = originOf(url);
	if ( !target || target === 'null' ) return null;
	const onTheSite = services.filter(service => originOf(service.url) === target);
	// a link to the opener's own site is the opener's, and two services there, two accounts of one mail, cannot say which is meant
	if ( onTheSite.some(service => service.id === openerId) || onTheSite.length !== 1 ) return null;
	return onTheSite[0] ?? null;
}
