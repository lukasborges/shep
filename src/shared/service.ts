import { folded } from './text.ts';

export const NAVIGATIONS = ['back', 'forward', 'reload', 'home'] as const;
export type Navigation = (typeof NAVIGATIONS)[number];

// '•' is a title saying there is something without saying how much.
export type UnreadCount = number | '•';

export const SHARED_PARTITION = 'persist:shared';

export const ownPartition = (id: string) => `persist:service-${id}`;

export const hasOwnSession = (record: Pick<ServiceRecord, 'partition'>) => record.partition !== SHARED_PARTITION;

const originOf = (address: string) => {
	try {
		return new URL(address).origin;
	} catch {
		return null;
	}
};

export function pageTitleBesideName(name: string, pageTitle: string): string {
	const withoutUnreadCount = pageTitle.replace(/^\s*\([^)]*\)\s*/, '');
	return folded(name).includes(folded(withoutUnreadCount)) ? '' : withoutUnreadCount;
}

export function onlyServiceInSessionOrOnOrigin(services: ServiceRecord[], partition: string, origin: string): ServiceRecord | undefined {
	const inSession = services.filter(service => service.partition === partition);
	if ( inSession.length === 1 ) return inSession[0];
	const asking = originOf(origin);
	const onOrigin = inSession.filter(service => asking !== null && originOf(service.url) === asking);
	return onOrigin.length === 1 ? onOrigin[0] : undefined;
}

export interface ServiceRecord {
	id: string;
	name: string;
	url: string;
	partition: string;
	workspace: string;
	enabled: boolean;
	notifications: boolean;
	muted: boolean;
	media: boolean;
	trust: boolean;
	zoomLevel: number;
	favicon: string;
}

export interface ServiceState {
	id: string;
	name: string;
	favicon: string;
	enabled: boolean;
	unread: UnreadCount;
	pageTitle: string;
	active: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	zoomLevel: number;
	loading: boolean;
	workspace: string;
	shown: boolean;
}
