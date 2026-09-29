import type { DeskObjectId } from './scene';

/** Quiet, asset-free room ambience. Audio is created only after a visitor enables it. */
export class DeskAmbience {
  enabled = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private airGain: GainNode | null = null;
  private chirpTimer = 0;
  private suspendTimer = 0;
  private focus: DeskObjectId | null = null;

  private makeNoise(context: AudioContext) {
    const length = Math.floor(context.sampleRate * 7);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 895733;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    // Match the end to the beginning so the long loop has no audible click.
    const blend = Math.floor(context.sampleRate * .025);
    for (let i = 0; i < blend; i++) {
      const t = i / (blend - 1);
      samples[length - blend + i] = samples[length - blend + i] * (1 - t) + samples[i] * t;
    }
    return buffer;
  }

  private makeLayer(buffer: AudioBuffer, low: number, high: number, level: number, pan: number) {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = .025;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = low;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = high;
    const gain = context.createGain();
    gain.gain.value = level;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(highpass).connect(lowpass).connect(gain).connect(panner).connect(this.master!);
    source.start();
    return gain;
  }

  private init() {
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);
    const noise = this.makeNoise(context);

    // Rain is soft broadband hiss, positioned toward the window.
    this.rainGain = this.makeLayer(noise, 850, 6100, .075, .28);
    // The desk fan is a low, breathing airflow rather than a mechanical buzz.
    this.airGain = this.makeLayer(noise, 55, 680, .12, .38);
    const airSwell = context.createOscillator();
    const airDepth = context.createGain();
    airSwell.type = 'sine';
    airSwell.frequency.value = .11;
    airDepth.gain.value = .018;
    airSwell.connect(airDepth).connect(this.airGain.gain);
    airSwell.start();

    // Faint foliage rustle sits behind both rain and fan.
    const leaves = this.makeLayer(noise, 230, 1550, .032, -.25);
    const rustle = context.createOscillator();
    const rustleDepth = context.createGain();
    rustle.frequency.value = .07;
    rustleDepth.gain.value = .01;
    rustle.connect(rustleDepth).connect(leaves.gain);
    rustle.start();
    this.applyFocus();
  }

  private chirp() {
    const context = this.context;
    if (!context || !this.enabled) return;
    const start = context.currentTime + .02;
    const pan = context.createStereoPanner();
    pan.pan.value = -.45 + Math.random() * .7;
    pan.connect(this.master!);
    for (let note = 0; note < 2; note++) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const at = start + note * .19;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1260 + note * 170, at);
      oscillator.frequency.exponentialRampToValueAtTime(1820 + note * 120, at + .11);
      oscillator.frequency.exponentialRampToValueAtTime(1080 + note * 130, at + .22);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(.009, at + .035);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + .24);
      oscillator.connect(envelope).connect(pan);
      oscillator.start(at);
      oscillator.stop(at + .25);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); if (note === 1) pan.disconnect(); };
    }
  }

  private scheduleChirp() {
    if (!this.enabled) return;
    this.chirpTimer = window.setTimeout(() => {
      this.chirp();
      this.scheduleChirp();
    }, 9000 + Math.random() * 11000);
  }

  private applyFocus() {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    this.rainGain?.gain.setTargetAtTime(this.focus === 'window' ? .105 : .075, now, .5);
    this.airGain?.gain.setTargetAtTime(this.focus === 'fan' ? .17 : .12, now, .5);
  }

  setFocus(focus: DeskObjectId | null) {
    this.focus = focus;
    this.applyFocus();
  }

  async setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    if (enabled && !this.context) this.init();
    const context = this.context!;
    window.clearTimeout(this.suspendTimer);
    if (enabled) {
      await context.resume();
      this.enabled = true;
      this.master!.gain.setTargetAtTime(.19, context.currentTime, .45);
      this.scheduleChirp();
    } else {
      this.enabled = false;
      window.clearTimeout(this.chirpTimer);
      this.master!.gain.setTargetAtTime(0, context.currentTime, .18);
      this.suspendTimer = window.setTimeout(() => {
        if (!this.enabled) void context.suspend();
      }, 1200);
    }
  }

  dispose() {
    window.clearTimeout(this.chirpTimer);
    window.clearTimeout(this.suspendTimer);
    void this.context?.close();
  }
}
