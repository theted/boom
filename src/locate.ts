import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

// Finds "where did it break" in a command's output, e.g.
//   src/app.ts:12:5            (eslint, vite, node stack traces, gcc, go, rust…)
//   src/app.ts(12,5)           (tsc)
//   File "app.py", line 12     (Python tracebacks)
// and returns the first one that is a real file, preferring your code over
// node_modules / site-packages.

// Colours and cursor codes from the terminal would break the regexes.
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const GENERIC = /((?:[A-Za-z]:)?[\w@~./\\+-]*[\w-]\.[A-Za-z0-9]+)(?::(\d+)(?::(\d+))?|\((\d+),(\d+)\))/g;
const PYTHON = /File "([^"]+)", line (\d+)/g;

type Candidate = { file: string; line: number; col: number };

export function findLocation(output: string, cwd: string | undefined): vscode.Location | undefined {
  const text = output.replace(ANSI, "");

  const python = [...text.matchAll(PYTHON)].map((m) => ({ file: m[1], line: +m[2], col: 1 }));
  const generic = [...text.matchAll(GENERIC)].map((m) => ({
    file: m[1],
    line: +(m[2] ?? m[4]),
    col: +(m[3] ?? m[5] ?? 1),
  }));
  // Python prints the innermost frame (the actual error) last.
  const candidates: Candidate[] = [...python.reverse(), ...generic];

  const isLibrary = (f: string) => /node_modules|site-packages|dist-packages/.test(f);
  const ordered = [...candidates.filter((c) => !isLibrary(c.file)), ...candidates.filter((c) => isLibrary(c.file))];

  const roots = [cwd, ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath)].filter(
    (r): r is string => !!r,
  );
  for (const c of ordered) {
    const file = resolve(c.file.replace(/^file:\/\//, ""), roots);
    if (file && c.line > 0) {
      const pos = new vscode.Position(c.line - 1, Math.max(0, c.col - 1));
      return new vscode.Location(vscode.Uri.file(file), pos);
    }
  }
  return undefined;
}

function resolve(file: string, roots: string[]): string | undefined {
  const tries = path.isAbsolute(file) ? [file] : roots.map((r) => path.join(r, file));
  return tries.find((f) => {
    try {
      return fs.statSync(f).isFile();
    } catch {
      return false;
    }
  });
}
