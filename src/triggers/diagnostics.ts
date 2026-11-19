import * as vscode from "vscode";
import { readConfig } from "../config";
import type { Boomer } from "../boom";

// Diagnostics are what the Problems panel shows (red/yellow squiggles). They
// change constantly while you type, so we:
//   1. wait until they settle (debounce),
//   2. compare against the last snapshot and only boom on problems that are NEW.
export function registerDiagnosticsTrigger(boomer: Boomer): vscode.Disposable {
  let known = snapshot();
  let timer: NodeJS.Timeout | undefined;

  const sub = vscode.languages.onDidChangeDiagnostics(() => {
    const cfg = readConfig();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const current = snapshot();
      if (cfg.enabled && cfg.triggers.diagnostics) {
        const fresh = [...current.entries()].filter(([key]) => !known.has(key));
        if (fresh.length > 0) {
          const [, first] = fresh[0];
          const more = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : "";
          boomer.fire({
            title: `${vscode.workspace.asRelativePath(first.uri)}:${first.diag.range.start.line + 1}${more}`,
            detail: first.diag.message,
            location: new vscode.Location(first.uri, first.diag.range),
          });
        }
      }
      known = current;
    }, cfg.diagnostics.debounceMs);
  });

  return new vscode.Disposable(() => {
    clearTimeout(timer);
    sub.dispose();
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
