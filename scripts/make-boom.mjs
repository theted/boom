// Synthesises media/boom.wav: a deep, slightly distorted bass hit in the
// spirit of the vine boom. Run with `npm run sound`. No dependencies.
//
// Want the real thing? Point the `boom.soundFile` setting at your own file.
import { writeFileSync, mkdirSync } from "node:fs";

const rate = 44100;
const seconds = 1.6;
const n = Math.floor(rate * seconds);
const dry = new Float32Array(n);

let phase = 0;
for (let i = 0; i < n; i++) {
  const t = i / rate;
  // Pitch drops fast from ~140 Hz to ~42 Hz: that "dropping" feel.
  const freq = 42 + 98 * Math.exp(-t * 18);
  phase += (2 * Math.PI * freq) / rate;
  const body = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase);
  const env = Math.min(1, t / 0.004) * Math.exp(-t * 2.6);
  // A short noisy click on the attack so it cuts through on laptop speakers.
  const click = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.5;
  dry[i] = body * env + click;
}

// Cheap reverb: a few feedback comb filters.
const wet = new Float32Array(n);
for (const [delayMs, gain] of [[29.7, 0.55], [37.1, 0.5], [41.1, 0.45], [43.7, 0.4]]) {
  const d = Math.floor((delayMs / 1000) * rate);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = dry[i] + (i >= d ? buf[i - d] * gain : 0);
    wet[i] += buf[i] * 0.12;
  }
}

// Mix, saturate (tanh), fade out the tail, normalise to 16-bit PCM.
const out = new Float32Array(n);
let peak = 0;
for (let i = 0; i < n; i++) {
  const fade = Math.min(1, (n - i) / (rate * 0.2));
  out[i] = Math.tanh(2.2 * (dry[i] + wet[i])) * fade;
  peak = Math.max(peak, Math.abs(out[i]));
}

const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  data.writeInt16LE(Math.round((out[i] / peak) * 0.95 * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16); // fmt chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28); // byte rate
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

mkdirSync(new URL("../media/", import.meta.url), { recursive: true });
writeFileSync(new URL("../media/boom.wav", import.meta.url), Buffer.concat([header, data]));
console.log("wrote media/boom.wav");
