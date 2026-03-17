import {
  FilterMode,
  FREQUENCY_FACTOR,
  getBandPassFrequency,
  getBandPassValue,
  getHighPassFrequency,
  getHighPassValue,
  getLowPassFrequency,
  getLowPassValue,
  Sid as SidClass,
  SidFilter,
  SidVoice,
} from './C64Sid';
import { Command, Dotted, Duration, Modifier, Note, Octave, parseSid } from './SidParse';

export const audioContext = new AudioContext();
await audioContext.audioWorklet.addModule('C64SidProcessor.js');
await audioContext.suspend();

// check for cancelAndHoldAtTime, not implemented in Mozilla Firefox
try {
  const testGain = audioContext.createGain();
  if (typeof testGain.gain.cancelAndHoldAtTime !== 'function')
    throw new Error('Unsupported browser: cancelAndHoldAtTime not available.');
} catch (e) {
  console.error('Error during feature detection:', e);
  document.getElementById('main-content')!.style.display = 'none';
  document.getElementById('unsupported-message')!.style.display = 'block';
  throw e;
}

const sidLeft = new SidClass(audioContext);
const sidRight = new SidClass(audioContext);
const merger = new ChannelMergerNode(audioContext, { numberOfInputs: 2 });
sidLeft.connect(audioContext.destination);

export const connectMono = () => {
  sidLeft.connect(audioContext.destination);
  sidRight.disconnect();
  merger.disconnect();
};

export const connectStereo = () => {
  sidLeft.connect(merger, 0, 0);
  sidRight.connect(merger, 0, 1);
  merger.connect(audioContext.destination);
};

const calcFrequency = (
  note: Note,
  modifier: Modifier,
  octave: Octave,
  detune: number,
  transpose: number
): { index: number; frequency: number } => {
  if (note === 'rst') return { index: -1, frequency: 0 };
  const noteMap: { [key in Note]: number } = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, rst: NaN };
  let index: number = noteMap[note];
  switch (modifier) {
    case 'flt':
      index--;
      break;
    case 'nat':
    default:
      break;
    case 'shp':
      index++;
      break;
    case 'dbl':
      if (['g', 'f', 'd', 'c'].includes(note)) {
        index += 2;
      } else if (['a', 'b', 'e'].includes(note)) {
        index -= 2;
      }
  }
  index += 12 * octave;
  index += transpose;
  const frequency = 440 * 2 ** ((index - 57) / 12) + detune * FREQUENCY_FACTOR;
  return { index, frequency };
};

const calcDuration = (
  duration: Duration,
  dotted: Dotted,
  tempo: number,
  utilityDuration: number,
  triplet: boolean,
  jif: number,
  utilityVoice: number,
): number => {
  let beats: number;
  let jiffies: number;
  if (duration === 'utl') {
    jiffies = utilityDuration;
  } else if (duration === 'utv') {
    jiffies = utilityVoice;
  } else {
    switch (duration) {
      case 'whl':
        beats = 4;
        break;
      case 'hlf':
        beats = 2;
        break;
      case 'qtr':
      default:
        beats = 1;
        break;
      case '8th':
        beats = 1 / 2;
        break;
      case '16th':
        beats = 1 / 4;
        break;
      case '32nd':
        beats = 1 / 8;
        break;
      case '64th':
        beats = 1 / 16;
        break;
    }
    switch (dotted) {
      case 'non':
      default:
        break;
      case 'sgl':
        beats *= 1.5;
        break;
      case 'dbl':
        beats *= 1.75;
        break;
    }
    if (triplet) beats *= 2 / 3;
    jiffies = (3600 / tempo) * beats;
  }
  const secsPerJiffy = (1 + jif / (266 + 2 / 3)) / 60;
  return jiffies * secsPerJiffy;
};

// Todo jif -> Changing the jiffy length also changes the sweep, portamento, vibrato, and modulation rates. Using the JIF command to double the tempo, for instance, also doubles the vibrato rate. 

