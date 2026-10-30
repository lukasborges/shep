import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptWorkspaceImages } from '../../src/shared/workspaceimages.ts';

const png = 'data:image/png;base64,iVBORw0KGgo=';

test('takes a PNG for each workspace there is', () => {
	assert.deepEqual(acceptWorkspaceImages({ w1: png, w2: png }, ['w1', 'w2']), { w1: png, w2: png });
});

test('refuses what the interface sends for a workspace that is gone, or that is not a PNG', () => {
	assert.deepEqual(acceptWorkspaceImages({ gone: png, w1: 'data:image/svg+xml,<svg/>', w2: 42 }, ['w1', 'w2']), {});
	assert.deepEqual(acceptWorkspaceImages({ w1: png + 'A'.repeat(16 * 1024) }, ['w1']), {});
	assert.deepEqual(acceptWorkspaceImages('not a map', ['w1']), {});
	assert.deepEqual(acceptWorkspaceImages(null, ['w1']), {});
});
