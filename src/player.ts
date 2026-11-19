import { spawn, type ChildProcess } from "node:child_process";

// The extension host is plain Node.js: there is no audio API, so we shell out
// to whatever player the OS has. Each candidate is tried in order until one
// exists (a missing binary fails with ENOENT and we move on).
type Candidate = { cmd: string; args: (file: string, volume: number) => string[] };

const candidates: Record<string, Candidate[]> = {
  darwin: [{ cmd: "afplay", args: (f, v) => ["-v", String(v), f] }],
  linux: [
    { cmd: "pw-play", args: (f, v) => ["--volume", String(v), f] }, // PipeWire
    { cmd: "paplay", args: (f, v) => [`--volume=${Math.round(v * 65536)}`, f] }, // PulseAudio
    { cmd: "ffplay", args: (f, v) => ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", String(Math.round(v * 100)), f] },
    { cmd: "aplay", args: (f) => ["-q", f] }, // ALSA, no volume control
  ],
};

// Remember which player worked so later booms skip the probing.
let working: Candidate | undefined;
// The most recent player process, so a preview can cut off the previous one.
let current: ChildProcess | undefined;

export function stopPlaying(): void {
  current?.kill();
  current = undefined;
}

export function play(file: string, volume: number, log: (msg: string) => void): void {
  const list = working ? [working] : candidates[process.platform] ?? [];
  if (list.length === 0) {
    log(`No known audio player for platform "${process.platform}".`);
    return;
  }
  tryNext(list, 0, file, volume, log);
}

function tryNext(list: Candidate[], i: number, file: string, volume: number, log: (msg: string) => void) {
  if (i >= list.length) {
    log(`None of ${list.map((c) => c.cmd).join(", ")} could play ${file}.`);
    return;
  }
  const c = list[i];
  const child = spawn(c.cmd, c.args(file, volume), { stdio: "ignore", detached: false });
  child.on("error", () => tryNext(list, i + 1, file, volume, log)); // not installed
  child.on("spawn", () => {
    working = c;
    current = child;
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal === null) {
      log(`${c.cmd} exited with ${code} playing ${file}.`);
    }
  });
}
