import * as vscode from "vscode";
import { Boomer } from "./boom";
import { openSoundsFolder, pickSound } from "./picker";
import { registerDiagnosticsTrigger } from "./triggers/diagnostics";
import { registerTaskTrigger } from "./triggers/tasks";
import { registerTerminalTrigger } from "./triggers/terminal";

// VS Code calls activate() once, when an "activationEvents" entry in
// package.json matches (here: shortly after startup). Everything we create is
// pushed onto context.subscriptions so VS Code disposes it on deactivate.
export function activate(context: vscode.ExtensionContext) {
  const log = vscode.window.createOutputChannel("Boom", { log: true });
  const boomer = new Boomer(context.extensionUri, log);

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = "boom.toggle";
  const renderStatus = () => {
    const on = vscode.workspace.getConfiguration("boom").get("enabled", true);
    status.text = on ? "💥" : "$(mute)";
    status.tooltip = on ? "Boom is armed (click to disable)" : "Boom is off (click to enable)";
  };
  renderStatus();
  status.show();

  context.subscriptions.push(
    log,
    status,
    vscode.commands.registerCommand("boom.test", () =>
      boomer.fire({ title: "Test boom", detail: "this is what an error will feel like" }, { force: true }),
    ),
    vscode.commands.registerCommand("boom.pickSound", () => pickSound(context.extensionUri)),
    vscode.commands.registerCommand("boom.openSoundsFolder", openSoundsFolder),
    vscode.commands.registerCommand("boom.toggle", async () => {
      const cfg = vscode.workspace.getConfiguration("boom");
      await cfg.update("enabled", !cfg.get("enabled", true), vscode.ConfigurationTarget.Global);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("boom.enabled")) renderStatus();
    }),
    registerDiagnosticsTrigger(boomer),
    registerTaskTrigger(boomer),
    registerTerminalTrigger(boomer),
  );

  log.info("Boom activated");
}

export function deactivate() {}
