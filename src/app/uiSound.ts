/** Tiny mechanical UI sounds for the desk. Only plays after sound is enabled. */
export class UiSound {
  private context: AudioContext | null = null;

  constructor(private readonly enabled: () => boolean) {}

  private ensure(): AudioContext | null {
    if (!this.enabled()) return null;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private blip(frequency: number, duration: number, type: OscillatorType, gain: number, sweep = 0) {
    const context = this.ensure();
    if (!context) return;
    const at = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + sweep), at + duration);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  /** A short band-passed noise burst, used for plastic-on-plastic sliding. */
  private noiseSlide(duration: number, centre: number, gain: number) {
    const context = this.ensure();
    if (!context) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const envelope = Math.sin((i / length) * Math.PI);
      samples[i] = (seed / 2147483648 - 1) * envelope;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = centre;
    band.Q.value = .8;
    const shaper = context.createBiquadFilter();
    shaper.type = 'highpass';
    shaper.frequency.value = centre * .5;
    const volume = context.createGain();
    volume.gain.value = gain;
    source.connect(band).connect(shaper).connect(volume).connect(context.destination);
    source.start();
    source.onended = () => { source.disconnect(); band.disconnect(); shaper.disconnect(); volume.disconnect(); };
  }

  /** The disk sliding into the drive: a soft plastic swish. */
  diskSlide() {
    this.noiseSlide(0.34, 1500, 0.06);
  }

  /** The drive catching the disk: a low mechanical clunk plus a latch tick. */
  diskSeat() {
    this.blip(120, 0.16, 'triangle', 0.09, -40);
    window.setTimeout(() => this.blip(2100, 0.03, 'square', 0.03, -500), 8);
    window.setTimeout(() => this.noiseSlide(0.12, 700, 0.05), 4);
  }

  eject() {
    this.noiseSlide(0.16, 1100, 0.05);
    this.blip(340, 0.12, 'triangle', 0.045, -150);
  }

  click() {
    this.blip(520, 0.05, 'square', 0.025, -60);
  }
}
