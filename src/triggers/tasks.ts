import * as vscode from "vscode";
import { readConfig } from "../config";
import type { Boomer } from "../boom";

// Tasks = Terminal > Run Task (tasks.json, npm scripts, ...).
export function registerTaskTrigger(boomer: Boomer): vscode.Disposable {
  return vscode.tasks.onDidEndTaskProcess((e) => {
    const cfg = readConfig();
    if (!cfg.triggers.tasks || e.exitCode === undefined || e.exitCode === 0) return;
    const name = e.execution.task.name;
    boomer.fire({
      title: `Task failed: ${name}`,
      detail: `exit code ${e.exitCode}`,
      // Task terminals are named after the task; good enough to find it.
      terminal: vscode.window.terminals.find((t) => t.name.includes(name)),
    });
  });
}
