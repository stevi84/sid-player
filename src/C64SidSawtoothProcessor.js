class C64SidSawtoothProcessor extends AudioWorkletProcessor {
  /** @type {number} */
  #sampleRate;
  /** @type {number} */
  #syncOffset = 0;
  /** @type {number} */
  #phase = 0;
  /** @type {number} */
  #syncPhase = 0;
  /** @type {number} */
  #sample = 0;

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
        name: 'frequency',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'sync',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'syncFrequency',
        defaultValue: 0,
        automationRate: 'k-rate',
      },
      {
        name: 'syncOffset',
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
    const values = new Float32Array(bufferSize);
    const phasePerSample = parameters.frequency[0] / this.#sampleRate;
    const sync = Boolean(parameters.sync[0]);

    const syncFrequency = parameters.syncFrequency[0];
    const syncOffset = parameters.syncOffset[0];
    const syncPhasePerSample = syncFrequency / this.#sampleRate;
    this.#syncPhase = (this.#sample - syncOffset) * syncPhasePerSample;
    this.#syncPhase -= Math.floor(this.#syncPhase);

    if (phasePerSample !== 0) {
      for (let i = 0; i < bufferSize; i++) {
        this.#sample++;

        this.#syncPhase += syncPhasePerSample;
        if (this.#syncPhase >= 1) {
          if (sync) {
            this.#syncOffset = this.#sample - (this.#syncPhase - 1) / syncPhasePerSample;
            this.#phase = ((this.#syncPhase - 1) / syncPhasePerSample) * phasePerSample;
          }
          this.#syncPhase -= Math.floor(this.#syncPhase);
        }

        values[i] = 2 * this.#phase - 1;

        this.#phase += phasePerSample;
        if (this.#phase >= 1) {
          this.#syncOffset = this.#sample - (this.#phase - 1) / phasePerSample;
          this.#phase -= Math.floor(this.#phase);
        }
      }
      this.port.postMessage({ type: 'sync', data: { frequency: parameters.frequency[0], offset: this.#syncOffset } });
    } else {
      values.fill(0);
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

registerProcessor('C64SidSawtoothProcessor', C64SidSawtoothProcessor);
