import * as fs from "node:fs";
import * as vscode from "vscode";
import { readConfig } from "./config";
import { play, stopPlaying } from "./player";
import { listSounds, soundsDir } from "./sounds";

// "Boom: Pick a sound…": a two-step QuickPick.
//   Step 1: choose a sound; each one plays as you arrow over it.
//   Step 2: choose what it's for (everything, or one trigger).
// createQuickPick() (instead of the simpler showQuickPick()) gives us the
// onDidChangeActive event we need for the previews.

type SoundItem = vscode.QuickPickItem & { file?: string; action?: "browse" | "folder" };

export async function pickSound(extensionUri: vscode.Uri): Promise<void> {
  const cfg = readConfig();
  const sounds = listSounds(extensionUri);

  const items: SoundItem[] = [
    { label: "Built in", kind: vscode.QuickPickItemKind.Separator },
    ...sounds.filter((s) => s.origin === "bundled").map(toItem),
    { label: "Your sounds", kind: vscode.QuickPickItemKind.Separator },
    ...sounds.filter((s) => s.origin === "yours").map(toItem),
    { label: "$(folder-opened) Open your sounds folder", detail: soundsDir(), action: "folder" },
    { label: "$(file-media) Choose a file…", action: "browse" },
  ];

  const qp = vscode.window.createQuickPick<SoundItem>();
  qp.title = "Boom: pick a sound (plays as you move)";
  qp.items = items;
  qp.activeItems = items.filter((i) => i.label === cfg.sound);
  qp.onDidChangeActive(([item]) => {
    stopPlaying();
    if (item?.file) play(item.file, cfg.volume, () => {});
  });

  const chosen = await new Promise<SoundItem | undefined>((resolve) => {
    qp.onDidAccept(() => resolve(qp.selectedItems[0]));
    qp.onDidHide(() => resolve(undefined));
    qp.show();
  });
  qp.dispose();
  stopPlaying();
  if (!chosen) return;

  let value: string;
  if (chosen.action === "folder") {
    await openSoundsFolder();
    return;
  } else if (chosen.action === "browse") {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { Audio: ["wav", "mp3", "ogg", "flac", "aiff", "m4a"] },
    });
    if (!picked) return;
    value = picked[0].fsPath;
  } else {
    value = chosen.label;
  }

  const targets = [
    { label: "Everything", key: "sound" },
    { label: "New problems only", key: "sounds.diagnostics" },
    { label: "Failed tasks only", key: "sounds.tasks" },
    { label: "Failed terminal commands only", key: "sounds.terminal" },
  ];
  const target = await vscode.window.showQuickPick(targets, { title: `Use "${value}" for…` });
  if (!target) return;

  await vscode.workspace.getConfiguration("boom").update(target.key, value, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`💥 boom.${target.key} = ${value}`);
}

function toItem(s: { name: string; file: string }): SoundItem {
  return { label: s.name, file: s.file };
}

export async function openSoundsFolder(): Promise<void> {
  const dir = soundsDir();
  fs.mkdirSync(dir, { recursive: true });
  await vscode.env.openExternal(vscode.Uri.file(dir));
}
