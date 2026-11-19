import * as vscode from "vscode";

// Every setting declared under "contributes.configuration" in package.json,
// read in one place so the rest of the code gets plain typed values.
export type Trigger = "diagnostics" | "tasks" | "terminal";

export interface BoomConfig {
  enabled: boolean;
  triggers: { diagnostics: boolean; tasks: boolean; terminal: boolean };
  diagnostics: {
    minSeverity: vscode.DiagnosticSeverity;
    debounceMs: number;
    ignoreSources: string[];
  };
  cooldownMs: number;
  volume: number;
  sound: string;
  sounds: Record<Trigger, string>; // per-trigger override, "" = use `sound`
  showMessage: boolean;
  reveal: "none" | "panel" | "source";
}

export function readConfig(): BoomConfig {
  const c = vscode.workspace.getConfiguration("boom");
  return {
    enabled: c.get("enabled", true),
    triggers: {
      diagnostics: c.get("triggers.diagnostics", true),
      tasks: c.get("triggers.tasks", true),
      terminal: c.get("triggers.terminal", true),
    },
    diagnostics: {
      minSeverity:
        c.get<string>("diagnostics.minSeverity", "error") === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Error,
      debounceMs: c.get("diagnostics.debounceMs", 1500),
      ignoreSources: c.get("diagnostics.ignoreSources", []),
    },
    cooldownMs: c.get("cooldownMs", 3000),
    volume: Math.min(1, Math.max(0, c.get("volume", 1))),
    sound: c.get("sound", "boom"),
    sounds: {
      diagnostics: c.get("sounds.diagnostics", ""),
      tasks: c.get("sounds.tasks", ""),
      terminal: c.get("sounds.terminal", ""),
    },
    showMessage: c.get("showMessage", true),
    reveal: c.get("reveal", "panel"),
  };
}
