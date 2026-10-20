import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasOwnSession, ownPartition, onlyServiceInSessionOrOnOrigin, SHARED_PARTITION, type ServiceRecord } from '../../src/shared/service.ts';

const service = (id: string, url: string, partition: string) => ({ id, url, partition }) as ServiceRecord;

const gmail = service('1', 'https://mail.google.com/mail/', SHARED_PARTITION);
const chat = service('2', 'https://chat.google.com/', SHARED_PARTITION);
const secondGmail = service('3', 'https://mail.google.com/mail/u/1/', ownPartition('3'));
const imported = service('4', 'https://web.whatsapp.com/', 'persist:whatsapp_4');

test('keeps a service in the shared session unless it has one of its own, as a second account does, or one the Ext app named persist:<type>_<id>', () => {
	assert.equal(hasOwnSession(gmail), false);
	assert.equal(hasOwnSession(secondGmail), true);
	assert.equal(hasOwnSession(imported), true);
});

test('takes a request with no page, a service worker\'s, to the one service in its session, from whatever origin', () => {
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, secondGmail], ownPartition('3'), 'https://accounts.google.com'), secondGmail);
});

test('tells the services of the shared session apart by the origin a request with no page comes from', () => {
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat, secondGmail], SHARED_PARTITION, 'https://chat.google.com'), chat);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat, secondGmail], SHARED_PARTITION, 'https://mail.google.com/'), gmail);
});

test('takes a request to no service when the origin does not tell the services apart', () => {
	const otherGmail = service('5', 'https://mail.google.com/mail/u/2/', SHARED_PARTITION);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, otherGmail], SHARED_PARTITION, 'https://mail.google.com'), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat], SHARED_PARTITION, 'https://drive.google.com'), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail, chat], SHARED_PARTITION, ''), undefined);
	assert.equal(onlyServiceInSessionOrOnOrigin([gmail], ownPartition('1'), 'https://mail.google.com'), undefined);
});
