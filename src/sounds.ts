import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

// Where sounds come from:
//   1. bundled:  media/*.wav, shipped inside the extension
//   2. yours:    any audio file in the sounds folder (boom.soundsDir)
//   3. a path:   an absolute path in the setting itself
export interface Sound {
  name: string; // what you put in the setting
  file: string; // absolute path to play
  origin: "bundled" | "yours";
}

const AUDIO = new Set([".wav", ".mp3", ".ogg", ".flac", ".aiff", ".m4a"]);

export function soundsDir(): string {
  const configured = vscode.workspace.getConfiguration("boom").get<string>("soundsDir", "");
  const dir = configured || "~/.config/boom/sounds";
  return dir.startsWith("~") ? path.join(os.homedir(), dir.slice(1)) : dir;
}

function listAudio(dir: string, origin: Sound["origin"]): Sound[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return []; // folder doesn't exist (yet): no sounds, not an error
  }
  return entries
    .filter((f) => AUDIO.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => ({ name: path.parse(f).name, file: path.join(dir, f), origin }));
}

export function listSounds(extensionUri: vscode.Uri): Sound[] {
  return [
    ...listAudio(vscode.Uri.joinPath(extensionUri, "media").fsPath, "bundled"),
    ...listAudio(soundsDir(), "yours"),
  ];
}

// Turn a setting value into a file to play. Your own sounds win over bundled
// ones with the same name, so you can override "boom" with the real thing.
export function resolveSound(extensionUri: vscode.Uri, value: string): string | undefined {
  if (path.isAbsolute(value)) return value;
  const matches = listSounds(extensionUri).filter((s) => s.name === value || path.basename(s.file) === value);
  return (matches.find((s) => s.origin === "yours") ?? matches[0])?.file;
}
