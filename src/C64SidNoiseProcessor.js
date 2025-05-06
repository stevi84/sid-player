class C64SidNoiseProcessor extends AudioWorkletProcessor {
  /** @type {number} */
  #sampleRate;
  /** @type {number} */
  #syncOffset = 0;
  /** @type {number} */
  #phase = 0;
  /** @type {number} */
  #phase2 = 0;
  /** @type {number} */
  #sample = 0;
  /** @type {number} */
  #value = 0;

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

    for (let i = 0; i < bufferSize; i++) {
      values[i] = this.#value;
      // http://www.sidmusic.org/sid/sidtech5.html
      // phasePerSample*985248.6/0x100000/FREQUENCY_FACTOR
      this.#phase2 += 16 * phasePerSample;
      if (this.#phase2 >= 1) {
        this.#phase2 -= Math.floor(this.#phase2);
        this.#value = 2 * Math.random() - 1;
      }
      this.#phase += phasePerSample;
      if (this.#phase >= 1) {
        this.#syncOffset = this.#sample - (this.#phase - 1) / phasePerSample;
        this.#phase -= Math.floor(this.#phase);
      }
      this.#sample++;
    }
    this.port.postMessage({ syncOffset: this.#syncOffset });

    for (let channel = 0; channel < outputList[0].length; channel++) {
      const output = outputList[0][channel];
      for (let i = 0; i < bufferSize; i++) {
        output[i] = values[i];
      }
    }

    return true;
  }
}

registerProcessor('C64SidNoiseProcessor', C64SidNoiseProcessor);
