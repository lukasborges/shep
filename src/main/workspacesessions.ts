import { existsSync } from 'node:fs';
import { cp, rename, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { app } from 'electron';
import { isCacheChromiumRebuilds, partitionOf, signInsToCarryOver, type ServiceSavedWithASessionOfItsChoosing } from '../shared/service.ts';
import { newWorkspace } from '../shared/workspace.ts';
import { store } from './store.ts';
import { mainMessages } from './messages.ts';

const folderOf = (partition: string) => join(app.getPath('userData'), 'Partitions', partition.replace(/^persist:/, ''));

const savedServices = (): ServiceSavedWithASessionOfItsChoosing[] => store.get('services');

export function savedServicesNeedSettling(): boolean {
	return savedServices().some(service => !service.workspace || service.partition);
}

export async function settleSavedServicesIntoWorkspaces(): Promise<void> {
	placeServicesInNoWorkspace();
	const services = savedServices();
	const { copies, unused } = signInsToCarryOver(services);
	for ( const { from, to } of copies ) await copyWholeOrNotAtAll(folderOf(from), folderOf(to));
	store.set('sessionsLeftBehind', [...new Set([...store.get('sessionsLeftBehind'), ...unused])]);
	store.set('services', services.map(service => {
		const kept = { ...service };
		delete kept.partition;
		return kept;
	}));
}

export async function letGoOfSessionsLeftBehind(): Promise<void> {
	for ( const partition of store.get('sessionsLeftBehind') ) await rm(folderOf(partition), { recursive: true, force: true }).catch(() => {});
	store.set('sessionsLeftBehind', store.get('sessionsLeftBehind').filter(partition => existsSync(folderOf(partition))));
}

function placeServicesInNoWorkspace(): void {
	const saved = savedServices();
	if ( !saved.some(service => !service.workspace) ) return;
	const home = newWorkspace(mainMessages()['dialog.workspace.first']);
	store.set('workspaces', [...store.get('workspaces'), home]);
	store.set('services', saved.map(service => ({
		...service,
		partition: service.partition ?? partitionOf(service),
		workspace: service.workspace || home.id
	})));
}

async function copyWholeOrNotAtAll(from: string, to: string): Promise<void> {
	if ( !existsSync(from) || existsSync(to) ) return;
	const unfinished = to + '.migrating';
	await rm(unfinished, { recursive: true, force: true });
	await cp(from, unfinished, { recursive: true, filter: source => !isCacheChromiumRebuilds(relative(from, source)) });
	await rename(unfinished, to);
}
