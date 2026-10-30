import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { partitionOf, signInsToCarryOver, type ServiceSavedWithASessionOfItsChoosing } from '../shared/service.ts';
import { newWorkspace } from '../shared/workspace.ts';
import { store } from './store.ts';
import { mainMessages } from './messages.ts';

const folderOf = (partition: string) => join(app.getPath('userData'), 'Partitions', partition.replace(/^persist:/, ''));

export function settleSavedServicesIntoWorkspaces(): void {
	const saved: ServiceSavedWithASessionOfItsChoosing[] = store.get('services');
	const unplaced = saved.some(service => !service.workspace);
	if ( !unplaced && !saved.some(service => service.partition) ) return;

	const home = unplaced ? newWorkspace(mainMessages()['dialog.workspace.first']) : null;
	if ( home ) store.set('workspaces', [...store.get('workspaces'), home]);
	const placed = saved.map(service => ({
		...service,
		partition: service.partition ?? partitionOf(service),
		workspace: service.workspace || home?.id || ''
	}));

	const { copies, unused } = signInsToCarryOver(placed);
	for ( const { from, to } of copies ) {
		if ( existsSync(folderOf(from)) && !existsSync(folderOf(to)) ) cpSync(folderOf(from), folderOf(to), { recursive: true });
	}
	for ( const partition of unused ) rmSync(folderOf(partition), { recursive: true, force: true });
	store.set('services', placed.map(service => {
		const kept: ServiceSavedWithASessionOfItsChoosing = { ...service };
		delete kept.partition;
		return kept;
	}));
}
