import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTabs, type FittingTab } from '../../src/shared/tabs.ts';

const tab = (named: number, { selected = false, hideable = true } = {}): FittingTab => ({ named, icon: 30, selected, hideable });
const OVERFLOW = 40;
const selectedWork = tab(100, { selected: true });
const personal = tab(100);
const family = tab(100);
const reading = tab(100);
const allServices = tab(150, { hideable: false });
const tabs = [selectedWork, personal, family, allServices];

test('names every tab when there is room for all of them', () => {
	assert.deepEqual(fitTabs(tabs, 450, OVERFLOW), ['named', 'named', 'named', 'named']);
});

test('takes the names away one tab at a time from the right, All Services first', () => {
	assert.deepEqual(fitTabs(tabs, 420, OVERFLOW), ['named', 'named', 'named', 'icon']);
	assert.deepEqual(fitTabs(tabs, 300, OVERFLOW), ['named', 'named', 'icon', 'icon']);
	assert.deepEqual(fitTabs(tabs, 190, OVERFLOW), ['named', 'icon', 'icon', 'icon']);
});

test('hides tabs from the right only once every other tab is down to its icon, never the selected one or All Services', () => {
	assert.deepEqual(fitTabs(tabs, 189, OVERFLOW), ['named', 'hidden', 'hidden', 'icon']);
	const five = [selectedWork, personal, family, reading, allServices];
	assert.deepEqual(fitTabs(five, 215, OVERFLOW), ['named', 'icon', 'hidden', 'hidden', 'icon']);
	assert.deepEqual(fitTabs(five, 0, OVERFLOW), ['named', 'hidden', 'hidden', 'hidden', 'icon']);
});

test('keeps the selected tab named wherever it is', () => {
	const lastSelected = [personal, family, tab(100, { selected: true })];
	assert.deepEqual(fitTabs(lastSelected, 200, OVERFLOW), ['icon', 'icon', 'named']);
});
