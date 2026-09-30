import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWindowOpen, CLICK_OPENS_A_LINK_WITHIN_MS, createModifiedClickWatch, isPopupRequested, isReturnToService, serviceOwningLink } from '../../src/main/links.ts';

test('a link to any site opens in an auxiliary window, not the browser', () => {
	assert.equal(classifyWindowOpen('https://example.com/article', ''), 'window');
	assert.equal(classifyWindowOpen('https://mail.google.com/mail/u/0/#inbox/1', ''), 'window');
});

test('a link opened with Ctrl, ⌘ or the middle button goes to the browser', () => {
	assert.equal(classifyWindowOpen('https://example.com/article', '', 'background-tab'), 'browser');
	assert.equal(classifyWindowOpen('https://example.com/article', '', 'foreground-tab'), 'window');
	assert.equal(classifyWindowOpen('https://example.com/article', '', 'new-window'), 'window');
});

test('a link a page opens a while after a Ctrl+click goes to the browser too', () => {
	assert.equal(classifyWindowOpen('https://example.com/article', '', 'foreground-tab', true), 'browser');
	assert.equal(classifyWindowOpen('https://accounts.google.com/o/oauth2/auth', 'width=500,height=600', 'foreground-tab', true), 'popup');
});

const watching = (platform: NodeJS.Platform) => {
	let time = 0;
	const watch = createModifiedClickWatch(platform, () => time);
	return { watch, wait: (ms: number) => { time += ms; } };
};
const held = (control: boolean, meta = false) => ({ control, meta });

test('remembers a click made with Ctrl held, for as long as a page takes to open its link', () => {
	const { watch, wait } = watching('linux');
	watch.keyboard(held(true));
	watch.mouseDown('left');
	watch.keyboard(held(false));
	wait(CLICK_OPENS_A_LINK_WITHIN_MS);
	assert.equal(watch.takeModifiedClick(), true);
});

test('forgets a Ctrl+click it waited on too long', () => {
	const { watch, wait } = watching('linux');
	watch.keyboard(held(true));
	watch.mouseDown('left');
	wait(CLICK_OPENS_A_LINK_WITHIN_MS + 1);
	assert.equal(watch.takeModifiedClick(), false);
});

test('sends one link to the browser for each Ctrl+click, and the next window the page opens stays in the app', () => {
	const { watch } = watching('linux');
	watch.keyboard(held(true));
	watch.mouseDown('left');
	assert.equal(watch.takeModifiedClick(), true);
	assert.equal(watch.takeModifiedClick(), false);
});

test('forgets a Ctrl+click as soon as a plain click follows it', () => {
	const { watch } = watching('linux');
	watch.keyboard(held(true));
	watch.mouseDown('left');
	watch.keyboard(held(false));
	watch.mouseDown('left');
	assert.equal(watch.takeModifiedClick(), false);
});

test('counts the middle button, and Command rather than Control on a Mac', () => {
	const linux = watching('linux').watch;
	linux.mouseDown('middle');
	assert.equal(linux.takeModifiedClick(), true);
	const mac = watching('darwin').watch;
	mac.keyboard(held(true));
	mac.mouseDown('left');
	assert.equal(mac.takeModifiedClick(), false);
	mac.keyboard(held(false, true));
	mac.mouseDown('left');
	assert.equal(mac.takeModifiedClick(), true);
});

test('lets go of a Ctrl whose release the page never saw, because the focus left', () => {
	const { watch } = watching('linux');
	watch.keyboard(held(true));
	watch.focusLost();
	watch.mouseDown('left');
	assert.equal(watch.takeModifiedClick(), false);
});

test('a popup opened with Ctrl stays a popup, since its opener waits on it', () => {
	assert.equal(classifyWindowOpen('https://accounts.google.com/o/oauth2/auth', 'width=500,height=600', 'background-tab'), 'popup');
	assert.equal(classifyWindowOpen('about:blank', '', 'background-tab'), 'blank');
	assert.equal(classifyWindowOpen('slack://channel?team=T1', '', 'background-tab'), 'drop');
});

test('a sized window.open stays a popup, which an OAuth opener waits on', () => {
	assert.equal(classifyWindowOpen('https://accounts.google.com/o/oauth2/auth', 'width=500,height=600'), 'popup');
	assert.equal(classifyWindowOpen('https://login.example.org/realms/acme/protocol/openid-connect/auth', 'popup'), 'popup');
});

