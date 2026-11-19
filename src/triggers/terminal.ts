import * as vscode from "vscode";
import { readConfig } from "../config";
import type { Boomer } from "../boom";

// Commands you type in the integrated terminal. Needs shell integration
// (on by default for bash, zsh, fish and pwsh) to know a command's exit code.
export function registerTerminalTrigger(boomer: Boomer): vscode.Disposable {
  return vscode.window.onDidEndTerminalShellExecution((e) => {
    const cfg = readConfig();
    if (!cfg.triggers.terminal || e.exitCode === undefined || e.exitCode === 0) return;
    // Ctrl+C gives 130; that's you, not an error.
    if (e.exitCode === 130) return;
    // If a failing task also reports here, the cooldown in Boomer swallows the
    // duplicate, so no special-casing is needed.
    boomer.fire({
      trigger: "terminal",
      title: `Command failed (exit ${e.exitCode})`,
      detail: e.execution.commandLine.value,
      terminal: e.terminal,
    });
  });
}
