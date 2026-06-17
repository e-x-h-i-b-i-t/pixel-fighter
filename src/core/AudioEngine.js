class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVolume = 0.25;
    this.sfxVolume = 0.45;
    
    this.musicInterval = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }

  playSFX(type, sourceX) {
    if (typeof window === 'undefined') return;
    this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    
    // Spatial volume falloff
    let volumeScale = 1.0;
    if (sourceX !== undefined) {
      const distance = Math.abs(sourceX - 500);
      volumeScale = Math.max(0.25, 1 - (distance / 600));
    }
    gain.gain.setValueAtTime(this.sfxVolume * volumeScale, t);

    // Spatial stereo panning
    let destination = this.ctx.destination;
    if (this.ctx.createStereoPanner && sourceX !== undefined) {
      const panner = this.ctx.createStereoPanner();
      const panVal = Math.max(-1, Math.min(1, (sourceX - 500) / 450));
      panner.pan.setValueAtTime(panVal, t);
      panner.connect(this.ctx.destination);
      destination = panner;
    }

    gain.connect(destination);

    if (type === 'hit') {
      // Noise burst for combat impact
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      
      gain.gain.setValueAtTime(this.sfxVolume * 1.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      
      noise.connect(filter);
      filter.connect(gain);
      noise.start(t);
      
      // Sub thud
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(this.sfxVolume * 0.9, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      
      osc.connect(oscGain);
      oscGain.connect(destination);
      osc.start(t);
      osc.stop(t + 0.08);
    } else if (type === 'swing') {
      // Whoosh swing
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
      
      gain.gain.setValueAtTime(this.sfxVolume * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'jump') {
      // Rise jump
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.12);
      
      gain.gain.setValueAtTime(this.sfxVolume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'dash') {
      // White noise dash burst
      const bufferSize = this.ctx.sampleRate * 0.06;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, t);
      
      gain.gain.setValueAtTime(this.sfxVolume * 0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      
      noise.connect(filter);
      filter.connect(gain);
      noise.start(t);
    } else if (type === 'parry') {
      // Bell/ding metal parry
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, t);
      osc.frequency.exponentialRampToValueAtTime(750, t + 0.12);
      
      gain.gain.setValueAtTime(this.sfxVolume * 0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'ultimate') {
      // Ultimate cast build-up
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(550, t + 0.38);
      
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.75, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
      
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.38);
    }
  }

  startMusic() {
    if (typeof window === 'undefined') return;
    this.init();
    if (!this.ctx) return;
    if (this.musicInterval) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const scale = [130.81, 146.83, 164.81, 196.00, 220.00]; // Pentatonic bass loops
    let index = 0;

    this.musicInterval = setInterval(() => {
      if (this.ctx.state === 'suspended') return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(scale[index], t);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.musicVolume * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
      
      index = (index + Math.floor(Math.random() * 2) + 1) % scale.length;
    }, 450);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  setMusicVolume(vol) {
    this.musicVolume = vol;
  }

  setSFXVolume(vol) {
    this.sfxVolume = vol;
  }
}

export const audioEngine = new AudioEngine();
