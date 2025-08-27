export const FREQUENCY_FACTOR = 17734472 / 18 / 16777216; // 0.0587253835466173

type CustomAudioParamValue =
  | { startTime: number; value: number; interpolation: 'const' }
  | { startTime: number; startValue: number; endTime: number; endValue: number; interpolation: 'lin' }
  | { startTime: number; startValue: number; endValue: number; timeConstant: number; interpolation: 'exp' };
export class CustomAudioParam {
  private _audioContext: AudioContext;
  private _values: Array<CustomAudioParamValue> = [];
  private _defaultValue: number;

  constructor(audioContext: AudioContext, defaultValue: number) {
    this._audioContext = audioContext;
    this._values.push({ startTime: audioContext.currentTime, value: defaultValue, interpolation: 'const' });
    this._defaultValue = defaultValue;
  }

  setValueAtTime(value: number, startTime: number): CustomAudioParam {
    if (startTime < this._values[0].startTime) {
      this._values.unshift({ startTime, value, interpolation: 'const' });
    } else if (startTime >= this._values[this._values.length - 1].startTime) {
      this._values.push({ startTime, value, interpolation: 'const' });
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (startTime >= this._values[i].startTime && startTime < this._values[i + 1].startTime) {
          this._values.splice(i + 1, 0, { startTime, value, interpolation: 'const' });
          break;
        }
      }
    }
    return this;
  }

  getValueAtTime(time: number): number {
    if (time < this._values[0].startTime) return this._defaultValue;

    let value: CustomAudioParamValue | undefined;
    if (this._values.length === 1) {
      value = this._values[0];
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (time >= this._values[i].startTime && time < this._values[i + 1].startTime) {
          value = this._values[i];
          break;
        }
      }
      if (!value) value = this._values[this._values.length - 1];
    }

    if (value.interpolation === 'const') {
      return value.value;
    } else if (value.interpolation === 'lin') {
      if (time < value.endTime) {
        return (
          value.startValue +
          ((time - value.startTime) / (value.endTime - value.startTime)) * (value.endValue - value.startValue)
        );
      } else {
        return value.endValue;
      }
    } else {
      return (
        value.endValue + (value.startValue - value.endValue) * Math.exp(-(time - value.startTime) / value.timeConstant)
      );
    }
  }

  get value(): number {
    return this.getValueAtTime(this._audioContext.currentTime);
  }

  set value(value: number) {
    this.setValueAtTime(value, this._audioContext.currentTime);
  }

  cancelScheduledValues(startTime: number) {
    const deleteIndex = this._values.findIndex((value) => startTime < value.startTime);
    if (deleteIndex >= 0) this._values.splice(deleteIndex);
    if (this._values.length === 0)
      this._values.push({
        startTime: this._audioContext.currentTime,
        value: this._defaultValue,
        interpolation: 'const',
      });
  }

  linearRampToValueAtTime(value: number, endTime: number): CustomAudioParam {
    if (endTime < this._values[0].startTime) {
      // nichts tun
    } else if (endTime >= this._values[this._values.length - 1].startTime) {
      const startEntry = this._values.pop()!;
      this._values.push({
        startTime: startEntry.startTime,
        startValue: startEntry.interpolation === 'const' ? startEntry.value : startEntry.startValue,
        endTime,
        endValue: value,
        interpolation: 'lin',
      });
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (endTime >= this._values[i].startTime && endTime < this._values[i + 1].startTime) {
          const startEntry = this._values.splice(i, 1)[0];
          this._values.splice(i, 0, {
            startTime: startEntry.startTime,
            startValue: startEntry.interpolation === 'const' ? startEntry.value : startEntry.startValue,
            endTime,
            endValue: value,
            interpolation: 'lin',
          });
          break;
        }
      }
    }
    return this;
  }

  setTargetAtTime(value: number, startTime: number, timeConstant: number): CustomAudioParam {
    if (startTime < this._values[0].startTime) {
      this._values.unshift({
        startTime,
        startValue: this._defaultValue,
        endValue: value,
        timeConstant,
        interpolation: 'exp',
      });
    } else if (startTime >= this._values[this._values.length - 1].startTime) {
      this._values.push({
        startTime,
        startValue: this.getValueAtTime(startTime),
        endValue: value,
        timeConstant,
        interpolation: 'exp',
      });
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (startTime >= this._values[i].startTime && startTime < this._values[i + 1].startTime) {
          this._values.splice(i + 1, 0, {
            startTime,
            startValue: this.getValueAtTime(startTime),
            endValue: value,
            timeConstant,
            interpolation: 'exp',
          });
          break;
        }
      }
    }
    return this;
  }
}

