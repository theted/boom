// Synthesises the bundled sounds into media/*.wav. Run with `npm run sounds`.
// No dependencies: just maths and a hand-written WAV header.
//
// Want the real meme clips? Drop them in your sounds folder (see README).
import { writeFileSync, mkdirSync } from "node:fs";

const RATE = 44100;

// ---- building blocks -------------------------------------------------------

function render(seconds, sampleAt) {
  const n = Math.floor(RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sampleAt(i / RATE);
  return out;
}

// Cheap reverb: parallel feedback comb filters mixed under the dry signal.
function reverb(dry, { combs, mix }) {
  const wet = new Float32Array(dry.length);
  for (const [delayMs, gain] of combs) {
    const d = Math.floor((delayMs / 1000) * RATE);
    const buf = new Float32Array(dry.length);
    for (let i = 0; i < dry.length; i++) {
      buf[i] = dry[i] + (i >= d ? buf[i - d] * gain : 0);
      wet[i] += buf[i] * mix;
    }
  }
  return dry.map((x, i) => x + wet[i]);
}

// Saturate, fade the tail, normalise, write 16-bit mono PCM.
function writeWav(name, samples, { drive = 1, fadeSec = 0.2 } = {}) {
  const n = samples.length;
  let peak = 0;
  const shaped = samples.map((x, i) => {
    const y = Math.tanh(drive * x) * Math.min(1, (n - i) / (RATE * fadeSec));
    peak = Math.max(peak, Math.abs(y));
    return y;
  });
  const data = Buffer.alloc(n * 2);
  shaped.forEach((y, i) => data.writeInt16LE(Math.round((y / peak) * 0.95 * 32767), i * 2));

  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);

  mkdirSync(new URL("../media/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../media/${name}.wav`, import.meta.url), Buffer.concat([h, data]));
  console.log(`wrote media/${name}.wav`);
}

const noise = () => Math.random() * 2 - 1;

// ---- boom: deep dropping bass hit ------------------------------------------

{
  let phase = 0;
  const dry = render(1.6, (t) => {
    const freq = 42 + 98 * Math.exp(-t * 18); // ~140 Hz falling to ~42 Hz
    phase += (2 * Math.PI * freq) / RATE;
    const body = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 2.6);
    return body * env + noise() * Math.exp(-t * 90) * 0.5; // + attack click
  });
  writeWav("boom", reverb(dry, { combs: [[29.7, 0.55], [37.1, 0.5], [41.1, 0.45], [43.7, 0.4]], mix: 0.12 }), { drive: 2.2 });
}

// ---- pipe: a metal pipe hitting a concrete floor ---------------------------
// A struck tube rings at inharmonic frequencies (roughly a free-free beam:
// ratios 1, 2.76, 5.40, 8.93, ...). Each partial is a slightly detuned pair so
// it shimmers, higher partials die faster, and a second smaller hit follows
// as the pipe bounces.

{
  const base = 410;
  const partials = [
    [1.0, 1.0, 1.6],
    [2.756, 0.8, 2.4],
    [5.404, 0.55, 3.5],
    [8.933, 0.35, 5],
    [13.34, 0.2, 7],
  ]; // [ratio, amplitude, decay rate]
  const strike = (t) =>
    partials.reduce((sum, [ratio, amp, decay]) => {
      const f = base * ratio;
      const pair = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t + 1);
      return sum + amp * pair * Math.exp(-t * decay);
    }, 0) + noise() * Math.exp(-t * 60) * 1.5; // the "clank" of impact
  const bounce = 0.17; // seconds until the bounce
  const dry = render(2.6, (t) => {
    let y = strike(t);
    if (t > bounce) y += 0.45 * strike(t - bounce);
    return y * Math.min(1, t / 0.001);
  });
  writeWav("pipe", reverb(dry, { combs: [[23.3, 0.6], [31.7, 0.55], [47.9, 0.5], [53.3, 0.45]], mix: 0.1 }), { drive: 1.6, fadeSec: 0.4 });
}

// ---- bonk: short hollow wooden knock ---------------------------------------

{
  let phase = 0;
  const dry = render(0.5, (t) => {
    const freq = 180 + 260 * Math.exp(-t * 40);
    phase += (2 * Math.PI * freq) / RATE;
    return (Math.sin(phase) + 0.5 * Math.sin(2.3 * phase)) * Math.exp(-t * 14) + noise() * Math.exp(-t * 200) * 0.6;
  });
  writeWav("bonk", dry, { drive: 1.4, fadeSec: 0.1 });
}
