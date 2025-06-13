class C64SidProcessor extends AudioWorkletProcessor {
  /** @type {number} */
  #sampleRate;
  /** @type {number} */
  #voice1Phase = 0;
  /** @type {number} */
  #voice1Phase2 = 0;
  /** @type {number} */
  #voice1Value = 0;
  /** @type {number} */
  #voice2Phase = 0;
  /** @type {number} */
  #voice2Phase2 = 0;
  /** @type {number} */
  #voice2Value = 0;
  /** @type {number} */
  #voice3Phase = 0;
  /** @type {number} */
  #voice3Phase2 = 0;
  /** @type {number} */
  #voice3Value = 0;

  /**
   *
   * @param {{ numberOfInputs: number, numberOfOutputs: number, outputChannelCount: number[], parameterData: {[key: string]: number}, processorOptions: any }} options
   */
  constructor(options) {
    super();
    this.#sampleRate = options.processorOptions.sampleRate;
  }

  /**
   *
   * @returns {{ name: string, defaultValue?: number, minValue?: number, maxValue?: number, automationRate?: 'a-rate' | 'k-rate' }[]}
   */
  static get parameterDescriptors() {
    return [
      {
        name: 'waveform',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'adsrGain',
        defaultValue: 0,
        automationRate: 'a-rate',
      },
      {
        name: 'voice1Frequency',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice1Width',
        defaultValue: 0.5,
        automationRate: 'k-rate',
      },
      {
        name: 'voice1Sync',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice1Rng',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice2Frequency',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice2Width',
        defaultValue: 0.5,
        automationRate: 'k-rate',
      },
      {
        name: 'voice2Sync',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice2Rng',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice3Frequency',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice3Width',
        defaultValue: 0.5,
        automationRate: 'k-rate',
      },
      {
        name: 'voice3Sync',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'voice3Rng',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
    ];
  }

  /**
   *
   * @param {Float32Array[][]} _inputList
   * @param {Float32Array[][]} outputList
   * @param {Record<string, Float32Array>} parameters
   * @returns {boolean}
   */
  process(_inputList, outputList, parameters) {
    const bufferSize = outputList[0][0].length;
    const voice1TriangleValues = new Float32Array(bufferSize);
    const voice1SawtoothValues = new Float32Array(bufferSize);
    const voice1PulseValues = new Float32Array(bufferSize);
    const voice1NoiseValues = new Float32Array(bufferSize);
    const voice2TriangleValues = new Float32Array(bufferSize);
    const voice2SawtoothValues = new Float32Array(bufferSize);
    const voice2PulseValues = new Float32Array(bufferSize);
    const voice2NoiseValues = new Float32Array(bufferSize);
    const voice3TriangleValues = new Float32Array(bufferSize);
    const voice3SawtoothValues = new Float32Array(bufferSize);
    const voice3PulseValues = new Float32Array(bufferSize);
    const voice3NoiseValues = new Float32Array(bufferSize);
    const voice1PhasePerSample = parameters.voice1Frequency[0] / this.#sampleRate;
    const voice2PhasePerSample = parameters.voice2Frequency[0] / this.#sampleRate;
    const voice3PhasePerSample = parameters.voice3Frequency[0] / this.#sampleRate;
    const voice1PulseWidth = parameters.voice1PulseWidth[0];
    const voice2PulseWidth = parameters.voice2PulseWidth[0];
    const voice3PulseWidth = parameters.voice3PulseWidth[0];
    const voice1Sync = Boolean(parameters.voice1Sync[0]);
    const voice1Rng = Boolean(parameters.voice1Rng[0]);
    const voice2Sync = Boolean(parameters.voice2Sync[0]);
    const voice2Rng = Boolean(parameters.voice2Rng[0]);
    const voice3Sync = Boolean(parameters.voice3Sync[0]);
    const voice3Rng = Boolean(parameters.voice3Rng[0]);

    for (let i = 0; i < bufferSize; i++) {
      voice1TriangleValues[i] =
        (voice1Rng && this.#voice3Phase >= 0.5 ? -1 : 1) *
        (this.#voice1Phase < 0.5 ? 4 * this.#voice1Phase - 1 : 3 - 4 * this.#voice1Phase);
      voice1SawtoothValues[i] = 2 * this.#voice1Phase - 1;
      voice1PulseValues[i] = this.#voice1Phase < voice1PulseWidth ? -1 : 1;
      voice1NoiseValues[i] = this.#voice1Value;
      // http://www.sidmusic.org/sid/sidtech5.html
      // phasePerSample*985248.6/0x100000/FREQUENCY_FACTOR
      this.#voice1Phase2 += 16 * voice1PhasePerSample;
      if (this.#voice1Phase2 >= 1) {
        this.#voice1Phase2 -= Math.floor(this.#voice1Phase2);
        this.#voice1Value = 2 * Math.random() - 1;
      }
      this.#voice1Phase += voice1PhasePerSample;
      if (this.#voice1Phase >= 1) {
        if (voice2Sync) this.#voice2Phase = ((this.#voice1Phase - 1) / voice1PhasePerSample) * voice2PhasePerSample;
        this.#voice1Phase -= Math.floor(this.#voice1Phase);
      }

      voice2TriangleValues[i] =
        (voice2Rng && this.#voice1Phase >= 0.5 ? -1 : 1) *
        (this.#voice2Phase < 0.5 ? 4 * this.#voice2Phase - 1 : 3 - 4 * this.#voice2Phase);
      voice2SawtoothValues[i] = 2 * this.#voice2Phase - 1;
      voice2PulseValues[i] = this.#voice2Phase < voice2PulseWidth ? -1 : 1;
      voice2NoiseValues[i] = this.#voice2Value;
      this.#voice2Phase2 += 16 * voice2PhasePerSample;
      if (this.#voice2Phase2 >= 1) {
        this.#voice2Phase2 -= Math.floor(this.#voice2Phase2);
        this.#voice2Value = 2 * Math.random() - 1;
      }
      this.#voice2Phase += voice2PhasePerSample;
      if (this.#voice2Phase >= 1) {
        if (voice3Sync) this.#voice3Phase = ((this.#voice2Phase - 1) / voice2PhasePerSample) * voice3PhasePerSample;
        this.#voice2Phase -= Math.floor(this.#voice2Phase);
      }

      voice3TriangleValues[i] =
        (voice3Rng && this.#voice2Phase >= 0.5 ? -1 : 1) *
        (this.#voice3Phase < 0.5 ? 4 * this.#voice3Phase - 1 : 3 - 4 * this.#voice3Phase);
      voice3SawtoothValues[i] = 2 * this.#voice3Phase - 1;
      voice3PulseValues[i] = this.#voice3Phase < voice3PulseWidth ? -1 : 1;
      voice3NoiseValues[i] = this.#voice3Value;
      this.#voice3Phase2 += 16 * voice3PhasePerSample;
      if (this.#voice3Phase2 >= 1) {
        this.#voice3Phase2 -= Math.floor(this.#voice3Phase2);
        this.#voice3Value = 2 * Math.random() - 1;
      }
      this.#voice3Phase += voice3PhasePerSample;
      if (this.#voice3Phase >= 1) {
        if (voice1Sync) this.#voice1Phase = ((this.#voice3Phase - 1) / voice3PhasePerSample) * voice1PhasePerSample;
        this.#voice3Phase -= Math.floor(this.#voice3Phase);
      }

      // TODO Waveforms kombinieren (AND mit 16/24/32 bit oder Mittelwert von aktiven)
      // Kombination mit adsrGain multiplizieren
      // -> voice1Values -> 1 Output-Kanal
      // Zahl an Output Kanälen festlegen
      // Außerhalb diesen Prozessor einbauen, Output Kanäle splitten und weiter verarbeiten
      // 2 dieser Prozessoren für 2 Kanäle (links/rechts), einen standardmäßig verstecken -> dann mono auf beide Kanäle, sonst einer links einer rechts
    }

    for (let channel = 0; channel < outputList[0].length; channel++) {
      const output = outputList[0][channel];
      for (let i = 0; i < bufferSize; i++) {
        output[i] = values[i];
      }
    }

    return true;
  }
}

registerProcessor('C64SidProcessor', C64SidProcessor);
