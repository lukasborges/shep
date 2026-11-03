<div align="center">
  <img src="./resources/Icon.png" width="128" alt="" />
  <h1>Shep</h1>
  <p>All your web apps in one window, with workspaces and unread counts.</p>
</div>

<p align="center">
  <img src="./resources/screenshots/shep-1.0-light.png" width="49%" alt="Shep with five services in the rail and GitHub open, light theme" />
  <img src="./resources/screenshots/shep-1.0-dark.png" width="49%" alt="The same window in the dark theme" />
</p>

<p align="center">
  <a href="https://github.com/lukasborges/shep/releases/latest"><strong>Download the latest release</strong></a><br />
  Linux · Windows · macOS · GPLv3
</p>

Shep puts the web apps you already use in the browser in one window, with a rail down the left, workspaces across the title bar, and unread counts on the icons. Each workspace keeps one session, so every service on it is already signed in. There is no account and no server. It runs on Linux, Windows and macOS, and is free and open source.

## Features

- **Anything with an address.** WhatsApp, Gmail, Slack, Teams, Claude, or any URL you type, all in the rail.
- **Workspaces.** Groups with their own sign-ins and unread counts, one on screen at a time.
- **Unread counts.** Taken from page titles or the badge a page sets, with dots when either signals activity without a number.
- **Links stay in the app.** They open signed in, in a window that shares the service's session.
- **One rule for every service.** No per-service code to go stale when a site changes.
- **No account and no server.** Free, open source, GPLv3.

### The rail

Press `+` and pick a service from the list, or type any address. The list covers 50+ common services, but it is only a shortcut: it fills in a name and a URL, and a service picked from it is treated exactly like one you typed.

The icon is the page's favicon, as the page itself shows it. A service that marks news by changing its favicon, like Google Chat, shows it in the rail that way.

Right-clicking a service in the rail offers reload, notifications, sound, disable, edit, move to a workspace, and remove.

### Workspaces

Services can be grouped into workspaces, one on screen at a time, each a tab in the title bar. The last tab, All Services, shows every service. Every service is in a workspace.

- The services out of sight keep running, counting and notifying. Each tab shows what its workspace has unread.
- Each workspace signs in on its own. A second account of a site goes in a workspace of its own, and a service moved to another workspace takes that workspace's sign-ins.
- The first workspace is created with the first service, under a name the add dialog suggests. Deleting a workspace deletes its services too, after a warning to move any worth keeping first.
- A tab is renamed in place with a double click or `F2`, reordered by dragging it, and given a service by dragging the service's icon onto it from the rail. Its right click changes its icon or deletes it.
- When the window is too narrow for every tab, the tabs lose their names one at a time from the right, and the last ones go behind a button that lists them.

### Unread counts

The count comes from the page title, the `(3)` that most web apps put in front of it, or from the badge a page sets for its app icon, which wins over the title while it shows something. Pages are told they run as an installed app, since some set their badge only then. A title or badge that signals activity without a number, such as `(•)`, draws a dot instead. A notification from a service out of sight puts a dot on its icon in the rail only, until the service is on screen.

### Links

A link to another site opens in a window of Shep's that shares the service's session, so it is already signed in. When a sign-in there finishes back on the service, the window closes and the service carries on. A link to the site of another service you added opens in that service instead, brought forward with its workspace.

To open a link in your browser, click it with `Ctrl` (`⌘` on a Mac) or the middle button, or pick Open Link in Browser from the right click.

### The title bar

The page in view is controlled from the title bar: back, forward, reload, home to the address it was added with, and find. Any zoom other than 100% shows there, and a click resets it. The address behind a link under the pointer appears there too. The window takes the page's title, which the taskbar and the window switcher show.

### Also included

- A do-not-disturb switch and a lock screen with a password.
- An icon in the system tray.
- Spell checking.
- Screen sharing through the system's own picker on Wayland and on macOS 15 and later, and through Shep's own everywhere else.
- An Unread Report, in Preferences › Advanced, for when a count looks wrong.
- English, Portuguese, Spanish, French, German, Italian, Russian, Japanese, Chinese and Korean.