type CustomGenericAudioParamValue<T> = { startTime: number; value: T };
export class CustomGenericAudioParam<T> {
  private _audioContext: AudioContext;
  private _values: Array<CustomGenericAudioParamValue<T>> = [];
  private _defaultValue: T;

  constructor(audioContext: AudioContext, defaultValue: T) {
    this._audioContext = audioContext;
    this._values.push({ startTime: audioContext.currentTime, value: defaultValue });
    this._defaultValue = defaultValue;
  }

  setValueAtTime(value: T, startTime: number): CustomGenericAudioParam<T> {
    if (startTime < this._values[0].startTime) {
      this._values.unshift({ startTime, value });
    } else if (startTime >= this._values[this._values.length - 1].startTime) {
      this._values.push({ startTime, value });
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (startTime >= this._values[i].startTime && startTime < this._values[i + 1].startTime) {
          this._values.splice(i + 1, 0, { startTime, value });
          break;
        }
      }
    }
    return this;
  }

  getValueAtTime(time: number): T {
    if (time < this._values[0].startTime) return this._defaultValue;

    let value: CustomGenericAudioParamValue<T> | undefined;
    if (this._values.length === 1) {
      value = this._values[0];
    } else {
      for (let i = 0; i < this._values.length - 1; i++) {
        if (time >= this._values[i].startTime && time < this._values[i + 1].startTime) {
          value = this._values[i];
          break;
        }
      }
      if (!value) value = this._values[this._values.length - 1];
    }
    return value.value;
  }

  get value(): T {
    return this.getValueAtTime(this._audioContext.currentTime);
  }

  set value(value: T) {
    this.setValueAtTime(value, this._audioContext.currentTime);
  }

  cancelScheduledValues(startTime: number) {
    const deleteIndex = this._values.findIndex((value) => startTime < value.startTime);
    if (deleteIndex >= 0) this._values.splice(deleteIndex);
    if (this._values.length === 0)
      this._values.push({ startTime: this._audioContext.currentTime, value: this._defaultValue });
  }
}

type VoiceParams = {
  waveform: AudioParam;
  frequency: AudioParam;
  width: AudioParam;
  sync: AudioParam;
  rng: AudioParam;
};

export class SidOscillator {
  private _audioContext: AudioContext;
  private _oscillator: AudioWorkletNode;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
    this._oscillator = new AudioWorkletNode(audioContext, 'C64SidProcessor', {
      numberOfInputs: 1,
      numberOfOutputs: 3,
      outputChannelCount: [1, 1, 1],
      processorOptions: { sampleRate: audioContext.sampleRate },
    });
  }

  get voice1Params(): VoiceParams {
    return {
      waveform: this._oscillator.parameters.get('voice1Waveform')!,
      frequency: this._oscillator.parameters.get('voice1Frequency')!,
      width: this._oscillator.parameters.get('voice1Width')!,
      sync: this._oscillator.parameters.get('voice1Sync')!,
      rng: this._oscillator.parameters.get('voice1Rng')!,
    };
  }

  get voice2Params(): VoiceParams {
    return {
      waveform: this._oscillator.parameters.get('voice2Waveform')!,
      frequency: this._oscillator.parameters.get('voice2Frequency')!,
      width: this._oscillator.parameters.get('voice2Width')!,
      sync: this._oscillator.parameters.get('voice2Sync')!,
      rng: this._oscillator.parameters.get('voice2Rng')!,
    };
  }

  get voice3Params(): VoiceParams {
    return {
      waveform: this._oscillator.parameters.get('voice3Waveform')!,
      frequency: this._oscillator.parameters.get('voice3Frequency')!,
      width: this._oscillator.parameters.get('voice3Width')!,
      sync: this._oscillator.parameters.get('voice3Sync')!,
      rng: this._oscillator.parameters.get('voice3Rng')!,
    };
  }

  connect(destination: AudioNode, output: number, input?: number) {
    this._oscillator.connect(destination, output, input);
  }

  disconnect() {
    this._oscillator.disconnect();
  }
}

export type Waveform = 'triangle' | 'sawtooth' | 'pulse' | 'noise';

export class SidVoice {
  private _audioContext: AudioContext;
  private _adsrGain: GainNode;
  private _waveformParameter: AudioParam;
  private _frequencyParameter: AudioParam;
  private _widthParameter: AudioParam;
  private _syncParameter: AudioParam;
  private _rngParameter: AudioParam;
  private _attackDurationParameter: CustomAudioParam;
  private _decayDurationParameter: CustomAudioParam;
  private _sustainLevelParameter: CustomAudioParam;
  private _releaseDurationParameter: CustomAudioParam;
  private _adsrGainParameter: CustomAudioParam;

