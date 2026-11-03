// Imported before anything else in main: the store opens its file as soon as it is imported,
// so the profile's name and folder have to be settled first.
import { copyFileSync, existsSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { productName, build } from '../../package.json';

// The app was Shep until 1.6.4 and Tessely in 1.7, newest first: the folder and settings file each name left behind.
const EARLIER_NAMES = [
	{ folder: 'Tessely', settings: 'tessely.json' },
	{ folder: 'Shep', settings: 'shep.json' }
];

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

// What Windows files the taskbar button and every notification under. The installer's shortcut
// carries the same id, and without it a notification comes from electron.app.Tesselium and shows no name.
// Still Shep's id, not a new one: the installer upgrades the app with the same id, and Windows keeps its pins and notification settings.
if ( process.platform === 'win32' ) app.setAppUserModelId(build.appId);

const hasOwnUserData = process.argv.some(argument => argument.startsWith('--user-data-dir'));

// A run from the repository never opens the installed app's profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Tesselium-dev'));

function moveEarlierFolder(): void {
	const folder = app.getPath('userData');
	if ( existsSync(join(folder, 'tesselium.json')) ) return;
	const earlierFolder = EARLIER_NAMES.map(name => join(app.getPath('appData'), name.folder)).find(existsSync);
	if ( !earlierFolder ) return;
	try {
		// Electron may have made it already, empty, and renameSync will not write over a folder on Windows.
		if ( existsSync(folder) ) rmdirSync(folder);
		renameSync(earlierFolder, folder);
	} catch {
		// An earlier version still running holds the folder: this start opens it where it lies, and the next one moves it.
		app.setPath('userData', earlierFolder);
	}
}

if ( app.isPackaged && !hasOwnUserData ) moveEarlierFolder();

const settings = join(app.getPath('userData'), 'tesselium.json');
const earlierSettings = EARLIER_NAMES.map(name => join(app.getPath('userData'), name.settings)).find(existsSync);
// Copied, not moved: an earlier version still running may be sharing this folder and keep saving to its own file.
if ( earlierSettings && !existsSync(settings) ) copyFileSync(earlierSettings, settings);