## How it works

Nothing in Shep knows one site from another. Every service is a web address in a session, and every rule applies to all of them, so there are no per-service scripts to go stale when a site changes. The one exception is Google's sign-in: it turns away a browser that states its Chrome version, so the request that carries it leaves the version out.

Pages see the Chromium Shep is built on, with nothing of Shep or Electron in the user agent, which is what sign-ins and captchas check for.

## Install

Download the latest release from [Releases](https://github.com/lukasborges/shep/releases). It carries an AppImage, a deb and a tarball for x86-64 Linux, an installer and a zip for x86-64 Windows, and a disk image and a zip for Macs with Apple silicon or Intel. Shep updates itself from those releases on Linux and Windows; on a Mac, Check for Updates opens the latest release.

Windows 10 or 11 and macOS 13 Ventura or later are supported.

### Linux

The AppImage needs FUSE 2, which some distributions no longer install by default: `fuse-libs` on Fedora, `libfuse2t64` on Ubuntu 24.04 and later, `libfuse2` on Debian. Without it, run the AppImage with `--appimage-extract-and-run`.

### Windows

The installer writes to your own account, `%LOCALAPPDATA%\Programs\Shep`, and asks no administrator for anything; the zip is the same app with nothing to install.

### macOS

Download `Shep-<version>-mac-arm64.dmg` for a Mac with Apple silicon, `Shep-<version>-mac-x64.dmg` for one with Intel; the zips are the same app. Open the disk image and drag Shep to Applications.

### First launch on Windows and macOS

Neither the Windows nor the macOS build is code-signed, because a certificate costs money this app does not have.

On Windows, the first run meets SmartScreen: **More info**, then **Run anyway**. For the zip, ticking **Unblock** in the downloaded file's properties before extracting settles it for every file inside at once.

On a Mac, macOS refuses the first launch: open **System Settings › Privacy & Security** and choose **Open Anyway** beside Shep. That is also why a Mac does not update itself, since macOS installs updates only for a signed app.

Nothing about the download can change this, since the warning is about the missing signature rather than about what is installed.

## Upgrading

### From 1.5.1 or earlier

Up to 1.5.1 a service could sign in apart from the others; now each workspace signs in on its own. The first start after the update gives each workspace a copy of the session its services used, or of the shared one when they used more than one. Services that were in no workspace go into a new one, Personal. A service that signed in apart has to sign in again if it now shares a workspace with other services.

### From 0.10 or earlier

Shep 1.0 is a new app and starts from a clean profile. Services added in 0.10 have to be added again.

## Keyboard

| Keys | Action |
|---|---|
| `Ctrl+1` … `Ctrl+9` | The first nine services in the rail |
| `Ctrl+Tab`, `Ctrl+Shift+Tab` | The next and the previous service |
| `Ctrl+Alt+1` … `Ctrl+Alt+9` | A workspace by position; the key after the last opens All Services |
| `Alt+←`, `Alt+→` | Back and forward in the page |
| `Ctrl+R`, `F5` | Reload, and `Ctrl+Shift+R` without the cache |
| `Ctrl+F` | Find in page |
| `Ctrl+=`, `Ctrl+-`, `Ctrl+0` | Zoom in, out, back to actual size |
| `Ctrl+N` | Add a service |
| `Ctrl+,` | Preferences |
| `Ctrl+Shift+I` | Developer tools |
| `Alt+Shift+D` | Do not disturb |
| `Alt+Shift+L` | Lock |
| `F11` | Full screen |
| `Ctrl+Q` | Quit |

On a Mac, `⌘` takes the place of `Ctrl`, and `⌥` of `Alt`. The Mac has keys of its own: `⌘[` and `⌘]` go back and forward, `⌘⇧[` and `⌘⇧]` also switch services, as `⌃Tab` does, `⌥⌘I` opens the developer tools, and `⌃⌘F` is full screen. On Linux and Windows, `Esc` leaves full screen as well as `F11`.

## Privacy

- **Where your data lives.** There is no account and no server. Shep keeps your services, workspaces and preferences in `~/.config/Shep/shep.json`, on Windows `%APPDATA%\Shep\shep.json`, on a Mac `~/Library/Application Support/Shep/shep.json`, and the sessions under the same folder, one for each workspace.
- **Sessions.** The services in a workspace share its session, so a site you sign in to once is signed in for every service on it there. A second account of a site goes in a workspace of its own, and a service moved to another workspace takes that workspace's sign-ins. A session is deleted when its last service is removed.
- **What leaves your machine.** Shep sends nothing about you anywhere. It makes two requests of its own: the update check, to this repository's releases on GitHub, and the download of a spell-checking dictionary the first time a language needs one, which Chromium fetches from Google. What each service does is up to the service: Shep is a frame around its web app and does not look inside.
- **Permissions.** Camera, microphone and screen sharing are asked about once per service and the answer is remembered. Notifications follow the service's own switch, and a few that expose nothing, such as going full screen, are granted. Every other permission a page asks for is refused.
- **The lock.** The lock password is stored as a salted scrypt hash. The lock hides the window's contents; it does not encrypt the sessions on disk.

## Troubleshooting

- **A count looks wrong.** Preferences › Advanced › Unread Report shows what each service's title says and the count, taken from the title or from the badge the page set.
- **A site refuses a sign-in.** Check User agent in Preferences › Advanced and leave it empty. A custom one is refused by some logins, such as Cloudflare's.
- **The AppImage does not start.** It needs FUSE 2; see [Linux](#linux). Without it, run it with `--appimage-extract-and-run`.
- **The first launch is blocked.** See [First launch on Windows and macOS](#first-launch-on-windows-and-macos).
- **Ubuntu 24.04 aborts at start with a sandbox error.** The distribution keeps unprivileged user namespaces from Chromium's sandbox. Pass `--no-sandbox`; the Linux packaged builds do, and a run from the repository needs the flag too.

## Development

Node 22 or later and npm.

```bash
npm install
npm start               # the app, with the interface reloading as you edit
npm test                # typecheck, lint, build, unit tests, then the end-to-end suite
npm run package         # the packages for the system you are on, into dist/
```

`npm run package` builds what that system can build: on Linux the AppImage, the deb and the tarball, on Windows the installer and the zip, on a Mac the disk image and the zip. None builds another's.

A run from the repository uses its own profile, `~/.config/Shep-dev`, on Windows `%APPDATA%\Shep-dev`, and never touches the installed app's.

The end-to-end suite launches the real app, so it opens windows. On Linux, with `xvfb-run` installed, it opens them on a virtual display instead of your desktop; one test also needs `xdotool`, and skips itself where there is none. On Fedora that is `dnf install xorg-x11-server-Xvfb xdotool`. Windows and macOS have no such thing, so the windows open on your desktop and take the focus while the suite runs. `npm run test:network` adds the tests that load real sites, such as the one that renders a Cloudflare captcha.

## Support

Bugs and feature requests go to [Issues](https://github.com/lukasborges/shep/issues), or Preferences › Advanced › Report an Issue. Say what happened, on which distribution and desktop, and, for a service that misbehaves, which address you added.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before sending a change.

## Credits

Shep began as a fork of [Rambox Community Edition](https://github.com/ramboxapp/community-edition), archived in 2022, and 1.0 is a rewrite that keeps its name and none of its code. The idea that every service should work the same way comes from [ElectronIM](https://github.com/manusa/electronim). The workspace icons are from [Lucide](https://lucide.dev).

Shep is not affiliated with any of the services it opens.

## Licence

[GNU GPL v3](./LICENSE).
