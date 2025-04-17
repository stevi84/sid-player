export type Duration = 'whl' | 'hlf' | 'qtr' | '8th' | '16th' | '32nd' | '64th' | 'utl' | 'utv';
export type Dotted = 'non' | 'sgl' | 'dbl';
export type Modifier = 'flt' | 'nat' | 'shp' | 'dbl';
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Note = 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b' | 'rst';
export type Waveform = 'pulse' | 'triangle' | 'sawtooth' | 'noise';
export type FilterMode = 'lowpass' | 'bandpass' | 'highpass';
export type Command =
  | { type: 'tal' | 'end' | 'hlt' }
  | {
      type: 'abs' | 'note';
      data: {
        duration: Duration;
        dotted: Dotted;
        tie: boolean;
        modifier: Modifier;
        octave: Octave;
        note: Note;
      };
    }
  | {
      type:
        | 'dcy'
        | 'rup'
        | 'cal'
        | 'def'
        | 'atk'
        | 'sus'
        | 'lfo'
        | 'rdn'
        | 'rls'
        | 'res'
        | 'vol'
        | 'src'
        | 'dst'
        | 'p-w'
        | 'tem'
        | 'utl'
        | 'pnt'
        | 'hed'
        | 'flg'
        | 'p-s'
        | 'f-s'
        | 'sca'
        | 'vdp'
        | 'vrt'
        | 'aut'
        | 'aux'
        | 'pvd'
        | 'pvr'
        | 'max'
        | 'utv'
        | 'f-c'
        | 'hld'
        | 'ms#'
        | 'jif'
        | 'dtn'
        | 'por'
        | 'tps';
      data: { value: number };
    }
  | { type: 'bmp'; data: { value: 'up' | 'down' } }
  | {
      type: 'flt' | 'rng' | 'snc' | 'f-x' | 'p&v' | '3-O';
      data: { value: 'yes' | 'no' };
    }
  | { type: 'wav'; data: { value: Waveform[] } }
  | { type: 'f-m'; data: { value: FilterMode[] } }
  | { type: 'rtp'; data: { octaves: number; halfsteps: number } };

