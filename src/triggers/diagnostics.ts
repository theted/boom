import * as vscode from "vscode";
import { readConfig } from "../config";
import type { Boomer } from "../boom";

// Diagnostics are what the Problems panel shows (red/yellow squiggles). They
// change constantly while you type, so we only *check* at chosen moments and
// boom on problems that weren't there at the previous check.
//
//   when = "save"   → check after a save (manual, or auto-save if onAutoSave)
//   when = "typing" → check whenever problems have stopped changing
//
// Either way we wait `debounceMs` for things to settle first: language servers
// and watch tasks (tsc --watch, …) report a moment after the save.

// How long after a save we keep listening for late problems.
const SAVE_WINDOW_MS = 15_000;

export function registerDiagnosticsTrigger(boomer: Boomer): vscode.Disposable {
  let known = snapshot();
  let timer: NodeJS.Timeout | undefined;
  let listenUntil = 0; // "save" mode: problem changes before this time get checked
  const autoSaves = new Set<string>(); // documents whose upcoming save is an auto-save

  const check = () => {
    const cfg = readConfig();
    const current = snapshot();
    if (cfg.enabled && cfg.triggers.diagnostics) {
      const fresh = [...current.entries()].filter(([key]) => !known.has(key));
      if (fresh.length > 0) {
        const [, first] = fresh[0];
        const more = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : "";
        boomer.fire({
          trigger: "diagnostics",
          title: `${vscode.workspace.asRelativePath(first.uri)}:${first.diag.range.start.line + 1}${more}`,
          detail: first.diag.message,
          location: new vscode.Location(first.uri, first.diag.range),
        });
      }
    }
    known = current;
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(check, readConfig().diagnostics.debounceMs);
  };

  const subs = [
    vscode.languages.onDidChangeDiagnostics(() => {
      const { when } = readConfig().diagnostics;
      if (when === "typing" || Date.now() < listenUntil) schedule();
    }),

    // onWillSave knows *why* a save happens (Manual / AfterDelay / FocusOut);
    // onDidSave doesn't, so we note it here and look it up there.
    vscode.workspace.onWillSaveTextDocument((e) => {
      const key = e.document.uri.toString();
      if (e.reason === vscode.TextDocumentSaveReason.Manual) autoSaves.delete(key);
      else autoSaves.add(key);
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      const cfg = readConfig().diagnostics;
      const wasAuto = autoSaves.delete(doc.uri.toString());
      if (cfg.when !== "save") return;
      // Skipped saves leave `known` alone, so the problems still boom at the
      // next save that counts.
      if (wasAuto && !cfg.onAutoSave) return;
      listenUntil = Date.now() + SAVE_WINDOW_MS;
      schedule();
    }),
  ];

  return new vscode.Disposable(() => {
    clearTimeout(timer);
    subs.forEach((s) => s.dispose());
  });
}

type Entry = { uri: vscode.Uri; diag: vscode.Diagnostic };

// All current matching problems, keyed so the same problem on the same line
// counts as "already known" between snapshots.
function snapshot(): Map<string, Entry> {
  const cfg = readConfig();
  const map = new Map<string, Entry>();
  for (const [uri, diags] of vscode.languages.getDiagnostics()) {
    for (const diag of diags) {
      // Severity enum: Error = 0, Warning = 1, so "<=" means "at least as bad".
      if (diag.severity > cfg.diagnostics.minSeverity) continue;
      if (diag.source && cfg.diagnostics.ignoreSources.includes(diag.source)) continue;
      const key = `${uri.toString()}|${diag.range.start.line}|${diag.source ?? ""}|${diag.message}`;
      map.set(key, { uri, diag });
    }
  }
  return map;
}
