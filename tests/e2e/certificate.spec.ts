import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { launchTesselium, closeTesselium, serviceRecord, type Tesselium } from './helpers/launch.ts';

let server: Server;
let url: string;
let keys: string;

test.beforeAll(async () => {
	keys = mkdtempSync(join(tmpdir(), 'tesselium-cert-'));
	execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
		'-keyout', join(keys, 'key.pem'), '-out', join(keys, 'cert.pem')], { stdio: 'ignore' });
	server = createServer({ key: readFileSync(join(keys, 'key.pem')), cert: readFileSync(join(keys, 'cert.pem')) },
		(request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<title>Self-signed</title>'); });
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	url = `https://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(() => {
	server.close();
	rmSync(keys, { recursive: true, force: true });
});

const titleOf = (tesselium: Tesselium) => tesselium.window.evaluate(async () =>
	(await window.tesselium.invoke('services:list') as { pageTitle: string }[])[0]?.pageTitle ?? '');

test('refuses a certificate nobody trusted, and tells the window', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium();
		// added once the window listens, or the warning can come before anyone hears it
		const told = tesselium.window.evaluate(address => new Promise(resolve => {
			window.tesselium.on('services:certificate-error', value => { resolve(value); });
			window.tesselium.invoke('services:add', address, 'Self-signed service', '');
		}), url);
		const warnedAbout = await told;
		const [added] = await tesselium.window.evaluate(() => window.tesselium.invoke('services:list')) as { id: string }[];
		expect(warnedAbout).toBe(added?.id);
		await new Promise(resolve => setTimeout(resolve, 500));
		expect(await titleOf(tesselium)).not.toBe('Self-signed');
	} finally {
		await closeTesselium(tesselium);
	}
});

test('loads a service whose certificate was trusted', async () => {
	let tesselium: Tesselium | undefined;
	try {
		tesselium = await launchTesselium({ store: { services: [serviceRecord('1', url, { trust: true })], activeServiceId: '1' } });
		await expect.poll(() => titleOf(tesselium as Tesselium)).toBe('Self-signed');
	} finally {
		await closeTesselium(tesselium);
	}
});