const setFrequencyPortamentoVibrato = (
  voice: SidVoice,
  startTime: number,
  frequency: number,
  duration: number,
  portamento: { startFrequency: number; rate: number },
  vibrato: { depth: number; rate: number }
) => {
  if (portamento.rate === 0 && vibrato.depth === 0) {
    voice.frequency(frequency, startTime);
  } else if (portamento.rate !== 0) {
    const porRate = Math.sign(frequency - portamento.startFrequency) * portamento.rate * 60 * FREQUENCY_FACTOR;
    if (Math.abs(frequency - portamento.startFrequency) >= Math.abs(porRate * duration)) {
      const targetValue = portamento.startFrequency + porRate * duration;
      voice.frequency(portamento.startFrequency, startTime);
      voice.frequencyParam.linearRampToValueAtTime(targetValue, startTime + duration);
    } else {
      const porDuration = (frequency - portamento.startFrequency) / porRate;
      voice.frequency(portamento.startFrequency, startTime);
      voice.frequencyParam.linearRampToValueAtTime(frequency, startTime + porDuration);
      if (vibrato.depth !== 0)
        setFrequencyPortamentoVibrato(
          voice,
          startTime + porDuration,
          frequency,
          duration - porDuration,
          { ...portamento, rate: 0 },
          vibrato
        );
    }
  } else {
    const vibRate = vibrato.depth * 60 * FREQUENCY_FACTOR;
    const upperFreq = frequency + vibrato.depth * FREQUENCY_FACTOR * vibrato.rate;
    let time = 0;
    let up = true;
    voice.frequency(frequency, startTime);
    do {
      if (time + vibrato.rate / 60 < duration) {
        time += vibrato.rate / 60;
        if (up) {
          voice.frequencyParam.linearRampToValueAtTime(upperFreq, startTime + time);
          voice.frequency(upperFreq, startTime + time);
        } else {
          voice.frequencyParam.linearRampToValueAtTime(frequency, startTime + time);
          voice.frequency(frequency, startTime + time);
        }
      } else {
        if (up) {
          voice.frequencyParam.linearRampToValueAtTime(frequency + vibRate * (duration - time), startTime + duration);
          voice.frequency(frequency + vibRate * (duration - time), startTime + time);
        } else {
          voice.frequencyParam.linearRampToValueAtTime(upperFreq - vibRate * (duration - time), startTime + duration);
          voice.frequency(upperFreq - vibRate * (duration - time), startTime + time);
        }
        time = duration;
      }
      up = !up;
    } while (time < duration);
  }
};

const setPulseWidthSweep = (
  voice: SidVoice,
  startTime: number,
  startValue: number,
  sweepRate: number,
  duration: number
) => {
  const rate = sweepRate * 60;
  let time = 0;
  let value = startValue;
  voice.widthParam.setValueAtTime(startValue / 4095, startTime);
  do {
    if (rate > 0 && time + (4095 - value) / rate < duration) {
      time += (4095 - value) / rate;
      value = 0;
      voice.widthParam.linearRampToValueAtTime(1, startTime + time);
      voice.widthParam.setValueAtTime(0, startTime + time);
    } else if (rate < 0 && time - value / rate < duration) {
      time -= value / rate;
      value = 4095;
      voice.widthParam.linearRampToValueAtTime(0, startTime + time);
      voice.widthParam.setValueAtTime(1, startTime + time);
    } else {
      voice.widthParam.linearRampToValueAtTime((value + rate * (duration - time)) / 4095, startTime + duration);
      time = duration;
    }
  } while (time < duration);
  voice.widthParam.setValueAtTime(startValue / 4095, startTime + duration);
};

const getFilterSweepValues = (
  startValue: number,
  sweepRate: number,
  duration: number,
  calc: (value: number) => number
): number[] => {
  const endValue = startValue + sweepRate * duration;
  const count = Math.max(Math.floor(duration * 60), 2);
  const step = (endValue - startValue) / (count - 1);
  const values: number[] = [];
  let value = startValue;
  for (let i = 0; i < count; i++) {
    values.push(calc(value));
    value += step;
  }
  return values;
};

