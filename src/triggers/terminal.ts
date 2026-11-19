import * as vscode from "vscode";
import { readConfig } from "../config";
import type { Boomer } from "../boom";
import { findLocation } from "../locate";

// Commands you type in the integrated terminal. Needs shell integration
// (on by default for bash, zsh, fish and pwsh) to know a command's exit code.
//
// To jump to the error line we also need the command's output, and
// execution.read() only returns output written *after* it's first called, so
// we start reading as soon as the command starts.

const MAX_OUTPUT = 64 * 1024; // keep the tail; errors are usually at the end

export function registerTerminalTrigger(boomer: Boomer): vscode.Disposable {
  const outputs = new Map<vscode.TerminalShellExecution, { text: string; done: Promise<void> }>();

  const onStart = vscode.window.onDidStartTerminalShellExecution((e) => {
    if (!readConfig().triggers.terminal) return;
    const entry = { text: "", done: Promise.resolve() };
    entry.done = (async () => {
      for await (const chunk of e.execution.read()) {
        entry.text = (entry.text + chunk).slice(-MAX_OUTPUT);
      }
    })().catch(() => {});
    outputs.set(e.execution, entry);
  });

  const onEnd = vscode.window.onDidEndTerminalShellExecution(async (e) => {
    const entry = outputs.get(e.execution);
    outputs.delete(e.execution);
    const cfg = readConfig();
    if (!cfg.triggers.terminal || e.exitCode === undefined || e.exitCode === 0) return;
    // Ctrl+C gives 130; that's you, not an error.
    if (e.exitCode === 130) return;

    // Give the reader a moment to drain the last chunk of output.
    if (entry) await Promise.race([entry.done, new Promise((r) => setTimeout(r, 300))]);
    const location = entry ? findLocation(entry.text, e.execution.cwd?.fsPath) : undefined;

    // If a failing task also reports here, the cooldown in Boomer swallows the
    // duplicate, so no special-casing is needed.
    boomer.fire({
      trigger: "terminal",
      title: `Command failed (exit ${e.exitCode})`,
      detail: e.execution.commandLine.value,
      terminal: e.terminal,
      location,
    });
  });

  return vscode.Disposable.from(onStart, onEnd);
}
