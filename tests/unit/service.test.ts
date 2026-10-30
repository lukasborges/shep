import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCacheChromiumRebuilds, onlyServiceInSessionOrOnOrigin, pageTitleBesideName, partitionOf, signInsToCarryOver, SHARED_PARTITION, workspacePartition, type ServiceRecord, type ServiceSavedWithASessionOfItsChoosing } from '../../src/shared/service.ts';

const service = (id: string, url: string, workspace = '') => ({ id, url, workspace }) as ServiceRecord;
const saved = (id: string, workspace: string, partition?: string) => ({ ...service(id, 'https://example.com/', workspace), partition }) as ServiceSavedWithASessionOfItsChoosing;

const gmail = service('1', 'https://mail.google.com/mail/');
const chat = service('2', 'https://chat.google.com/');
const secondGmail = service('3', 'https://mail.google.com/mail/u/1/', 'w1');

test('signs the services of a workspace in together, apart from every other workspace, and the ones in no workspace into the shared session', () => {
	assert.equal(partitionOf(gmail), SHARED_PARTITION);
	assert.equal(partitionOf(chat), SHARED_PARTITION);
	assert.equal(partitionOf(secondGmail), 'persist:workspace-w1');
	assert.notEqual(workspacePartition('w1'), workspacePartition('w2'));
});

test('takes a request with no page, a service worker\'s, to the one service in its session, from whatever origin', () => {
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, secondGmail], workspacePartition('w1'), 'https://accounts.google.com'), secondGmail);
});

test('tells the services of the shared session apart by the origin a request with no page comes from', () => {
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat, secondGmail], SHARED_PARTITION, 'https://chat.google.com'), chat);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat, secondGmail], SHARED_PARTITION, 'https://mail.google.com/'), gmail);
});

test('takes a request to no service when the origin does not tell the services apart', () => {
	const otherGmail = service('5', 'https://mail.google.com/mail/u/2/');
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, otherGmail], SHARED_PARTITION, 'https://mail.google.com'), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat], SHARED_PARTITION, 'https://drive.google.com'), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat], SHARED_PARTITION, ''), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail], workspacePartition('w1'), 'https://mail.google.com'), undefined);
});

test('starts each workspace\'s session from the one its services shared before, the shared one when they used several, and leaves one already its own', () => {
	const { copies } = signInsToCarryOver([
		saved('1', 'w1', SHARED_PARTITION), saved('2', 'w1', SHARED_PARTITION),
		saved('3', 'w2', 'persist:service-3'),
		saved('4', 'w3', SHARED_PARTITION), saved('5', 'w3', 'persist:service-5'),
		saved('6', 'w4', 'persist:workspace-w4')
	]);
	assert.deepEqual(copies, [
		{ from: SHARED_PARTITION, to: 'persist:workspace-w1' },
		{ from: 'persist:service-3', to: 'persist:workspace-w2' },
		{ from: SHARED_PARTITION, to: 'persist:workspace-w3' }
	]);
});

test('lets go of every session a service signed in to before, once its workspace has a copy', () => {
	assert.deepEqual(signInsToCarryOver([saved('1', 'w1', SHARED_PARTITION), saved('2', 'w2', 'persist:service-2')]).unused, [SHARED_PARTITION, 'persist:service-2']);
	assert.deepEqual(signInsToCarryOver([saved('1', 'w1', SHARED_PARTITION), saved('2', 'w1', 'persist:whatsapp_2')]).unused, [SHARED_PARTITION, 'persist:whatsapp_2']);
	assert.deepEqual(signInsToCarryOver([saved('1', 'w1', 'persist:workspace-w1')]).unused, []);
});

test('leaves out of a session\'s copy only the caches Chromium fills again, keeping every sign-in and site\'s data', () => {
	assert.equal(isCacheChromiumRebuilds('Cache'), true);
	assert.equal(isCacheChromiumRebuilds('Cache/Cache_Data/data_0'), true);
	assert.equal(isCacheChromiumRebuilds('Code Cache\\js\\index'), true);
	assert.equal(isCacheChromiumRebuilds('GPUCache'), true);
	assert.equal(isCacheChromiumRebuilds(''), false);
	assert.equal(isCacheChromiumRebuilds('Network/Cookies'), false);
	assert.equal(isCacheChromiumRebuilds('IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb'), false);
	assert.equal(isCacheChromiumRebuilds('Service Worker/CacheStorage'), false);
});

test('shows the page title beside the name only when the name does not already say it, whatever the case or accents', () => {
	assert.equal(pageTitleBesideName('WhatsApp com título grandão', 'WhatsApp'), '');
	assert.equal(pageTitleBesideName('Agenda do time', 'agenda'), '');
	assert.equal(pageTitleBesideName('Calendário', 'Calendario'), '');
	assert.equal(pageTitleBesideName('Zap do trabalho', 'WhatsApp'), 'WhatsApp');
	assert.equal(pageTitleBesideName('Meet', 'Meet - Daily'), 'Meet - Daily');
});

test('leaves out the unread count a page puts before its title, which the rail already shows', () => {
	assert.equal(pageTitleBesideName('Mail', '(3) Inbox'), 'Inbox');
	assert.equal(pageTitleBesideName('WhatsApp', '(12) WhatsApp'), '');
});