const setFilterFrequencyWidthSweep = (
  filter: SidFilter,
  startTime: number,
  startValue: number,
  sweepRate: number,
  duration: number
) => {
  const rate = sweepRate * 60;
  let time = 0;
  let value = startValue;
  filter.c64Frequency(startValue, startTime);
  do {
    if (rate > 0 && time + (2047 - value) / rate < duration) {
      // startTime, duration reduced otherwise:
      // Failed to execute 'setValueAtTime' on 'AudioParam': setValueAtTime(730.956, 1.8) overlaps setValueCurveAtTime(..., 1.476253236565001, 0.3237467634349995)
      const dur = (2047 - value) / rate;
      const redDur = dur - 2e-6;
      const lowPassValues = getFilterSweepValues(value, rate, redDur, getLowPassFrequency);
      filter.lowPassFilter.frequency.setValueCurveAtTime(lowPassValues, startTime + time + 1e-6, redDur);
      const highPassValues = getFilterSweepValues(value, rate, redDur, getHighPassFrequency);
      filter.highPassFilter.frequency.setValueCurveAtTime(highPassValues, startTime + time + 1e-6, redDur);
      const bandPassValues = getFilterSweepValues(value, rate, redDur, getBandPassFrequency);
      filter.bandPassFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      filter.bandPassPeakFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      time += dur;
      value = 0;
    } else if (rate < 0 && time - value / rate < duration) {
      const dur = -value / rate;
      const redDur = dur - 2e-6;
      const lowPassValues = getFilterSweepValues(value, rate, redDur, getLowPassFrequency);
      filter.lowPassFilter.frequency.setValueCurveAtTime(lowPassValues, startTime + time + 1e-6, redDur);
      const highPassValues = getFilterSweepValues(value, rate, redDur, getHighPassFrequency);
      filter.highPassFilter.frequency.setValueCurveAtTime(highPassValues, startTime + time + 1e-6, redDur);
      const bandPassValues = getFilterSweepValues(value, rate, redDur, getBandPassFrequency);
      filter.bandPassFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      filter.bandPassPeakFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      time += dur;
      value = 2047;
    } else {
      const dur = duration - time;
      const redDur = dur - 2e-6;
      const lowPassValues = getFilterSweepValues(value, rate, redDur, getLowPassFrequency);
      filter.lowPassFilter.frequency.setValueCurveAtTime(lowPassValues, startTime + time + 1e-6, redDur);
      const highPassValues = getFilterSweepValues(value, rate, redDur, getHighPassFrequency);
      filter.highPassFilter.frequency.setValueCurveAtTime(highPassValues, startTime + time + 1e-6, redDur);
      const bandPassValues = getFilterSweepValues(value, rate, redDur, getBandPassFrequency);
      filter.bandPassFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      filter.bandPassPeakFilter.frequency.setValueCurveAtTime(bandPassValues, startTime + time + 1e-6, redDur);
      time = duration;
    }
  } while (time < duration);
  filter.c64Frequency(startValue, startTime + duration);
};

const setAutoFilterFrequency = (
  filter: SidFilter,
  startTime: number,
  noteFrequency: number,
  autoFilter: number,
  filterModes: FilterMode[]
): number => {
  // TODO that's probably incorrect, but difficult to determine
  const filterFrequency = 2 * noteFrequency;
  let filterValue = filterModes.includes('lowpass')
    ? getLowPassValue(filterFrequency)
    : filterModes.includes('highpass')
      ? getHighPassValue(filterFrequency)
      : getBandPassValue(filterFrequency);
  filterValue = Math.max(Math.min(filterValue + autoFilter, 2047), 0);
  filter.c64Frequency(filterValue, startTime);
  return filterValue;
};

const initVoices = (sid: SidClass) => {
  const voices = sid.voices;
  for (let i = 0; i < voices.length; i++) {
    voices[i].c64Waveform(4);
    voices[i].c64AttackDuration(2);
    voices[i].c64DecayDuration(0);
    voices[i].c64SustainLevel(15);
    voices[i].c64ReleaseDuration(5);
    voices[i].c64PulseWidth(2048);
  }
  sid.c64Volume(8);
};

