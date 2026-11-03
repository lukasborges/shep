import { app } from 'electron';
import AutoLaunch from 'auto-launch-patched';

// Electron's own setLoginItemSettings covers macOS and Windows only; on Linux this writes the autostart entry.
// An unpacked run leaves the desktop's login items alone.
export function startWithSystem(on: boolean, minimized: boolean): void {
	if ( !app.isPackaged ) return;
	// On Windows that is the Run key, pointing at the installed executable, and on a Mac a login item. The flag
	// is the one the Linux entry carries and no side reads: a minimized start comes from the preference.
	if ( process.platform !== 'linux' ) {
		app.setLoginItemSettings({ openAtLogin: on, args: minimized ? ['--hidden'] : [] });
		return;
	}
	const path = process.env.APPIMAGE ?? process.execPath;
	// Shep's entry, from before the rename, would start the old executable as well.
	new AutoLaunch({ name: 'Shep', path }).disable().catch(() => {});
	const launcher = new AutoLaunch({ name: 'Tessely', path, isHidden: minimized });
	(on ? launcher.enable() : launcher.disable()).catch(() => {});
}