const getCommand = (byte1: number, byte2: number): Command | undefined => {
  if ((byte1 & 3) === 0) {
    // Note
    let duration: Duration;
    switch (byte1 & 31) {
      case 0:
        duration = '64th';
        break;
      case 28:
        duration = '32nd';
        break;
      case 24:
        duration = '16th';
        break;
      case 20:
        duration = '8th';
        break;
      case 16:
        duration = 'qtr';
        break;
      case 12:
        duration = 'hlf';
        break;
      case 8:
      default:
        duration = 'whl';
        break;
    }
    let dotted: Dotted;
    switch (byte1 & 163) {
      case 32:
        dotted = 'sgl';
        break;
      case 160:
        dotted = 'dbl';
        break;
      default:
        dotted = 'non';
        break;
    }
    const tie: boolean = (byte1 & 67) === 64;
    if ((byte1 & 63) === 4) duration = 'utl';
    if ((byte1 & 63) === 36) duration = 'utv';
    if ((byte1 & 163) === 128) console.warn('triplet not implemented');
    if ((byte1 & 191) === 160) console.warn('triplet 64th note not implemented');

    let modifier: Modifier;
    switch (byte2 & 192) {
      case 192:
        modifier = 'flt';
        break;
      case 128:
      default:
        modifier = 'nat';
        break;
      case 64:
        modifier = 'shp';
        break;
      case 0:
        modifier = 'dbl';
        break;
    }
    let octave: Octave;
    switch (byte2 & 56) {
      case 56:
        octave = 0;
        break;
      case 48:
        octave = 1;
        break;
      case 40:
        octave = 2;
        break;
      case 32:
        octave = 3;
        break;
      case 24:
      default:
        octave = 4;
        break;
      case 16:
        octave = 5;
        break;
      case 8:
        octave = 6;
        break;
      case 0:
        octave = 7;
        break;
    }
    let note: Note;
    switch (byte2 & 7) {
      case 7:
        note = 'b';
        break;
      case 6:
        note = 'a';
        break;
      case 5:
        note = 'g';
        break;
      case 4:
        note = 'f';
        break;
      case 3:
        note = 'e';
        break;
      case 2:
        note = 'd';
        break;
      case 1:
      default:
        note = 'c';
        break;
      case 0:
        note = 'rst';
        break;
    }
    return {
      type: byte1 === 0 ? 'abs' : 'note',
      data: { duration, dotted, tie, modifier, octave, note },
    };
  } else if (byte1 === 1) {
    if ((byte2 & 15) === 0) {
      // Decay rate 0-15, default 0
      return { type: 'dcy', data: { value: (byte2 & 240) >>> 4 } };
    }
    if ((byte2 & 7) === 1) {
      return { type: 'rup', data: { value: (byte2 & 248) >>> 3 } };
    }
    if ((byte2 & 15) === 2) {
      // Call phrase 0-15, not defined phrase -> UNDEFINED PHRASE CALL, nesting possible 4 times
      // more -> STACK OVERFLOW, calling phrases from a different voice is possible
      return { type: 'cal', data: { value: (byte2 & 240) >>> 4 } };
    }
    if (byte2 === 3) {
      // Increase volume
      return { type: 'bmp', data: { value: 'up' } };
    }
    if (byte2 === 19) {
      // Filter voice
      return { type: 'flt', data: { value: 'no' } };
    }
    if (byte2 === 35) {
      // Ring modulation off
      return { type: 'rng', data: { value: 'no' } };
    }
    if (byte2 === 51) {
      // Synchronisation off
      return { type: 'snc', data: { value: 'no' } };
    }
    if (byte2 === 67) {
      // Filter external audio off
      return { type: 'f-x', data: { value: 'no' } };
    }
    if (byte2 === 83) {
      // Voice 3 on
      return { type: '3-O', data: { value: 'no' } };
    }
    if ((byte2 & 143) === 131) {
      // Define phrase 0-15, phrases can be defined inside another, phrase definition is 1
      // nesting level, phrases can be redefined
      return { type: 'def', data: { value: ((byte2 & 240) >>> 4) + 8 } };
    }
    if ((byte2 & 135) === 4) {
      // Attack rate 0-15, default 2
      return { type: 'atk', data: { value: (byte2 & 120) >>> 3 } };
    }
    if ((byte2 & 135) === 132) {
      // Sustain level 0-15, default 15
      return { type: 'sus', data: { value: (byte2 & 120) >>> 3 } };
    }
    if (byte2 === 99) {
      return { type: 'lfo', data: { value: 0 } };
    }
    if (byte2 === 115) {
      return { type: 'p&v', data: { value: 'no' } };
    }
    if ((byte2 & 7) === 5) {
      return { type: 'rdn', data: { value: (byte2 & 248) >>> 3 } };
    }
    if ((byte2 & 15) === 6) {
      // Define phrase 0-15
      return { type: 'def', data: { value: (byte2 & 240) >>> 4 } };
    }
    if ((byte2 & 31) === 7) {
      let value: Waveform[];
      switch (byte2 & 224) {
        case 0:
          value = ['noise'];
          break;
        case 32:
        default:
          value = ['triangle'];
          break;
        case 64:
          value = ['sawtooth'];
          break;
        case 96:
          value = ['triangle', 'sawtooth'];
          break;
        case 128:
          value = ['pulse'];
          break;
        case 160:
          value = ['pulse', 'triangle'];
          break;
        case 192:
          value = ['pulse', 'sawtooth'];
          break;
        case 224:
          value = ['pulse', 'triangle', 'sawtooth'];
          break;
      }
      // Waveform, default pulse
      return { type: 'wav', data: { value } };
    }
    if ((byte2 & 31) === 23) {
      let value: FilterMode[];
      switch (byte2 & 224) {
        case 0:
        default:
          value = [];
          break;
        case 32:
          value = ['lowpass'];
          break;
        case 64:
          value = ['bandpass'];
          break;
        case 96:
          value = ['lowpass', 'bandpass'];
          break;
        case 128:
          value = ['highpass'];
          break;
        case 160:
          value = ['highpass', 'lowpass'];
          break;
        case 192:
          value = ['highpass', 'bandpass'];
          break;
        case 224:
          value = ['highpass', 'lowpass', 'bandpass'];
          break;
      }
      // Filter mode
      return { type: 'f-m', data: { value } };
    }
    if ((byte2 & 15) === 8) {
      // Release rate 0-15, default 5
      return { type: 'rls', data: { value: (byte2 & 240) >>> 4 } };
    }
    if ((byte2 & 15) === 10) {
      // Filter resonance 0-15
      return { type: 'res', data: { value: (byte2 & 240) >>> 4 } };
    }
    if (byte2 === 11) {
      // Decrease volume
      return { type: 'bmp', data: { value: 'down' } };
    }
    if (byte2 === 27) {
      // Filter voice
      return { type: 'flt', data: { value: 'yes' } };
    }
    if (byte2 === 43) {
      // Ring modulation on
      return { type: 'rng', data: { value: 'yes' } };
    }
    if (byte2 === 59) {
      // Synchronisation on
      return { type: 'snc', data: { value: 'yes' } };
    }
    if (byte2 === 75) {
      // Filter external audio on
      return { type: 'f-x', data: { value: 'yes' } };
    }
    if (byte2 === 91) {
      // Voice 3 off
      return { type: '3-O', data: { value: 'yes' } };
    }
    if (byte2 === 107) {
      return { type: 'lfo', data: { value: 1 } };
    }
    if (byte2 === 123) {
      return { type: 'p&v', data: { value: 'yes' } };
    }
    if ((byte2 & 143) === 139) {
      // Call phrase 0-15
      return { type: 'cal', data: { value: ((byte2 & 240) >>> 4) + 8 } };
    }
    if ((byte2 & 15) === 14) {
      // Volume 0-15, default 8
      return { type: 'vol', data: { value: (byte2 & 240) >>> 4 } };
    }
    if (byte2 === 15) {
      // Repeat tail, tal without previous hed -> infinite loop to most recent hed/beginning
      return { type: 'tal' };
    }
    if (byte2 === 47) {
      // End phrase, end without previous def -> STACK UNDERFLOW
      return { type: 'end' };
    }
    if (byte2 === 79) {
      return { type: 'hlt' };
    }
    if ((byte2 & 159) === 31) {
      return { type: 'src', data: { value: (byte2 & 96) >>> 5 } };
    }
    if ((byte2 & 143) === 143) {
      let value: number;
      switch (byte2 & 112) {
        case 0:
        default:
          value = 0;
          break;
        case 32:
          value = 1;
          break;
        case 80:
          value = 2;
          break;
        case 96:
          value = 3;
          break;
      }
      return { type: 'dst', data: { value } };
    }
  } else {
    if ((byte1 & 15) === 2) {
      // Pulse width 0-4095, default 2048
      return { type: 'p-w', data: { value: ((byte1 & 240) << 4) + byte2 } };
    }
    if (byte1 === 6) {
      // Tempo 56-900, default 100
      return {
        type: 'tem',
        data: { value: Math.trunc(14400 / (byte2 !== 0 ? byte2 : 256)) },
      };
    }
    if (byte1 === 22) {
      // Utility duration 1-256, default 12
      return { type: 'utl', data: { value: byte2 !== 0 ? byte2 : 256 } };
    }
    if (byte1 === 38) {
      // Release point 0-255, default 4
      return { type: 'pnt', data: { value: byte2 } };
    }
    if (byte1 === 54) {
      // Repeat head 0-255, 0 -> infinite, no nesting of hed/tal
      return { type: 'hed', data: { value: byte2 } };
    }
    if (byte1 === 70) {
      return { type: 'flg', data: { value: byte2 } };
    }
    if (byte1 === 86) {
      // Pulse width sweeping -127-127
      return { type: 'p-s', data: { value: (byte2 << 24) >> 24 } };
    }
    if (byte1 === 102) {
      // Filter sweep -127-127
      return { type: 'f-s', data: { value: (byte2 << 24) >> 24 } };
    }
    if (byte1 === 110) {
      return { type: 'sca', data: { value: (byte2 << 24) >> 24 } };
    }
    if (byte1 === 118) {
      // Vibrato depth 0-255
      return { type: 'vdp', data: { value: byte2 } };
    }
    if (byte1 === 134) {
      // Vibrato rate 1-256
      return { type: 'vrt', data: { value: byte2 !== 0 ? byte2 : 256 } };
    }
    if (byte1 === 150) {
      // Auto filter voice -127-127
      return { type: 'aut', data: { value: (byte2 << 24) >> 24 } };
    }
    if (byte1 === 166) {
      // Transpose -95-95
      const sign = (byte2 & 1) === 0 ? 1 : -1;
      const octaves = (byte2 & 1) === 0 ? 7 - ((byte2 & 14) >>> 1) : (byte2 & 14) >>> 1;
      const halfsteps = (byte2 & 1) === 0 ? (byte2 & 240) >>> 4 : 11 - ((byte2 & 240) >>> 4);
      return { type: 'tps', data: { value: sign * (12 * octaves + halfsteps) } };
    }
    if (byte1 === 182) {
      // ignored
      return { type: 'aux', data: { value: byte2 } };
    }
    if (byte1 === 198) {
      return { type: 'pvd', data: { value: byte2 } };
    }
    if (byte1 === 214) {
      return { type: 'pvr', data: { value: byte2 } };
    }
    if (byte1 === 230) {
      return { type: 'max', data: { value: byte2 } };
    }
    if (byte1 === 246) {
      return { type: 'utv', data: { value: byte2 } };
    }
    if (byte1 === 14) {
      // Filter cutoff 0-255
      return { type: 'f-c', data: { value: byte2 } };
    }
    if (byte1 === 46) {
      return {
        type: 'rtp',
        data: {
          octaves: 3 - (byte2 & 7),
          halfsteps: ((byte2 & 248) >>> 3) - 11,
        },
      };
    }
    if (byte1 === 78) {
      return { type: 'hld', data: { value: byte2 } };
    }
    if (byte1 === 30 || byte1 === 94 || byte1 === 158 || byte1 === 222) {
      // Measure 0-999
      return { type: 'ms#', data: { value: ((byte1 & 192) << 2) + byte2 } };
    }
    if (byte1 === 62 || byte1 === 126 || byte1 === 190 || byte1 === 254) {
      let value = (byte2 << 2) + ((byte1 & 192) >>> 6);
      if (byte2 > 192) value = (value << 22) >> 22;
      return {
        type: 'jif',
        data: { value },
      };
    }
    if ((byte1 & 15) === 10) {
      // Detune -2047-2047
      return {
        type: 'dtn',
        data: {
          value: (byte1 & 16) === 0 ? ((byte1 & 224) << 3) + byte2 : ((byte1 & 224) << 3) + byte2 - 2048,
        },
      };
    }
    if ((byte1 & 3) === 3) {
      // Portamento
      return { type: 'por', data: { value: ((byte1 & 252) << 6) + byte2 } };
    }
  }
};

