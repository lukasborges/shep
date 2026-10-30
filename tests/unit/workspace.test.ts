import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isShownIn, reorderWorkspaces, unreadIn, workspaceForNumber, type Workspace } from '../../src/shared/workspace.ts';

const work: Workspace = { id: 'w1', name: 'Work', hue: 'blue' };
const home: Workspace = { id: 'w2', name: 'Personal', hue: 'green' };

test('shows a workspace\'s own services, and every service under All Services', () => {
	assert.equal(isShownIn('w1', 'w1'), true);
	assert.equal(isShownIn('w2', 'w1'), false);
	assert.equal(isShownIn('w2', null), true);
});

test('numbers the workspaces in order and gives All Services the number after the last', () => {
	assert.equal(workspaceForNumber(0, [work, home]), 'w1');
	assert.equal(workspaceForNumber(1, [work, home]), 'w2');
	assert.equal(workspaceForNumber(2, [work, home]), null);
	assert.equal(workspaceForNumber(3, [work, home]), undefined);
});

test('counts a workspace\'s own unread for its tab, leaving out the services in no workspace', () => {
	const services = [{ workspace: 'w1', unread: 3 }, { workspace: 'w1', unread: 2 }, { workspace: 'w2', unread: 4 }, { workspace: '', unread: 9 }];
	assert.equal(unreadIn(services, 'w1'), 5);
	assert.equal(unreadIn(services, 'w2'), 4);
	assert.equal(unreadIn(services, 'w3'), 0);
});

test('marks a workspace with only something uncounted with a dot, which a count outweighs', () => {
	assert.equal(unreadIn([{ workspace: 'w1', unread: '•' }, { workspace: 'w1', unread: 0 }], 'w1'), '•');
	assert.equal(unreadIn([{ workspace: 'w1', unread: '•' }, { workspace: 'w1', unread: 2 }], 'w1'), 2);
});

test('puts the workspaces in the order their tabs were dragged into, keeping any the order leaves out at the end', () => {
	const family: Workspace = { id: 'w3', name: 'Family', hue: 'red' };
	const names = (workspaces: Workspace[]) => workspaces.map(workspace => workspace.name);
	assert.deepEqual(names(reorderWorkspaces([work, home, family], ['w2', 'w1', 'w3'])), ['Personal', 'Work', 'Family']);
	assert.deepEqual(names(reorderWorkspaces([work, home, family], ['w3'])), ['Family', 'Work', 'Personal']);
	assert.deepEqual(names(reorderWorkspaces([work, home], ['gone', 'w2', 'w2'])), ['Personal', 'Work']);
});
