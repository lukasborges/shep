// Imported before anything else in main: the store opens its file as soon as it is imported,
// so the profile's name and folder have to be settled first.
import { copyFileSync, existsSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { productName, build } from '../../package.json';

// Run unpacked from out/main, Electron finds no package.json and calls itself Electron.
app.setName(productName);

// What Windows files the taskbar button and every notification under. The installer's shortcut
// carries the same id, and without it a notification comes from electron.app.Tessely and shows no name.
// Still Shep's id, not a Tessely one: the installer upgrades the app with the same id, and Windows keeps its pins and notification settings.
if ( process.platform === 'win32' ) app.setAppUserModelId(build.appId);

const hasOwnUserData = process.argv.some(argument => argument.startsWith('--user-data-dir'));

// A run from the repository never opens the installed app's profile.
if ( !app.isPackaged && !hasOwnUserData ) app.setPath('userData', join(app.getPath('appData'), 'Tessely-dev'));

function moveShepFolder(): void {
	const shepFolder = join(app.getPath('appData'), 'Shep');
	const folder = app.getPath('userData');
	if ( !existsSync(shepFolder) || existsSync(join(folder, 'tessely.json')) ) return;
	try {
		// Electron may have made it already, empty, and renameSync will not write over a folder on Windows.
		if ( existsSync(folder) ) rmdirSync(folder);
		renameSync(shepFolder, folder);
	} catch {
		// A Shep still running holds the folder: this start opens it where it lies, and the next one moves it.
		app.setPath('userData', shepFolder);
	}
}

if ( app.isPackaged && !hasOwnUserData ) moveShepFolder();

const shepSettings = join(app.getPath('userData'), 'shep.json');
const settings = join(app.getPath('userData'), 'tessely.json');
// Copied, not moved: a Shep still running may be sharing this folder and keep saving to shep.json.
if ( existsSync(shepSettings) && !existsSync(settings) ) copyFileSync(shepSettings, settings);
