import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenWorkspacesMenu, workspaceTabMenu, type WorkspaceMenuItem, type WorkspaceTabActions } from '../../src/main/workspacemenu.ts';
import { en } from '../../src/shared/i18n/en.ts';

const noop = () => {};
const actions: WorkspaceTabActions = { create: noop, rename: noop, changeIcon: noop, remove: noop };
const workspaces = [{ id: 'w1', name: 'Work', hue: 'blue' as const }, { id: 'w2', name: 'Personal', hue: 'green' as const }, { id: 'w3', name: 'Family', hue: 'red' as const }];
const describe = (items: WorkspaceMenuItem[]) => items.map(item => item.type === 'separator' ? '---' : `${item.label}${item.accelerator ? ' ' + item.accelerator : ''}`);

test('offers on a workspace\'s tab what can be done to it, keeping Delete apart at the end', () => {
	assert.deepEqual(describe(workspaceTabMenu('w2', actions, en)), ['Rename…', 'Change Icon…', '---', 'New Workspace…', '---', 'Delete']);
});

test('offers only a new workspace on the All Services tab, which is not a workspace', () => {
	assert.deepEqual(describe(workspaceTabMenu(null, actions, en)), ['New Workspace…']);
});

test('acts on the workspace whose tab was clicked', () => {
	const renamed: string[] = [];
	const removed: string[] = [];
	const items = workspaceTabMenu('w2', { ...actions, rename: id => renamed.push(id), remove: id => removed.push(id) }, en);
	items.find(item => item.label === 'Rename…')?.click?.();
	items.find(item => item.label === 'Delete')?.click?.();
	assert.deepEqual([renamed, removed], [['w2'], ['w2']]);
});

test('lists the workspaces whose tabs did not fit, in order, each with its own shortcut and what it has unread', () => {
	const unread = { w1: 0, w2: '•', w3: 12 } as const;
	const items = hiddenWorkspacesMenu(workspaces, ['w3', 'w2'], id => unread[id as keyof typeof unread], noop);
	assert.deepEqual(describe(items), ['Personal (•) CommandOrControl+Alt+2', 'Family (12) CommandOrControl+Alt+3']);
});

test('puts the workspace on screen when its item is picked, with its image beside its name', () => {
	const chosen: string[] = [];
	const items = hiddenWorkspacesMenu(workspaces, ['w2'], () => 0, id => chosen.push(id), id => `image of ${id}`);
	assert.equal(items[0]?.icon, 'image of w2');
	items[0]?.click?.();
	assert.deepEqual(chosen, ['w2']);
});