test('about:blank is left for the page to fill', () => {
	assert.equal(classifyWindowOpen('about:blank', ''), 'blank');
	assert.equal(classifyWindowOpen('about:blank#blocked', 'width=800'), 'blank');
});

test('mail and phone links go to the system, and deep links into native apps are dropped', () => {
	assert.equal(classifyWindowOpen('mailto:someone@example.com', ''), 'external');
	assert.equal(classifyWindowOpen('tel:+5511999999999', ''), 'external');
	assert.equal(classifyWindowOpen('slack://channel?team=T1', ''), 'drop');
	assert.equal(classifyWindowOpen('not a url', ''), 'drop');
});

test('a bare window.open is not a popup, and a sized one is', () => {
	assert.equal(isPopupRequested(''), false);
	assert.equal(isPopupRequested(undefined), false);
	assert.equal(isPopupRequested('width=800,height=600'), true);
	assert.equal(isPopupRequested('left=0, top=0'), true);
});

test('noopener says nothing about the window, and the popup feature decides on its own', () => {
	assert.equal(isPopupRequested('noopener'), false);
	assert.equal(isPopupRequested('noopener,width=800'), true);
	assert.equal(isPopupRequested('popup'), true);
	assert.equal(isPopupRequested('popup=0,width=800'), false);
});

test('asking for browser chrome asks for a tab', () => {
	assert.equal(isPopupRequested('location,toolbar'), false);
	assert.equal(isPopupRequested('menubar=yes'), false);
	assert.equal(isPopupRequested('resizable=no,menubar=yes'), false);
});

test('a sign-in that left the service and comes back returns to the service', () => {
	assert.equal(isReturnToService(['https://acme.slack.com/'], 'https://acme.okta.com/login', 'https://acme.slack.com/sso/saml?code=1'), true);
	assert.equal(isReturnToService(['https://mail.google.com/mail/u/0/'], 'https://accounts.google.com/v3/signin/identifier', 'https://mail.google.com/mail/u/0/'), true);
});

test('a window that never left the service, or goes elsewhere, is not a return', () => {
	assert.equal(isReturnToService(['https://mail.google.com/mail/u/0/'], 'https://mail.google.com/mail/u/0/?view=pt', 'https://mail.google.com/mail/u/0/?view=pt&search=1'), false);
	assert.equal(isReturnToService(['https://mail.google.com/mail/u/0/'], 'https://docs.google.com/document/d/1', 'https://docs.google.com/document/d/1/edit'), false);
});

test('a blank window the page fills has not left the service', () => {
	assert.equal(isReturnToService(['https://mail.google.com/mail/u/0/'], 'about:blank', 'https://mail.google.com/mail/u/0/?view=print'), false);
});

test('hands back a sign-in that ends at the address the service was added with, though its page sits elsewhere', () => {
	// signed out, chat.google.com shows Google's product page on workspace.google.com
	const service = ['https://workspace.google.com/products/chat/', 'https://chat.google.com/'];
	assert.equal(isReturnToService(service, 'https://accounts.google.com/v3/signin', 'https://chat.google.com/u/0/'), true);
	assert.equal(isReturnToService(service, 'https://chat.google.com/u/0/', 'https://chat.google.com/u/0/app'), false);
});

const calendar = { id: '1', url: 'https://calendar.google.com/calendar/u/0/r' };
const meet = { id: '2', url: 'https://meet.google.com/' };

test('a link to the site another service was added on opens in that service', () => {
	assert.equal(serviceOwningLink([calendar, meet], '1', 'https://meet.google.com/pbk-hzeu-ehu'), meet);
});

test('a link to no service\'s site, or to the opener\'s own, is not handed to a service', () => {
	assert.equal(serviceOwningLink([calendar, meet], '1', 'https://docs.google.com/document/d/1'), null);
	assert.equal(serviceOwningLink([calendar, meet], '2', 'https://meet.google.com/pbk-hzeu-ehu'), null);
	assert.equal(serviceOwningLink([calendar, meet], '1', 'not a url'), null);
});

test('two services on the link\'s site cannot say which account it is for', () => {
	const otherMeet = { id: '3', url: 'https://meet.google.com/?authuser=1' };
	assert.equal(serviceOwningLink([calendar, meet, otherMeet], '1', 'https://meet.google.com/pbk-hzeu-ehu'), null);
});