const logVoices = (voicesData: Command[][]) => {
  for (let i = 0; i < voicesData.length; i++) {
    for (let j = 0; j < voicesData[i].length; j++) {
      const cmd = voicesData[i][j];
      console.log(JSON.stringify({ voice: i, index: j }), JSON.stringify(cmd));
    }
  }
};

type CommandPointer = { voice: number; index: number };
type PhraseDefinition = { index: number; pointer: CommandPointer };
export type NoteViz = { start: number; stop: number; index: number };

const loadVoices = (
  sid: SidClass,
  voicesData: Command[][],
  startTime: number
): { duration: number; notes: NoteViz[][] } => {
  const voices = sid.voices;
  initVoices(sid);

  const notes: NoteViz[][] = [[], [], []];

  const currentTime = audioContext.currentTime;
  let globalTime = currentTime;
  let tempo = 100;
  let volume = 8;
  let utilityDuration = 12;
  let jiffy = 0;

  const voicesVars: Array<{
    cmdPointer: CommandPointer;
    callStack: { pointer: CommandPointer; cmd: 'def' | 'cal' }[];
    hed: { pointer: CommandPointer; count: number };
    time: number;
    releasePoint: number;
    detune: number;
    transpose: number;
    tie: boolean;
    portamentoRate: number;
    portamentoStartFrequency: number;
    pulseWidth: number;
    pulseWidthSweepRate: number;
    vibratoRate: number;
    vibratoDepth: number;
    filter: FilterMode[];
    filterFrequency: number;
    filterFrequencySweepRate: number;
    autoFilter: number;
    halt: boolean;
    utilityVoice: number;
    hold: number;
  }> = [];
  for (let i = 0; i < voices.length; i++) {
    voicesVars.push({
      cmdPointer: { voice: i, index: 0 },
      callStack: [],
      hed: { pointer: { voice: i, index: 0 }, count: 1 },
      time: currentTime,
      releasePoint: 4,
      detune: 0,
      transpose: 0,
      tie: false,
      portamentoRate: 0,
      portamentoStartFrequency: 0,
      pulseWidth: 2048,
      pulseWidthSweepRate: 0,
      vibratoRate: 0,
      vibratoDepth: 0,
      filter: [],
      filterFrequency: 0,
      filterFrequencySweepRate: 0,
      autoFilter: 0,
      halt: false,
      utilityVoice: 1,
      hold: 0,
    });
  }

  let voiceIndex = 0;

  const phrases: PhraseDefinition[] = [];
  for (let i = 0; i < voicesData.length; i++) {
    for (let j = 0; j < voicesData[i].length; j++) {
      const cmd = voicesData[i][j];
      if (cmd.type === 'def') phrases.push({ index: cmd.data.value, pointer: { voice: i, index: j } });
    }
  }

  do {
    let {
      cmdPointer,
      callStack,
      hed,
      time,
      releasePoint,
      detune,
      transpose,
      tie,
      portamentoRate,
      portamentoStartFrequency,
      pulseWidth,
      pulseWidthSweepRate,
      vibratoRate,
      vibratoDepth,
      filter,
      filterFrequency,
      filterFrequencySweepRate,
      autoFilter,
      halt,
      utilityVoice,
      hold,
    } = voicesVars[voiceIndex];
    while (!halt && cmdPointer.index < voicesData[cmdPointer.voice].length && time <= globalTime) {
      const cmd = voicesData[cmdPointer.voice][cmdPointer.index];
      // console.log(JSON.stringify(voiceIndex), JSON.stringify(cmdPointer), JSON.stringify(cmd));
      switch (cmd.type) {
        case 'tem':
          tempo = cmd.data.value;
          break;
        case 'utl':
          utilityDuration = cmd.data.value;
          break;
        case 'vol':
          volume = cmd.data.value;
          sid.c64Volume(volume, Math.max(time - startTime, currentTime));
          break;
        case 'bmp':
          if (cmd.data.value === 'up' && volume < 15) volume++;
          if (cmd.data.value === 'down' && volume > 0) volume--;
          sid.c64Volume(volume, Math.max(time - startTime, currentTime));
          break;
        case 'hed':
          hed = { pointer: { ...cmdPointer }, count: cmd.data.value - 1 };
          break;
        case 'tal':
          if (hed.count > 0) {
            cmdPointer = { ...hed.pointer };
            hed.count--;
          }
          break;
        case 'cal':
          const phrase = phrases.find((phr) => phr.index === cmd.data.value);
          if (!phrase) throw new Error(`UNDEFINED PHRASE CALL: ${JSON.stringify(cmdPointer)}, ${JSON.stringify(cmd)}`);
          callStack.push({ pointer: { ...cmdPointer }, cmd: 'cal' });
          if (callStack.length > 255)
            throw new Error(`STACK OVERFLOW: ${JSON.stringify(cmdPointer)}, ${JSON.stringify(cmd)}`);
          cmdPointer = { ...phrase.pointer };
          break;
        case 'def':
          callStack.push({ pointer: { ...cmdPointer }, cmd: 'def' });
          if (callStack.length > 255)
            throw new Error(`STACK OVERFLOW: ${JSON.stringify(cmdPointer)}, ${JSON.stringify(cmd)}`);
          break;
        case 'end':
          if (callStack.length === 0)
            throw new Error(`STACK UNDERFLOW: ${JSON.stringify(cmdPointer)}, ${JSON.stringify(cmd)}`);
          const pointer = callStack.pop()!;
          if (pointer.cmd === 'cal') cmdPointer = { ...pointer.pointer };
          break;
        case 'f-m':
          filter = cmd.data.value.slice();
          sid.filter.filterType(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'aut':
          autoFilter = cmd.data.value;
          break;
        case 'res':
          sid.filter.c64Resonance(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'flt':
          sid.filterVoice(voiceIndex, cmd.data.value === 'yes' ? 1 : 0, Math.max(time - startTime, currentTime));
          break;
        case 'f-s':
          filterFrequencySweepRate = cmd.data.value;
          break;
        case 'f-c':
          filterFrequency = cmd.data.value * 8;
          sid.filter.c64Frequency(filterFrequency, Math.max(time - startTime, currentTime));
          break;
        case 'f-x':
          // If you want to pass the external audio signal through the filter, use the F-X command.
          break;
        case 'atk':
          voices[voiceIndex].c64AttackDuration(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'dcy':
          voices[voiceIndex].c64DecayDuration(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'sus':
          voices[voiceIndex].c64SustainLevel(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'rls':
          voices[voiceIndex].c64ReleaseDuration(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'pnt':
          releasePoint = cmd.data.value;
          break;
        case 'wav':
          voices[voiceIndex].waveform(cmd.data.value, Math.max(time - startTime, currentTime));
          break;
        case 'p-w':
          pulseWidth = cmd.data.value;
          voices[voiceIndex].c64PulseWidth(pulseWidth, Math.max(time - startTime, currentTime));
          break;
        case 'p-s':
          pulseWidthSweepRate = cmd.data.value;
          break;
        case 'snc':
          voices[voiceIndex].sync(cmd.data.value === 'yes', Math.max(time - startTime, currentTime));
          break;
        case 'rng':
          voices[voiceIndex].rng(cmd.data.value === 'yes', Math.max(time - startTime, currentTime));
          break;
        case 'vdp':
          vibratoDepth = cmd.data.value;
          break;
        case 'vrt':
          vibratoRate = cmd.data.value;
          break;
        case 'por':
          portamentoRate = cmd.data.value;
          break;
        case 'dtn':
          detune = cmd.data.value;
          break;
        case 'tps':
          transpose = cmd.data.value;
          break;
        case 'ms#':
          // Measure markers have no effect when a voice is played and are used strictly for editing purposes.
          break;
        case '3-O':
          sid.voice3Off(cmd.data.value === 'yes', Math.max(time - startTime, currentTime));
          break;
        case 'flg':
          // For communication from Sidplayer to the BASIC program, the FLG command is available.
          break;
        case 'hlt':
          halt = true;
          break;
        case 'aux':
          // The AUX command is reserved for possible future expansion. At present, this command is ignored by Sidplayer.
          break;
        case 'note':
          const { index: noteIndex, frequency: noteFrequency } = calcFrequency(
            cmd.data.note,
            cmd.data.modifier,
            cmd.data.octave,
            detune,
            transpose
          );
          const duration = calcDuration(
            cmd.data.duration,
            cmd.data.dotted,
            tempo,
            utilityDuration,
            cmd.data.triplet,
            jiffy,
            utilityVoice,
          );
          if (time >= currentTime + startTime && noteFrequency !== 0) {
            setFrequencyPortamentoVibrato(
              voices[voiceIndex],
              time - startTime,
              noteFrequency,
              duration,
              { startFrequency: portamentoStartFrequency, rate: portamentoRate },
              { depth: vibratoDepth, rate: vibratoRate }
            );
            if (pulseWidthSweepRate !== 0)
              setPulseWidthSweep(voices[voiceIndex], time - startTime, pulseWidth, pulseWidthSweepRate, duration);
            if (autoFilter !== 0)
              filterFrequency = setAutoFilterFrequency(sid.filter, time - startTime, noteFrequency, autoFilter, filter);
            if (filterFrequencySweepRate !== 0)
              setFilterFrequencyWidthSweep(
                sid.filter,
                time - startTime,
                filterFrequency,
                filterFrequencySweepRate,
                duration
              );
            if (!tie) voices[voiceIndex].start(time - startTime);
            tie = cmd.data.tie;
            if (!tie) voices[voiceIndex].stop(time - startTime + Math.max(duration - releasePoint / 60, 0));
            // fill notes for display during playback
            if (noteIndex >= 0 && noteIndex <= 95)
              notes[voiceIndex].push({
                start: time - currentTime,
                stop: time - currentTime + Math.max(duration - releasePoint / 60, 0),
                index: noteIndex,
              });
          }
          time += duration;
          portamentoStartFrequency = noteFrequency;
          break;
        case 'abs':
          const { frequency: absFrequency } = calcFrequency(
            cmd.data.note,
            cmd.data.modifier,
            cmd.data.octave,
            detune,
            transpose
          );
          portamentoStartFrequency = absFrequency;
          break;
        case 'jif':
          jiffy = cmd.data.value;
          break;
        case 'utv':
          utilityVoice = cmd.data.value;
          break;
        case 'hld':
          hold = cmd.data.value;
          break;
        default:
          console.error(`${cmd.type} not implemented`);
          break;
      }
      cmdPointer.index++;
    }
    voicesVars[voiceIndex] = {
      cmdPointer,
      callStack,
      hed,
      time,
      releasePoint,
      detune,
      transpose,
      tie,
      portamentoRate,
      portamentoStartFrequency,
      pulseWidth,
      pulseWidthSweepRate,
      vibratoRate,
      vibratoDepth,
      filter,
      filterFrequency,
      filterFrequencySweepRate,
      autoFilter,
      halt,
      utilityVoice,
      hold,
    };
    if (time > globalTime) globalTime = time;
    voiceIndex++;
    if (voiceIndex >= voices.length) voiceIndex = 0;
  } while (voicesVars.some((v) => !v.halt && v.cmdPointer.index < voicesData[v.cmdPointer.voice].length));

  return { duration: Math.floor(Math.max(...voicesVars.map((v) => v.time - currentTime)) * 10) / 10, notes };
};

export type Channel = 'left' | 'right';

export const loadFile = async (
  channel: Channel,
  file: Blob
): Promise<{ voicesData: Command[][]; duration: number; text: number[]; notes: NoteViz[][] }> => {
  const sidData = await parseSid(file);
  const { duration, notes } = reloadVoices(channel, sidData.voices, 0);
  return { voicesData: sidData.voices, duration, text: sidData.text, notes };
};

export const reloadVoices = (
  channel: Channel,
  voicesData: Command[][],
  startTime: number
): { duration: number; notes: NoteViz[][] } => {
  const sid = channel === 'right' ? sidRight : sidLeft;
  sid.reset(0);
  // logVoices(voicesData);
  return loadVoices(sid, voicesData, startTime);
};
