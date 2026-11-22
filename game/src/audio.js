// audio.js — suara WebAudio murni, tanpa file: langkah kaki, blip curiga,
// sting alarm, chime loot, arpeggio menang, drone malam. AudioContext dibuat
// malas (butuh gestur pengguna dulu) dan tidak pernah memblokir permainan.
export function createAudioEngine() {
  return {
    ctx: null,
    master: null,
    droneNodes: null,
    muted: false,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        return true;
      } catch {
        return false;
      }
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
    noiseBurst(dur, vol, lowpass) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    },
    step(sneaking) {
      this.tone(sneaking ? 140 : 190, 0.05, 'triangle', sneaking ? 0.03 : 0.06, 110);
    },
    guardStep(distance) {
      // Langkah guard terdengar makin keras saat mendekat — radar telinga.
      const vol = Math.max(0.015, 0.09 * (1 - distance / 320));
      this.tone(120, 0.07, 'triangle', vol, 85);
    },
    suspiciousBlip() {
      this.tone(660, 0.12, 'square', 0.06, 880);
    },
    alarmSting() {
      this.tone(220, 0.5, 'sawtooth', 0.14, 440);
      this.tone(233, 0.5, 'sawtooth', 0.1, 466);
    },
    caughtSting() {
      this.tone(330, 0.35, 'sawtooth', 0.16, 110);
      this.noiseBurst(0.25, 0.12, 900);
    },
    pickupChime(value) {
      const base = value >= 50000 ? 880 : 660;
      this.tone(base, 0.18, 'sine', 0.14);
      setTimeout(() => this.tone(base * 1.5, 0.22, 'sine', 0.12), 90);
    },
    empZap() {
      this.noiseBurst(0.4, 0.16, 2400);
      this.tone(1200, 0.3, 'square', 0.05, 180);
    },
    noiseToss() {
      this.tone(520, 0.1, 'sine', 0.1, 780);
      setTimeout(() => this.noiseBurst(0.12, 0.1, 1600), 160);
    },
    winArpeggio() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.35, 'sine', 0.14), i * 130));
    },
    loseDrone() {
      this.tone(98, 0.9, 'sine', 0.14, 65);
    },
    startDrone() {
      if (!this.ctx || this.droneNodes) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.droneNodes = { osc, lfo, gain };
    },
  };
}
