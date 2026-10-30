import { folded } from './text.ts';

export const NAVIGATIONS = ['back', 'forward', 'reload', 'home'] as const;
export type Navigation = (typeof NAVIGATIONS)[number];

// '•' is a title saying there is something without saying how much.
export type UnreadCount = number | '•';

export function unreadWithNotification(fromTitle: UnreadCount, notifiedSinceSeen: boolean): UnreadCount {
	return notifiedSinceSeen && fromTitle !== '•' && fromTitle <= 0 ? '•' : fromTitle;
}

export const SHARED_PARTITION = 'persist:shared';

export const workspacePartition = (workspace: string) => workspace ? `persist:workspace-${workspace}` : SHARED_PARTITION;

export const partitionOf = (service: Pick<ServiceRecord, 'workspace'>) => workspacePartition(service.workspace);

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
	const inSession = services.filter(service => partitionOf(service) === partition);
	if ( inSession.length === 1 ) return inSession[0];
	const asking = originOf(origin);
	const onOrigin = inSession.filter(service => asking !== null && originOf(service.url) === asking);
	return onOrigin.length === 1 ? onOrigin[0] : undefined;
}

export interface ServiceRecord {
	id: string;
	name: string;
	url: string;
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
	notifiedSinceSeen: boolean;
	pageTitle: string;
	active: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	zoomLevel: number;
	loading: boolean;
	workspace: string;
	shown: boolean;
}

export type ServiceSavedWithASessionOfItsChoosing = ServiceRecord & { partition?: string };

export interface SignInCarryOver {
	copies: { from: string; to: string }[];
	unused: string[];
}

export function signInsToCarryOver(services: readonly ServiceSavedWithASessionOfItsChoosing[]): SignInCarryOver {
	const chosen = (service: ServiceSavedWithASessionOfItsChoosing) => service.partition ?? SHARED_PARTITION;
	const workspaces = [...new Set(services.map(service => service.workspace).filter(Boolean))];
	const copies = workspaces.map(workspace => {
		const used = new Set(services.filter(service => service.workspace === workspace).map(chosen));
		const [only] = used;
		return { from: used.size === 1 && only ? only : SHARED_PARTITION, to: workspacePartition(workspace) };
	}).filter(({ from, to }) => from !== to);
	const unused = [...new Set(services.map(chosen))].filter(partition => !services.some(service => partitionOf(service) === partition));
	return { copies, unused };
}

const CACHES_CHROMIUM_REBUILDS = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'GraphiteDawnCache', 'ShaderCache']);

export function isCacheChromiumRebuilds(pathInSession: string): boolean {
	const [top] = pathInSession.split(/[/\\]/);
	return top !== undefined && CACHES_CHROMIUM_REBUILDS.has(top);
}