const trans: { [key: number]: string } = {
  0x3: 'stop',
  0x5: 'wht',
  0x8: 'shOff',
  0x9: 'shOn',
  0xd: '\n',
  0xe: 'lCase',
  0x11: 'down',
  0x12: 'rvsOn',
  0x13: 'home',
  0x14: 'del',
  0x1c: 'red',
  0x1d: 'right',
  0x1e: 'grn',
  0x1f: 'blu',
  0x20: ' ',
  0x21: '!',
  0x22: '"',
  0x23: '#',
  0x24: '$',
  0x25: '%',
  0x26: '&',
  0x27: "'",
  0x28: '(',
  0x29: ')',
  0x2a: '*',
  0x2b: '+',
  0x2c: ',',
  0x2d: '-',
  0x2e: '.',
  0x2f: '/',
  0x30: '0',
  0x31: '1',
  0x32: '2',
  0x33: '3',
  0x34: '4',
  0x35: '5',
  0x36: '6',
  0x37: '7',
  0x38: '8',
  0x39: '9',
  0x3a: ':',
  0x3b: ';',
  0x3c: '<',
  0x3d: '=',
  0x3e: '>',
  0x3f: '?',
  0x40: '@',
  0x41: 'A',
  0x42: 'B',
  0x43: 'C',
  0x44: 'D',
  0x45: 'E',
  0x46: 'F',
  0x47: 'G',
  0x48: 'H',
  0x49: 'I',
  0x4a: 'J',
  0x4b: 'K',
  0x4c: 'L',
  0x4d: 'M',
  0x4e: 'N',
  0x4f: 'O',
  0x50: 'P',
  0x51: 'Q',
  0x52: 'R',
  0x53: 'S',
  0x54: 'T',
  0x55: 'U',
  0x56: 'V',
  0x57: 'W',
  0x58: 'X',
  0x59: 'Y',
  0x5a: 'Z',
  0x5b: '[',
  0x5c: '£',
  0x5d: ']',
  0x5e: '↑',
  0x5f: '←',
  0x60: '─',
  0x61: '♠',
  0x62: '│',
  0x63: '─',
  0x64: '\u{1fb77}',
  0x65: '\u{1fb76}',
  0x66: '\u{1fb7a}',
  0x67: '\u{1fb71}',
  0x68: '\u{1fb74}',
  0x69: '╮',
  0x6a: '╰',
  0x6b: '╯',
  0x6c: '\u{1fb7c}',
  0x6d: '╲',
  0x6e: '╱',
  0x6f: '\u{1fb7d}',
  0x70: '\u{1fb7e}',
  0x71: '•',
  0x72: '\u{1fb7b}',
  0x73: '♥',
  0x74: '\u{1fb70}',
  0x75: '╭',
  0x76: '╳',
  0x77: '○',
  0x78: '♣',
  0x79: '\u{1fb75}',
  0x7a: '♦',
  0x7b: '┼',
  0x7c: '\u{1fb8c}',
  0x7d: '│',
  0x7e: 'π',
  0x7f: '◥',
  0x81: 'orng',
  0x83: 'run',
  0x85: 'f1',
  0x86: 'f3',
  0x87: 'f5',
  0x88: 'f7',
  0x89: 'f2',
  0x8a: 'f4',
  0x8b: 'f6',
  0x8c: 'f8',
  0x8d: 'shRtrn',
  0x8e: 'uCase',
  0x90: 'blk',
  0x91: 'up',
  0x92: 'rvsOff',
  0x93: 'clr',
  0x94: 'inst',
  0x95: 'brn',
  0x96: 'lred',
  0x97: 'dgry',
  0x98: 'mgry',
  0x99: 'lgrn',
  0x9a: 'lblu',
  0x9b: 'lgry',
  0x9c: 'pur',
  0x9d: 'left',
  0x9e: 'yel',
  0x9f: 'cyn',
  0xa0: ' ',
  0xa1: '▌',
  0xa2: '▄',
  0xa3: '▔',
  0xa4: '▁',
  0xa5: '▎',
  0xa6: '▒',
  0xa7: '\u{1fb87}',
  0xa8: '\u{1fb8f}',
  0xa9: '◤',
  0xaa: '\u{1fb87}',
  0xab: '├',
  0xac: '▗',
  0xad: '└',
  0xae: '┐',
  0xaf: '▂',
  0xb0: '┌',
  0xb1: '┴',
  0xb2: '┬',
  0xb3: '┤',
  0xb4: '▎',
  0xb5: '▍',
  0xb6: '\u{1fb88}',
  0xb7: '\u{1fb82}',
  0xb8: '\u{1fb83}',
  0xb9: '▃',
  0xba: '\u{1fb7f}',
  0xbb: '▖',
  0xbc: '▝',
  0xbd: '┘',
  0xbe: '▘',
  0xbf: '▚',
  0xc0: '─',
  0xc1: '♠',
  0xc2: '│',
  0xc3: '─',
  0xc4: '\u{1fb77}',
  0xc5: '\u{1fb76}',
  0xc6: '\u{1fb7a}',
  0xc7: '\u{1fb71}',
  0xc8: '\u{1fb74}',
  0xc9: '╮',
  0xca: '╰',
  0xcb: '╯',
  0xcc: '\u{1fb7c}',
  0xcd: '╲',
  0xce: '╱',
  0xcf: '\u{1fb7d}',
  0xd0: '\u{1fb7e}',
  0xd1: '•',
  0xd2: '\u{1fb7b}',
  0xd3: '♥',
  0xd4: '\u{1fb70}',
  0xd5: '╭',
  0xd6: '╳',
  0xd7: '○',
  0xd8: '♣',
  0xd9: '\u{1fb75}',
  0xda: '♦',
  0xdb: '┼',
  0xdc: '\u{1fb8c}',
  0xdd: '│',
  0xde: 'π',
  0xdf: '◥',
  0xe0: ' ',
  0xe1: '▌',
  0xe2: '▄',
  0xe3: '▔',
  0xe4: '▁',
  0xe5: '▎',
  0xe6: '▒',
  0xe7: '\u{1fb87}',
  0xe8: '\u{1fb8f}',
  0xe9: '◤',
  0xea: '\u{1fb87}',
  0xeb: '├',
  0xec: '▗',
  0xed: '└',
  0xee: '┐',
  0xef: '▂',
  0xf0: '┌',
  0xf1: '┴',
  0xf2: '┬',
  0xf3: '┤',
  0xf4: '▎',
  0xf5: '▍',
  0xf6: '\u{1fb88}',
  0xf7: '\u{1fb82}',
  0xf8: '\u{1fb83}',
  0xf9: '▃',
  0xfa: '\u{1fb7f}',
  0xfb: '▖',
  0xfc: '▝',
  0xfd: '┘',
  0xfe: '▘',
  0xff: 'π',
};

const readFileAsArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

export const parseSid = async (blob: Blob): Promise<{ voices: Command[][]; text: string[] }> => {
  const buffer = new DataView(await readFileAsArrayBuffer(blob));

  let i = 0;
  const startAddress = buffer.getUint16(i, true);
  i += 2;
  const voice1Length = buffer.getUint16(i, true);
  i += 2;
  const voice2Length = buffer.getUint16(i, true);
  i += 2;
  const voice3Length = buffer.getUint16(i, true);
  i += 2;
  const voice1Index = 8;
  const voice2Index = voice1Index + voice1Length;
  const voice3Index = voice2Index + voice2Length;
  const textIndex = voice3Index + voice3Length;

  const voice1: Command[] = [];
  for (let i = voice1Index; i < voice2Index; i += 2) {
    const byte1 = buffer.getUint8(i);
    const byte2 = buffer.getUint8(i + 1);
    const cmd = getCommand(byte1, byte2);
    if (!cmd) {
      console.error(`unknown command, voiceindex 0, index ${voice1.length}, byte1 ${byte1}, byte2 ${byte2}`);
      break;
    }
    voice1.push(cmd);
  }

  const voice2: Command[] = [];
  for (let i = voice2Index; i < voice3Index; i += 2) {
    const byte1 = buffer.getUint8(i);
    const byte2 = buffer.getUint8(i + 1);
    const cmd = getCommand(byte1, byte2);
    if (!cmd) {
      console.error(`unknown command, voiceindex 1, index ${voice2.length}, byte1 ${byte1}, byte2 ${byte2}`);
      break;
    }
    voice2.push(cmd);
  }

  const voice3: Command[] = [];
  for (let i = voice3Index; i < textIndex; i += 2) {
    const byte1 = buffer.getUint8(i);
    const byte2 = buffer.getUint8(i + 1);
    const cmd = getCommand(byte1, byte2);
    if (!cmd) {
      console.error(`unknown command, voiceindex 2, index ${voice3.length}, byte1 ${byte1}, byte2 ${byte2}`);
      break;
    }
    voice3.push(cmd);
  }

  const text: string[] = [];
  let line = '';
  for (let i = textIndex; i < buffer.byteLength; i++) {
    const byte = buffer.getUint8(i);
    if (byte === 0xd) {
      text.push(line);
      line = '';
    } else if (byte === 0x0) {
      if (line) text.push(line);
      break;
    } else {
      line += trans[byte] || '?';
    }
  }

  return { voices: [voice1, voice2, voice3], text };
};
