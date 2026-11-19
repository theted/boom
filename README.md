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
npm run install-ext   # compiles, packages boom.vsix, installs it
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

## Sounds

Run **Boom: Pick a sound…** from the Command Palette. Each sound plays as you arrow
over it; after picking, choose whether it's for everything or for one trigger only
(e.g. `pipe` for failed tasks, `boom` for new problems).

Built in (made by `scripts/make-sounds.mjs`, regenerate with `npm run sounds`):

| Name | Sound |
| --- | --- |
| `boom` | deep, dropping bass hit with reverb |
| `pipe` | metal pipe clanging on concrete, with a bounce |
| `bonk` | short hollow knock |

### Adding your own (the real vine boom, metal pipe, …)

The meme originals aren't bundled. Download them yourself and drop them into your
sounds folder, **`~/.config/boom/sounds/`** (same path on Linux and macOS; run
**Boom: Open your sounds folder** to create and open it). They show up in the picker
under *Your sounds*, by file name:

```
~/.config/boom/sounds/
├── vine-boom.wav      → "boom.sound": "vine-boom"
└── metal-pipe.wav     → "boom.sounds.tasks": "metal-pipe"
```

A file with the same name as a built-in sound (e.g. `boom.wav`) replaces it.
Prefer `.wav`: `afplay` and `ffplay` also play `.mp3`, but `paplay` and `aplay` don't.
To convert: `ffmpeg -i vine-boom.mp3 vine-boom.wav`.

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
| `boom.sound` | `"boom"` | Sound name (built in or yours) or an absolute path |
| `boom.sounds.diagnostics` / `.tasks` / `.terminal` | `""` | Per-trigger sound; empty uses `boom.sound` |
| `boom.soundsDir` | `""` | Your sounds folder; empty = `~/.config/boom/sounds` |
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
src/sounds.ts             finds sounds: bundled media/*.wav + your sounds folder
src/picker.ts             "Pick a sound…": two-step QuickPick with live previews
src/config.ts             typed reader for the boom.* settings
src/triggers/*.ts         one file per error source; each just calls boomer.fire()
scripts/make-sounds.mjs   synthesises media/*.wav
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
