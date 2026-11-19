import * as vscode from "vscode";
import { readConfig, type Trigger } from "./config";
import { play } from "./player";
import { resolveSound } from "./sounds";

// What a trigger hands over when something went wrong.
export interface BoomEvent {
  trigger?: Trigger; // picks the per-trigger sound; absent = the default sound
  title: string; // short, e.g. "Task failed: build"
  detail?: string; // the actual error text
  // How to "show the error": the panel to focus, or a precise location.
  location?: vscode.Location;
  terminal?: vscode.Terminal;
}

// The single place that decides whether to boom and what to show.
// Triggers don't know about sound, cooldowns or notifications.
export class Boomer {
  private lastBoom = 0;
  private lastHadLocation = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  fire(event: BoomEvent, opts: { force?: boolean } = {}): void {
    const cfg = readConfig();
    if (!opts.force) {
      if (!cfg.enabled) return;
      const now = Date.now();
      if (now - this.lastBoom < cfg.cooldownMs) {
        // The cooldown mutes repeats, but if this event knows *where* the
        // error is and the one that boomed didn't (a failed task followed by
        // its problems a second later), still take you there.
        if (event.location && !this.lastHadLocation && cfg.reveal !== "none") {
          this.lastHadLocation = true;
          this.reveal(event, cfg.reveal);
        }
        this.log.debug(`cooldown, skipped: ${event.title}`);
        return;
      }
    }
    this.lastBoom = Date.now();
    this.lastHadLocation = !!event.location;
    this.log.info(`BOOM: ${event.title}${event.detail ? ` — ${event.detail}` : ""}`);

    const wanted = (event.trigger && cfg.sounds[event.trigger]) || cfg.sound;
    let file = resolveSound(this.extensionUri, wanted);
    if (!file) {
      this.log.warn(`Sound "${wanted}" not found, falling back to "boom".`);
      file = resolveSound(this.extensionUri, "boom");
    }
    if (file) play(file, cfg.volume, (msg) => this.log.warn(msg));

    if (cfg.reveal !== "none") this.reveal(event, cfg.reveal);
    if (cfg.showMessage) this.notify(event);
  }

  private async notify(event: BoomEvent) {
    const text = event.detail ? `💥 ${event.title}: ${event.detail}` : `💥 ${event.title}`;
    const actions = [...(event.location ? ["Go to error"] : []), ...(event.terminal ? ["Show terminal"] : [])];
    const picked = await vscode.window.showErrorMessage(text, ...actions);
    if (picked === "Go to error" && event.location) this.reveal(event, "source");
    if (picked === "Show terminal" && event.terminal) event.terminal.show();
  }

  private async reveal(event: BoomEvent, how: "panel" | "source") {
    if (how === "source" && event.location) {
      // Put the cursor at the start of the error, scroll it into view, then
      // ask VS Code to show the hover there (which includes the error message).
      const start = event.location.range.start;
      const editor = await vscode.window.showTextDocument(event.location.uri, {
        selection: new vscode.Range(start, start),
        preserveFocus: false,
      });
      editor.revealRange(event.location.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      await vscode.commands.executeCommand("editor.action.showHover");
    } else if (event.location && !event.terminal) {
      await vscode.commands.executeCommand("workbench.actions.view.problems");
    } else if (event.terminal) {
      event.terminal.show(false);
    }
  }
}
