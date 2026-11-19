# 💥 Boom

A tiny, personal VS Code extension: when something goes wrong it plays a
vine-boom, shows the error, and brings the problem into focus.

Not published to the Marketplace. You install it from a local `.vsix`.

## What triggers a boom

| Trigger | When | Setting |
| --- | --- | --- |
| Diagnostics | A **new** error shows up in the Problems panel (after it stops changing for `debounceMs`) | `boom.triggers.diagnostics` |
| Tasks | A task (Terminal → Run Task, npm scripts, …) exits non-zero | `boom.triggers.tasks` |
| Terminal | A command you type in the integrated terminal exits non-zero (not Ctrl+C) | `boom.triggers.terminal` |

## Install (Linux and macOS)

Requires Node.js 20+ and the `code` command on your PATH
(macOS: in VS Code run **Shell Command: Install 'code' command in PATH**).

```sh
git clone git@github.com:theted/boom.git
cd boom
npm install
npm run install-ext   # compiles, packages boom-0.0.1.vsix, installs it
```

Then reload VS Code (**Developer: Reload Window**) and run **Boom: Play a test boom**
from the Command Palette.

To update after pulling changes: `npm run install-ext` again and reload.
To remove: `code --uninstall-extension local.boom`.

### Sound players

The extension host is plain Node.js with no audio API, so Boom calls a command-line player:

- **macOS:** `afplay` (built in, nothing to install).
- **Linux:** the first one found of `pw-play` (PipeWire), `paplay` (PulseAudio),
  `ffplay` (ffmpeg) and `aplay` (ALSA). Most desktops already have one.

If nothing plays, open **Output → Boom** to see what went wrong.

### Using the real vine boom

The bundled `media/boom.wav` is synthesised by `scripts/make-boom.mjs` (a deep,
dropping bass hit). To use the original, download it yourself and point the setting at it:

```jsonc
// settings.json
"boom.soundFile": "/home/you/sounds/vine-boom.wav"
```

Prefer `.wav`: `afplay` and `ffplay` also play `.mp3`, but `paplay` and `aplay` don't.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `boom.enabled` | `true` | Master switch; also toggled from the 💥 in the status bar |
| `boom.triggers.diagnostics` / `.tasks` / `.terminal` | `true` | Turn each trigger on/off |
| `boom.diagnostics.minSeverity` | `"error"` | `"warning"` to boom on warnings too |
| `boom.diagnostics.debounceMs` | `1500` | Wait for diagnostics to settle, so half-typed code doesn't boom |
| `boom.diagnostics.ignoreSources` | `[]` | e.g. `["cSpell", "markdownlint"]` |
| `boom.cooldownMs` | `3000` | Minimum time between booms |
| `boom.volume` | `1` | 0–1 (`aplay` ignores it) |
| `boom.soundFile` | `""` | Your own sound file; empty uses the bundled one |
| `boom.showMessage` | `true` | Show the error as a notification (with a "Go to error" button) |
| `boom.reveal` | `"panel"` | `"none"`, `"panel"` (Problems panel or terminal), or `"source"` (jump to the line) |

## Developing

Open this folder in VS Code and press **F5**. That starts `npm run watch` and a second
VS Code window (the *Extension Development Host*) running your live code. Edit, then
**Developer: Reload Window** in that second window to pick up changes. `console.log`
and the debugger breakpoints work from the first window.

### How it's put together

```
package.json              the manifest: commands, settings, when to activate
src/extension.ts          activate(): wires everything up, status bar, commands
src/boom.ts               Boomer: cooldown, play sound, notify, reveal
src/player.ts             cross-platform "play this file" via afplay/pw-play/…
src/config.ts             typed reader for the boom.* settings
src/triggers/*.ts         one file per error source; each just calls boomer.fire()
scripts/make-boom.mjs     generates media/boom.wav
```

The key ideas, if you're learning:

- **`package.json` is the contract.** `contributes.commands` and
  `contributes.configuration` are declarative: VS Code shows them in the Command Palette
  and the Settings UI before your code runs. `activationEvents` says when your code loads
  (`onStartupFinished` = shortly after startup, without slowing it down).
- **`activate()` registers listeners and returns.** Every listener, command and UI item
  returns a `Disposable`; pushing them onto `context.subscriptions` means VS Code cleans
  them up for you.
- **Triggers only describe *what* went wrong** (`BoomEvent`), and `Boomer` decides
  *whether and how* to react. Adding a new trigger (debug session exceptions, failing
  tests, …) is one new file plus one line in `extension.ts`.
- **Settings are read on every event** (`readConfig()`), so changes apply immediately
  without listening for config changes.