  constructor(audioContext: AudioContext, voiceParams: VoiceParams) {
    this._audioContext = audioContext;
    this._adsrGain = new GainNode(audioContext, { gain: 0 });
    this._waveformParameter = voiceParams.waveform;
    this._frequencyParameter = voiceParams.frequency;
    this._widthParameter = voiceParams.width;
    this._syncParameter = voiceParams.sync;
    this._rngParameter = voiceParams.rng;
    this._attackDurationParameter = new CustomAudioParam(audioContext, 0.002);
    this._decayDurationParameter = new CustomAudioParam(audioContext, 0.006);
    this._sustainLevelParameter = new CustomAudioParam(audioContext, 0);
    this._releaseDurationParameter = new CustomAudioParam(audioContext, 0.006);
    this._adsrGainParameter = new CustomAudioParam(audioContext, 0);
  }

  get inNode(): GainNode {
    return this._adsrGain;
  }

  get frequencyParam(): AudioParam {
    return this._frequencyParameter;
  }

  get widthParam(): AudioParam {
    return this._widthParameter;
  }

  /**
   *
   * @param value 0-65535
   * @param startTime
   */
  c64Frequency(value: number, startTime: number = this._audioContext.currentTime) {
    this.frequency(value * FREQUENCY_FACTOR, startTime);
  }
  /**
   *
   * @param value [Hz]
   * @param startTime
   */
  frequency(value: number, startTime: number = this._audioContext.currentTime) {
    this._frequencyParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64Waveform(value: number, startTime: number = this._audioContext.currentTime) {
    this._waveformParameter.setValueAtTime(value, startTime);
  }
  waveform(value: Waveform[], startTime: number = this._audioContext.currentTime) {
    const waveforms: number =
      (value.includes('triangle') ? 1 : 0) +
      (value.includes('sawtooth') ? 2 : 0) +
      (value.includes('pulse') ? 4 : 0) +
      (value.includes('noise') ? 8 : 0);
    this.c64Waveform(waveforms, startTime);
  }

  private static timeTable: number[] = [
    0.002, 0.008, 0.016, 0.024, 0.038, 0.056, 0.068, 0.08, 0.1, 0.25, 0.5, 0.8, 1, 3, 5, 8,
  ];

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64AttackDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this.attackDuration(SidVoice.timeTable[value], startTime);
  }
  /**
   *
   * @param value [s]
   * @param startTime
   */
  attackDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this._attackDurationParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64DecayDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this.decayDuration(SidVoice.timeTable[value] * 3, startTime);
  }
  /**
   *
   * @param value [s]
   * @param startTime
   */
  decayDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this._decayDurationParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64SustainLevel(value: number, startTime: number = this._audioContext.currentTime) {
    this.sustainLevel(value / 15, startTime);
  }
  /**
   *
   * @param value [%] 0-1
   * @param startTime
   */
  sustainLevel(value: number, startTime: number = this._audioContext.currentTime) {
    this._sustainLevelParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64ReleaseDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this.releaseDuration(SidVoice.timeTable[value] * 3, startTime);
  }
  /**
   *
   * @param value [s]
   * @param startTime
   */
  releaseDuration(value: number, startTime: number = this._audioContext.currentTime) {
    this._releaseDurationParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-4095
   * @param startTime
   */
  c64PulseWidth(value: number, startTime: number = this._audioContext.currentTime) {
    this.pulseWidth(value / 4095, startTime);
  }
  /**
   *
   * @param value [%] 0-1, 0 (only low) ... 1 (only high)
   * @param startTime
   */
  pulseWidth(value: number, startTime: number = this._audioContext.currentTime) {
    this._widthParameter.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-1
   * @param startTime
   */
  c64Sync(value: number, startTime: number = this._audioContext.currentTime) {
    this._syncParameter.setValueAtTime(value, startTime);
  }
  /**
   *
   * @param value on/off
   * @param startTime
   */
  sync(value: boolean, startTime: number = this._audioContext.currentTime) {
    this.c64Sync(Number(value), startTime);
  }

  /**
   *
   * @param value 0-1
   * @param startTime
   */
  c64Rng(value: number, startTime: number = this._audioContext.currentTime) {
    this._rngParameter.setValueAtTime(value, startTime);
  }
  /**
   *
   * @param value on/off
   * @param startTime
   */
  rng(value: boolean, startTime: number = this._audioContext.currentTime) {
    this.c64Rng(Number(value), startTime);
  }

  start(startTime: number = this._audioContext.currentTime) {
    // ADSR-Envelope
    // https://www.leafwindow.com/en/digital-piano-with-web-audio-api-5-en/
    const attackDuration = this._attackDurationParameter.value;
    const decayDuration = this._decayDurationParameter.value;
    const timeConstant = 0.2452 * decayDuration;
    const sustainLevel = this._sustainLevelParameter.value;
    const startValue = this._adsrGainParameter.getValueAtTime(startTime);
    // cancelScheduledValues instead of cancelAndHoldAtTime during attack phase removes the whole linearRamp
    // cancelAndHoldAtTime without setValueAtTime during decay/release phase -> linearRamp starts at 0
    this._adsrGain.gain.cancelAndHoldAtTime(startTime);
    this._adsrGain.gain.setValueAtTime(startValue, startTime);
    this._adsrGain.gain.linearRampToValueAtTime(1, startTime + attackDuration);
    this._adsrGain.gain.setTargetAtTime(sustainLevel, startTime + attackDuration, timeConstant);
    this._adsrGainParameter.cancelScheduledValues(startTime);
    this._adsrGainParameter.setValueAtTime(startValue, startTime);
    this._adsrGainParameter.linearRampToValueAtTime(1, startTime + attackDuration);
    this._adsrGainParameter.setTargetAtTime(sustainLevel, startTime + attackDuration, timeConstant);
  }

  stop(startTime: number = this._audioContext.currentTime) {
    const releaseDuration = this._releaseDurationParameter.value;
    const timeConstant = 0.2452 * releaseDuration;
    const startValue = this._adsrGainParameter.getValueAtTime(startTime);
    this._adsrGain.gain.cancelAndHoldAtTime(startTime);
    this._adsrGain.gain.setValueAtTime(startValue, startTime);
    this._adsrGain.gain.setTargetAtTime(0, startTime, timeConstant);
    this._adsrGainParameter.cancelScheduledValues(startTime);
    this._adsrGainParameter.setValueAtTime(startValue, startTime);
    this._adsrGainParameter.setTargetAtTime(0, startTime, timeConstant);
  }

  connect(destination: AudioNode) {
    this._adsrGain.connect(destination);
  }

  disconnect() {
    this._adsrGain.disconnect();
  }

  reset(startTime: number = this._audioContext.currentTime) {
    this._adsrGain.gain.cancelScheduledValues(startTime);
    this._adsrGain.gain.setValueAtTime(0, startTime);
    this._waveformParameter.cancelScheduledValues(startTime);
    this._waveformParameter.setValueAtTime(0, startTime);
    this._frequencyParameter.cancelScheduledValues(startTime);
    this._frequencyParameter.setValueAtTime(0, startTime);
    this._widthParameter.cancelScheduledValues(startTime);
    this._widthParameter.setValueAtTime(0.5, startTime);
    this._syncParameter.cancelScheduledValues(startTime);
    this._syncParameter.setValueAtTime(0, startTime);
    this._rngParameter.cancelScheduledValues(startTime);
    this._rngParameter.setValueAtTime(0, startTime);
    this._attackDurationParameter.cancelScheduledValues(startTime);
    this._attackDurationParameter.setValueAtTime(0.002, startTime);
    this._decayDurationParameter.cancelScheduledValues(startTime);
    this._decayDurationParameter.setValueAtTime(0.006, startTime);
    this._sustainLevelParameter.cancelScheduledValues(startTime);
    this._sustainLevelParameter.setValueAtTime(0, startTime);
    this._releaseDurationParameter.cancelScheduledValues(startTime);
    this._releaseDurationParameter.setValueAtTime(0.006, startTime);
    this._adsrGainParameter.cancelScheduledValues(startTime);
    this._adsrGainParameter.setValueAtTime(0, startTime);
  }
}

export const getFilterFrequency = (value: number, y0: number, ymax: number, x0: number, mu: number) =>
  y0 + (ymax - y0) / (1 + Math.exp(-mu * (value - x0)));
// lowpass ccs64
export const getLowPassFrequency = (value: number) => getFilterFrequency(value, 253.7, 1786, 776.6, 0.01395);
// highpass ccs64
export const getHighPassFrequency = (value: number) => getFilterFrequency(value, 406, 6032, 979.5, 0.0108);
// bandpass ccs64
export const getBandPassFrequency = (value: number) => getFilterFrequency(value, 317.2, 2447, 838.8, 0.01555);

export const getFilterValue = (frequency: number, y0: number, ymax: number, x0: number, mu: number) => {
  if (frequency <= y0) return 0;
  if (frequency >= ymax) return 2047;
  const value = x0 - Math.log((ymax - frequency) / (frequency - y0)) / mu;
  return Math.max(Math.min(value, 2047), 0);
};

// lowpass ccs64
export const getLowPassValue = (frequency: number) => getFilterValue(frequency, 253.7, 1786, 776.6, 0.01395);
// highpass ccs64
export const getHighPassValue = (frequency: number) => getFilterValue(frequency, 406, 6032, 979.5, 0.0108);
// bandpass ccs64
export const getBandPassValue = (frequency: number) => getFilterValue(frequency, 317.2, 2447, 838.8, 0.01555);

export const getFilterResonance = (value: number, a: number, b: number, c: number, m: number, n: number) =>
  (a * value ** 2 + b * value + c - n) / m;
// lowpass ccs64
export const getLowPassResonance = (value: number) =>
  getFilterResonance(value, -0.0142, 0.6892, -0.0047, 1.0014, -0.0762);
// highpass ccs64
export const getHighPassResonance = (value: number) =>
  getFilterResonance(value, -0.0148, 0.6794, 0.1406, 0.9393, 0.0526);
// bandpass ccs64
export const getBandPassResonance = (value: number) =>
  getFilterResonance(value, -0.0125, 0.6889, 0.0649, 1.0167, 0.2444);

export type FilterMode = 'highpass' | 'lowpass' | 'bandpass';

export class SidFilter {
  private _audioContext: AudioContext;
  private _inNode: GainNode;
  private _lowPass: BiquadFilterNode;
  private _highPass: BiquadFilterNode;
  private _bandPass: BiquadFilterNode;
  private _bandPassPeak: BiquadFilterNode;
  private _outNode: GainNode;

  private _in_out: GainNode;
  private _in_low: GainNode;
  private _in_band: GainNode;
  private _in_high: GainNode;
  private _low_band: GainNode;
  private _low_high: GainNode;
  private _band_high: GainNode;
  private _low_out: GainNode;
  private _band_out: GainNode;
  private _high_out: GainNode;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
    this._inNode = new GainNode(audioContext, { gain: 1 });
    this._lowPass = new BiquadFilterNode(audioContext, { type: 'lowpass' });
    this._highPass = new BiquadFilterNode(audioContext, { type: 'highpass' });
    this._bandPass = new BiquadFilterNode(audioContext, { type: 'bandpass', Q: 1 });
    this._bandPassPeak = new BiquadFilterNode(audioContext, { type: 'peaking', Q: 1 });
    this._outNode = new GainNode(audioContext, { gain: 1 });

    this._in_out = new GainNode(audioContext, { gain: 1 });
    this._in_low = new GainNode(audioContext, { gain: 0 });
    this._in_band = new GainNode(audioContext, { gain: 0 });
    this._in_high = new GainNode(audioContext, { gain: 0 });
    this._low_band = new GainNode(audioContext, { gain: 0 });
    this._low_high = new GainNode(audioContext, { gain: 0 });
    this._band_high = new GainNode(audioContext, { gain: 0 });
    this._low_out = new GainNode(audioContext, { gain: 0 });
    this._band_out = new GainNode(audioContext, { gain: 0 });
    this._high_out = new GainNode(audioContext, { gain: 0 });

    this._inNode.connect(this._in_out);
    this._in_out.connect(this._outNode);
    this._inNode.connect(this._in_low);
    this._in_low.connect(this._lowPass);
    this._inNode.connect(this._in_band);
    this._in_band.connect(this._bandPass);
    this._bandPass.connect(this._bandPassPeak);
    this._inNode.connect(this._in_high);
    this._in_high.connect(this._highPass);
    this._lowPass.connect(this._low_band);
    this._low_band.connect(this._bandPass);
    this._lowPass.connect(this._low_high);
    this._low_high.connect(this._highPass);
    this._bandPassPeak.connect(this._band_high);
    this._band_high.connect(this._highPass);
    this._lowPass.connect(this._low_out);
    this._low_out.connect(this._outNode);
    this._bandPassPeak.connect(this._band_out);
    this._band_out.connect(this._outNode);
    this._highPass.connect(this._high_out);
    this._high_out.connect(this._outNode);
  }

  get inNode(): GainNode {
    return this._inNode;
  }

  get lowPassFilter(): BiquadFilterNode {
    return this._lowPass;
  }

  get highPassFilter(): BiquadFilterNode {
    return this._highPass;
  }

  get bandPassFilter(): BiquadFilterNode {
    return this._bandPass;
  }

  get bandPassPeakFilter(): BiquadFilterNode {
    return this._bandPassPeak;
  }

  /**
   *
   * @param value 0-2047
   * @param startTime
   */
  c64Frequency(value: number, startTime: number = this._audioContext.currentTime) {
    this._highPass.frequency.setValueAtTime(getHighPassFrequency(value), startTime);
    this._lowPass.frequency.setValueAtTime(getLowPassFrequency(value), startTime);
    const bandPassFrequency = getBandPassFrequency(value);
    this._bandPass.frequency.setValueAtTime(bandPassFrequency, startTime);
    this._bandPassPeak.frequency.setValueAtTime(bandPassFrequency, startTime);
  }
  frequency(value: number, startTime: number = this._audioContext.currentTime) {
    this._highPass.frequency.setValueAtTime(value, startTime);
    this._lowPass.frequency.setValueAtTime(value, startTime);
    this._bandPass.frequency.setValueAtTime(value, startTime);
    this._bandPassPeak.frequency.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64Resonance(value: number, startTime: number = this._audioContext.currentTime) {
    this._highPass.Q.setValueAtTime(getHighPassResonance(value), startTime);
    this._lowPass.Q.setValueAtTime(getLowPassResonance(value), startTime);
    this._bandPassPeak.gain.setValueAtTime(getBandPassResonance(value), startTime);
  }
  resonance(value: number, startTime: number = this._audioContext.currentTime) {
    this._highPass.Q.setValueAtTime(value, startTime);
    this._lowPass.Q.setValueAtTime(value, startTime);
    this._bandPassPeak.gain.setValueAtTime(value, startTime);
  }

  /**
   *
   * @param value 0-7
   * @param startTime
   */
  c64FilterType(value: number, startTime: number = this._audioContext.currentTime) {
    const filterTypes: FilterMode[] = [];
    if ((value & 1) !== 0) {
      filterTypes.push('lowpass');
    }
    if ((value & 2) !== 0) {
      filterTypes.push('bandpass');
    }
    if ((value & 4) !== 0) {
      filterTypes.push('highpass');
    }
    this.filterType(filterTypes, startTime);
  }
  filterType(value: FilterMode[], startTime: number = this._audioContext.currentTime) {
    if (value.includes('lowpass') && value.includes('bandpass') && value.includes('highpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(1, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(1, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(1, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(1, startTime);
    } else if (value.includes('lowpass') && value.includes('bandpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(1, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(1, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(1, startTime);
      this._high_out.gain.setValueAtTime(0, startTime);
    } else if (value.includes('lowpass') && value.includes('highpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(1, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(1, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(1, startTime);
    } else if (value.includes('bandpass') && value.includes('highpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(0, startTime);
      this._in_band.gain.setValueAtTime(1, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(1, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(1, startTime);
    } else if (value.includes('lowpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(1, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(1, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(0, startTime);
    } else if (value.includes('bandpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(0, startTime);
      this._in_band.gain.setValueAtTime(1, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(1, startTime);
      this._high_out.gain.setValueAtTime(0, startTime);
    } else if (value.includes('highpass')) {
      this._in_out.gain.setValueAtTime(0, startTime);
      this._in_low.gain.setValueAtTime(0, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(1, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(1, startTime);
    } else {
      this._in_out.gain.setValueAtTime(1, startTime);
      this._in_low.gain.setValueAtTime(0, startTime);
      this._in_band.gain.setValueAtTime(0, startTime);
      this._in_high.gain.setValueAtTime(0, startTime);
      this._low_band.gain.setValueAtTime(0, startTime);
      this._low_high.gain.setValueAtTime(0, startTime);
      this._band_high.gain.setValueAtTime(0, startTime);
      this._low_out.gain.setValueAtTime(0, startTime);
      this._band_out.gain.setValueAtTime(0, startTime);
      this._high_out.gain.setValueAtTime(0, startTime);
    }
  }

  connect(destination: AudioNode) {
    this._outNode.connect(destination);
  }

  disconnect() {
    this._outNode.disconnect();
  }

  reset(startTime: number = this._audioContext.currentTime) {
    this._highPass.frequency.cancelScheduledValues(startTime);
    this._highPass.frequency.setValueAtTime(0, startTime);
    this._highPass.Q.cancelScheduledValues(startTime);
    this._highPass.Q.setValueAtTime(1, startTime);
    this._lowPass.frequency.cancelScheduledValues(startTime);
    this._lowPass.frequency.setValueAtTime(0, startTime);
    this._lowPass.Q.cancelScheduledValues(startTime);
    this._lowPass.Q.setValueAtTime(1, startTime);
    this._bandPass.frequency.cancelScheduledValues(startTime);
    this._bandPass.frequency.setValueAtTime(0, startTime);
    this._bandPassPeak.frequency.cancelScheduledValues(startTime);
    this._bandPassPeak.frequency.setValueAtTime(0, startTime);
    this._bandPassPeak.gain.cancelScheduledValues(startTime);
    this._bandPassPeak.gain.setValueAtTime(1, startTime);
    this._in_out.gain.cancelScheduledValues(startTime);
    this._in_out.gain.setValueAtTime(1, startTime);
    this._in_low.gain.cancelScheduledValues(startTime);
    this._in_low.gain.setValueAtTime(0, startTime);
    this._in_band.gain.cancelScheduledValues(startTime);
    this._in_band.gain.setValueAtTime(0, startTime);
    this._in_high.gain.cancelScheduledValues(startTime);
    this._in_high.gain.setValueAtTime(0, startTime);
    this._low_band.gain.cancelScheduledValues(startTime);
    this._low_band.gain.setValueAtTime(0, startTime);
    this._low_high.gain.cancelScheduledValues(startTime);
    this._low_high.gain.setValueAtTime(0, startTime);
    this._band_high.gain.cancelScheduledValues(startTime);
    this._band_high.gain.setValueAtTime(0, startTime);
    this._low_out.gain.cancelScheduledValues(startTime);
    this._low_out.gain.setValueAtTime(0, startTime);
    this._band_out.gain.cancelScheduledValues(startTime);
    this._band_out.gain.setValueAtTime(0, startTime);
    this._high_out.gain.cancelScheduledValues(startTime);
    this._high_out.gain.setValueAtTime(0, startTime);
  }
}

export class Sid {
  private _audioContext: AudioContext;
  private _mainGain: GainNode;
  private _oscillator: SidOscillator;
  private _voice1: SidVoice;
  private _voice2: SidVoice;
  private _voice3: SidVoice;
  private _filter: SidFilter;

  private _v1_gain: GainNode;
  private _v1_filter: GainNode;
  private _v1_main: GainNode;
  private _v2_gain: GainNode;
  private _v2_filter: GainNode;
  private _v2_main: GainNode;
  private _v3_gain: GainNode;
  private _v3_switch: GainNode;
  private _v3_filter: GainNode;
  private _v3_main: GainNode;

  constructor(audioContext: AudioContext = new AudioContext()) {
    this._audioContext = audioContext;
    this._mainGain = new GainNode(audioContext, { gain: 1 });
    this._oscillator = new SidOscillator(audioContext);
    this._voice1 = new SidVoice(audioContext, this._oscillator.voice1Params);
    this._voice2 = new SidVoice(audioContext, this._oscillator.voice2Params);
    this._voice3 = new SidVoice(audioContext, this._oscillator.voice3Params);
    this._filter = new SidFilter(audioContext);

    this._v1_gain = new GainNode(audioContext, { gain: 1 / 3 });
    this._v1_filter = new GainNode(audioContext, { gain: 0 });
    this._v1_main = new GainNode(audioContext, { gain: 1 });
    this._v2_gain = new GainNode(audioContext, { gain: 1 / 3 });
    this._v2_filter = new GainNode(audioContext, { gain: 0 });
    this._v2_main = new GainNode(audioContext, { gain: 1 });
    this._v3_gain = new GainNode(audioContext, { gain: 1 / 3 });
    this._v3_switch = new GainNode(audioContext, { gain: 1 });
    this._v3_filter = new GainNode(audioContext, { gain: 0 });
    this._v3_main = new GainNode(audioContext, { gain: 1 });

    this._oscillator.connect(this._voice1.inNode, 0);
    this._voice1.connect(this._v1_gain);
    this._v1_gain.connect(this._v1_filter);
    this._v1_filter.connect(this._filter.inNode);
    this._v1_gain.connect(this._v1_main);
    this._v1_main.connect(this._mainGain);
    this._oscillator.connect(this._voice2.inNode, 1);
    this._voice2.connect(this._v2_gain);
    this._v2_gain.connect(this._v2_filter);
    this._v2_filter.connect(this._filter.inNode);
    this._v2_gain.connect(this._v2_main);
    this._v2_main.connect(this._mainGain);
    this._oscillator.connect(this._voice3.inNode, 2);
    this._voice3.connect(this._v3_switch);
    this._v3_switch.connect(this._v3_gain);
    this._v3_gain.connect(this._v3_filter);
    this._v3_filter.connect(this._filter.inNode);
    this._v3_gain.connect(this._v3_main);
    this._v3_main.connect(this._mainGain);
    this._filter.connect(this._mainGain);
  }

  start(): Promise<void> {
    return this._audioContext.resume();
  }

  get voice1(): SidVoice {
    return this._voice1;
  }

  get voice2(): SidVoice {
    return this._voice2;
  }

  get voice3(): SidVoice {
    return this._voice3;
  }

  get voices(): SidVoice[] {
    return [this._voice1, this._voice2, this._voice3];
  }

  get filter(): SidFilter {
    return this._filter;
  }

  /**
   *
   * @param value 0-7
   * @param startTime
   */
  c64FilterVoice(value: number, startTime: number = this._audioContext.currentTime) {
    this.filterVoice(0, (value & 1) !== 0 ? 1 : 0, startTime);
    this.filterVoice(1, (value & 2) !== 0 ? 1 : 0, startTime);
    this.filterVoice(2, (value & 4) !== 0 ? 1 : 0, startTime);
  }
  filterVoice(voiceIndex: number, value: 0 | 1, startTime: number = this._audioContext.currentTime) {
    switch (voiceIndex) {
      case 0:
        this._v1_filter.gain.setValueAtTime(value, startTime);
        this._v1_main.gain.setValueAtTime(1 - value, startTime);
        break;
      case 1:
        this._v2_filter.gain.setValueAtTime(value, startTime);
        this._v2_main.gain.setValueAtTime(1 - value, startTime);
        break;
      case 2:
        this._v3_filter.gain.setValueAtTime(value, startTime);
        this._v3_main.gain.setValueAtTime(1 - value, startTime);
        break;
    }
  }

  /**
   *
   * @param value 0-1
   * @param startTime
   */
  c64Voice3Off(value: number, startTime: number = this._audioContext.currentTime) {
    this.voice3Off(Boolean(value), startTime);
  }
  voice3Off(value: boolean, startTime: number = this._audioContext.currentTime) {
    this._v3_switch.gain.setValueAtTime(value ? 0 : 1, startTime);
  }

  /**
   *
   * @param value 0-15
   * @param startTime
   */
  c64Volume(value: number, startTime: number = this._audioContext.currentTime) {
    this.volume(value / 15, startTime);
  }
  volume(value: number, startTime: number = this._audioContext.currentTime) {
    this._mainGain.gain.setValueAtTime(value, startTime);
  }

  connect(destination: AudioNode, output?: number, input?: number) {
    this._mainGain.connect(destination, output, input);
  }

  disconnect() {
    this._mainGain.disconnect();
  }

  reset(startTime: number = this._audioContext.currentTime) {
    this._mainGain.gain.cancelScheduledValues(startTime);
    this._mainGain.gain.setValueAtTime(1, startTime);
    this._voice1.reset(startTime);
    this._voice2.reset(startTime);
    this._voice3.reset(startTime);
    this._filter.reset(startTime);
    this._v1_gain.gain.cancelScheduledValues(startTime);
    this._v1_gain.gain.setValueAtTime(1 / 3, startTime);
    this._v1_filter.gain.cancelScheduledValues(startTime);
    this._v1_filter.gain.setValueAtTime(0, startTime);
    this._v1_main.gain.cancelScheduledValues(startTime);
    this._v1_main.gain.setValueAtTime(1, startTime);
    this._v2_gain.gain.cancelScheduledValues(startTime);
    this._v2_gain.gain.setValueAtTime(1 / 3, startTime);
    this._v2_filter.gain.cancelScheduledValues(startTime);
    this._v2_filter.gain.setValueAtTime(0, startTime);
    this._v2_main.gain.cancelScheduledValues(startTime);
    this._v2_main.gain.setValueAtTime(1, startTime);
    this._v3_gain.gain.cancelScheduledValues(startTime);
    this._v3_gain.gain.setValueAtTime(1 / 3, startTime);
    this._v3_switch.gain.cancelScheduledValues(startTime);
    this._v3_switch.gain.setValueAtTime(1, startTime);
    this._v3_filter.gain.cancelScheduledValues(startTime);
    this._v3_filter.gain.setValueAtTime(0, startTime);
    this._v3_main.gain.cancelScheduledValues(startTime);
    this._v3_main.gain.setValueAtTime(1, startTime);
  }
}
