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
        triplet: boolean;
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
    if (duration === '64th') {
      // 64th notes cannot be dotted
      dotted = 'non';
    } else {
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
    }
    const tie: boolean = (byte1 & 67) === 64;
    if ((byte1 & 63) === 4) duration = 'utl';
    if ((byte1 & 63) === 36) duration = 'utv';
    let triplet: boolean = false;
    if ((byte1 & 163) === 128) triplet = true;
    // 64th triplet
    if ((byte1 & 191) === 160) triplet = true;

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
      data: { duration, dotted, tie, modifier, octave, note, triplet },
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
      // Jiffy length -200-757
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

export const trans: { [key: number]: string } = {
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
  0x20: ' ', //'\u{20}', // SPACE
  0x21: '!', //'\u{21}', // EXCLAMATION MARK
  0x22: '"', //'\u{22}', // QUOTATION MARK
  0x23: '#', //'\u{23}', // NUMBER SIGN
  0x24: '$', //'\u{24}', // DOLLAR SIGN
  0x25: '%', //'\u{25}', // PERCENT SIGN
  0x26: '&', //'\u{26}', // AMPERSAND
  0x27: "'", //'\u{27}', // APOSTROPHE
  0x28: '(', //'\u{28}', // LEFT PARENTHESIS
  0x29: ')', //'\u{29}', // RIGHT PARENTHESIS
  0x2a: '*', //'\u{2a}', // ASTERISK
  0x2b: '+', //'\u{2b}', // PLUS SIGN
  0x2c: ',', //'\u{2c}', // COMMA
  0x2d: '-', //'\u{2d}', // HYPHEN-MINUS
  0x2e: '.', //'\u{2e}', // FULL STOP
  0x2f: '/', //'\u{2f}', // SOLIDUS
  0x30: '0', //'\u{30}', // DIGIT ZERO
  0x31: '1', //'\u{31}', // DIGIT ONE
  0x32: '2', //'\u{32}', // DIGIT TWO
  0x33: '3', //'\u{33}', // DIGIT THREE
  0x34: '4', //'\u{34}', // DIGIT FOUR
  0x35: '5', //'\u{35}', // DIGIT FIVE
  0x36: '6', //'\u{36}', // DIGIT SIX
  0x37: '7', //'\u{37}', // DIGIT SEVEN
  0x38: '8', //'\u{38}', // DIGIT EIGHT
  0x39: '9', //'\u{39}', // DIGIT NINE
  0x3a: ':', //'\u{3a}', // COLON
  0x3b: ';', //'\u{3b}', // SEMICOLON
  0x3c: '<', //'\u{3c}', // LESS-THAN SIGN
  0x3d: '=', //'\u{3d}', // EQUALS SIGN
  0x3e: '>', //'\u{3e}', // GREATER-THAN SIGN
  0x3f: '?', //'\u{3f}', // QUESTION MARK
  0x40: '@', //'\u{40}', // COMMERCIAL AT
  0x41: 'A', //'\u{41}', // LATIN CAPITAL LETTER A
  0x42: 'B', //'\u{42}', // LATIN CAPITAL LETTER B
  0x43: 'C', //'\u{43}', // LATIN CAPITAL LETTER C
  0x44: 'D', //'\u{44}', // LATIN CAPITAL LETTER D
  0x45: 'E', //'\u{45}', // LATIN CAPITAL LETTER E
  0x46: 'F', //'\u{46}', // LATIN CAPITAL LETTER F
  0x47: 'G', //'\u{47}', // LATIN CAPITAL LETTER G
  0x48: 'H', //'\u{48}', // LATIN CAPITAL LETTER H
  0x49: 'I', //'\u{49}', // LATIN CAPITAL LETTER I
  0x4a: 'J', //'\u{4a}', // LATIN CAPITAL LETTER J
  0x4b: 'K', //'\u{4b}', // LATIN CAPITAL LETTER K
  0x4c: 'L', //'\u{4c}', // LATIN CAPITAL LETTER L
  0x4d: 'M', //'\u{4d}', // LATIN CAPITAL LETTER M
  0x4e: 'N', //'\u{4e}', // LATIN CAPITAL LETTER N
  0x4f: 'O', //'\u{4f}', // LATIN CAPITAL LETTER O
  0x50: 'P', //'\u{50}', // LATIN CAPITAL LETTER P
  0x51: 'Q', //'\u{51}', // LATIN CAPITAL LETTER Q
  0x52: 'R', //'\u{52}', // LATIN CAPITAL LETTER R
  0x53: 'S', //'\u{53}', // LATIN CAPITAL LETTER S
  0x54: 'T', //'\u{54}', // LATIN CAPITAL LETTER T
  0x55: 'U', //'\u{55}', // LATIN CAPITAL LETTER U
  0x56: 'V', //'\u{56}', // LATIN CAPITAL LETTER V
  0x57: 'W', //'\u{57}', // LATIN CAPITAL LETTER W
  0x58: 'X', //'\u{58}', // LATIN CAPITAL LETTER X
  0x59: 'Y', //'\u{59}', // LATIN CAPITAL LETTER Y
  0x5a: 'Z', //'\u{5a}', // LATIN CAPITAL LETTER Z
  0x5b: '[', //'\u{5b}', // LEFT SQUARE BRACKET
  0x5c: '£', //'\u{a3}', // POUND SIGN
  0x5d: ']', //'\u{5d}', // RIGHT SQUARE BRACKET
  0x5e: '↑', //'\u{2191}', // UPWARDS ARROW
  0x5f: '←', //'\u{2190}', // LEFTWARDS ARROW
  0x60: '─', //'\u{2500}', // BOX DRAWINGS LIGHT HORIZONTAL
  0x61: '♠', //'\u{2660}', // BLACK SPADE SUIT
  0x62: '🭲', //'\u{1fb72}', // VERTICAL ONE EIGHTH BLOCK-4
  0x63: '🭸', //'\u{1fb78}', // HORIZONTAL ONE EIGHTH BLOCK-4
  0x64: '🭷', //'\u{1fb77}', // HORIZONTAL ONE EIGHTH BLOCK-3
  0x65: '🭶', //'\u{1fb76}', // HORIZONTAL ONE EIGHTH BLOCK-2
  0x66: '🭺', //'\u{1fb7a}', // HORIZONTAL ONE EIGHTH BLOCK-6
  0x67: '🭱', //'\u{1fb71}', // VERTICAL ONE EIGHTH BLOCK-3
  0x68: '🭴', //'\u{1fb74}', // VERTICAL ONE EIGHTH BLOCK-6
  0x69: '╮', //'\u{256e}', // BOX DRAWINGS LIGHT ARC DOWN AND LEFT
  0x6a: '╰', //'\u{2570}', // BOX DRAWINGS LIGHT ARC UP AND RIGHT
  0x6b: '╯', //'\u{256f}', // BOX DRAWINGS LIGHT ARC UP AND LEFT
  0x6c: '🭼', //'\u{1fb7c}', // LEFT AND LOWER ONE EIGHTH BLOCK
  0x6d: '╲', //'\u{2572}', // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
  0x6e: '╱', //'\u{2571}', // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
  0x6f: '🭽', //'\u{1fb7d}', // LEFT AND UPPER ONE EIGHTH BLOCK
  0x70: '🭾', //'\u{1fb7e}', // RIGHT AND UPPER ONE EIGHTH BLOCK
  0x71: '•', //'\u{2022}', // BULLET
  0x72: '🭻', //'\u{1fb7b}', // HORIZONTAL ONE EIGHTH BLOCK-7
  0x73: '♥', //'\u{2665}', // BLACK HEART SUIT
  0x74: '🭰', //'\u{1fb70}', // VERTICAL ONE EIGHTH BLOCK-2
  0x75: '╭', //'\u{256d}', // BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
  0x76: '╳', //'\u{2573}', // BOX DRAWINGS LIGHT DIAGONAL CROSS
  0x77: '○', //'\u{25cb}', // WHITE CIRCLE
  0x78: '♣', //'\u{2663}', // BLACK CLUB SUIT
  0x79: '🭵', //'\u{1fb75}', // VERTICAL ONE EIGHTH BLOCK-7
  0x7a: '♦', //'\u{2666}', // BLACK DIAMOND SUIT
  0x7b: '┼', //'\u{253c}', // BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
  0x7c: '🮌', //'\u{1fb8c}', // LEFT HALF MEDIUM SHADE
  0x7d: '│', //'\u{2502}', // BOX DRAWINGS LIGHT VERTICAL
  0x7e: 'π', //'\u{3c0}', // GREEK SMALL LETTER PI
  0x7f: '◥', //'\u{25e5}', // BLACK UPPER RIGHT TRIANGLE
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
  0xa0: ' ', //'\u{20}', // SPACE
  0xa1: '▌', //'\u{258c}', // LEFT HALF BLOCK
  0xa2: '▄', //'\u{2584}', // LOWER HALF BLOCK
  0xa3: '▔', //'\u{2594}', // UPPER ONE EIGHTH BLOCK
  0xa4: '▁', //'\u{2581}', // LOWER ONE EIGHTH BLOCK
  0xa5: '▏', //'\u{258f}', // LEFT ONE EIGHTH BLOCK
  0xa6: '▒', //'\u{2592}', // MEDIUM SHADE
  0xa7: '▕', //'\u{2595}', // RIGHT ONE EIGHTH BLOCK
  0xa8: '🮏', //'\u{1fb8f}', // LOWER HALF MEDIUM SHADE
  0xa9: '◤', //'\u{25e4}', // BLACK UPPER LEFT TRIANGLE
  0xaa: '🮇', //'\u{1fb87}', // RIGHT ONE QUARTER BLOCK
  0xab: '├', //'\u{251c}', // BOX DRAWINGS LIGHT VERTICAL AND RIGHT
  0xac: '▗', //'\u{2597}', // QUADRANT LOWER RIGHT
  0xad: '└', //'\u{2514}', // BOX DRAWINGS LIGHT UP AND RIGHT
  0xae: '┐', //'\u{2510}', // BOX DRAWINGS LIGHT DOWN AND LEFT
  0xaf: '▂', //'\u{2582}', // LOWER ONE QUARTER BLOCK
  0xb0: '┌', //'\u{250c}', // BOX DRAWINGS LIGHT DOWN AND RIGHT
  0xb1: '┴', //'\u{2534}', // BOX DRAWINGS LIGHT UP AND HORIZONTAL
  0xb2: '┬', //'\u{252c}', // BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
  0xb3: '┤', //'\u{2524}', // BOX DRAWINGS LIGHT VERTICAL AND LEFT
  0xb4: '▎', //'\u{258e}', // LEFT ONE QUARTER BLOCK
  0xb5: '▍', //'\u{258d}', // LEFT THREE EIGHTHS BLOCK
  0xb6: '🮈', //'\u{1fb88}', // RIGHT THREE EIGHTHS BLOCK
  0xb7: '🮂', //'\u{1fb82}', // UPPER ONE QUARTER BLOCK
  0xb8: '🮃', //'\u{1fb83}', // UPPER THREE EIGHTHS BLOCK
  0xb9: '▃', //'\u{2583}', // LOWER THREE EIGHTHS BLOCK
  0xba: '🭿', //'\u{1fb7f}', // RIGHT AND LOWER ONE EIGHTH BLOCK
  0xbb: '▖', //'\u{2596}', // QUADRANT LOWER LEFT
  0xbc: '▝', //'\u{259d}', // QUADRANT UPPER RIGHT
  0xbd: '┘', //'\u{2518}', // BOX DRAWINGS LIGHT UP AND LEFT
  0xbe: '▘', //'\u{2598}', // QUADRANT UPPER LEFT
  0xbf: '▚', //'\u{259a}', // QUADRANT UPPER LEFT AND LOWER RIGHT
  0xc0: '─', //'\u{2500}', // BOX DRAWINGS LIGHT HORIZONTAL
  0xc1: '♠', //'\u{2660}', // BLACK SPADE SUIT
  0xc2: '🭲', //'\u{1fb72}', // VERTICAL ONE EIGHTH BLOCK-4
  0xc3: '🭸', //'\u{1fb78}', // HORIZONTAL ONE EIGHTH BLOCK-4
  0xc4: '🭷', //'\u{1fb77}', // HORIZONTAL ONE EIGHTH BLOCK-3
  0xc5: '🭶', //'\u{1fb76}', // HORIZONTAL ONE EIGHTH BLOCK-2
  0xc6: '🭺', //'\u{1fb7a}', // HORIZONTAL ONE EIGHTH BLOCK-6
  0xc7: '🭱', //'\u{1fb71}', // VERTICAL ONE EIGHTH BLOCK-3
  0xc8: '🭴', //'\u{1fb74}', // VERTICAL ONE EIGHTH BLOCK-6
  0xc9: '╮', //'\u{256e}', // BOX DRAWINGS LIGHT ARC DOWN AND LEFT
  0xca: '╰', //'\u{2570}', // BOX DRAWINGS LIGHT ARC UP AND RIGHT
  0xcb: '╯', //'\u{256f}', // BOX DRAWINGS LIGHT ARC UP AND LEFT
  0xcc: '🭼', //'\u{1fb7c}', // LEFT AND LOWER ONE EIGHTH BLOCK
  0xcd: '╲', //'\u{2572}', // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
  0xce: '╱', //'\u{2571}', // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
  0xcf: '🭽', //'\u{1fb7d}', // LEFT AND UPPER ONE EIGHTH BLOCK
  0xd0: '🭾', //'\u{1fb7e}', // RIGHT AND UPPER ONE EIGHTH BLOCK
  0xd1: '•', //'\u{2022}', // BULLET
  0xd2: '🭻', //'\u{1fb7b}', // HORIZONTAL ONE EIGHTH BLOCK-7
  0xd3: '♥', //'\u{2665}', // BLACK HEART SUIT
  0xd4: '🭰', //'\u{1fb70}', // VERTICAL ONE EIGHTH BLOCK-2
  0xd5: '╭', //'\u{256d}', // BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
  0xd6: '╳', //'\u{2573}', // BOX DRAWINGS LIGHT DIAGONAL CROSS
  0xd7: '○', //'\u{25cb}', // WHITE CIRCLE
  0xd8: '♣', //'\u{2663}', // BLACK CLUB SUIT
  0xd9: '🭵', //'\u{1fb75}', // VERTICAL ONE EIGHTH BLOCK-7
  0xda: '♦', //'\u{2666}', // BLACK DIAMOND SUIT
  0xdb: '┼', //'\u{253c}', // BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
  0xdc: '🮌', //'\u{1fb8c}', // LEFT HALF MEDIUM SHADE
  0xdd: '│', //'\u{2502}', // BOX DRAWINGS LIGHT VERTICAL
  0xde: 'π', //'\u{3c0}', // GREEK SMALL LETTER PI
  0xdf: '◥', //'\u{25e5}', // BLACK UPPER RIGHT TRIANGLE
  0xe0: ' ', //'\u{20}', // SPACE
  0xe1: '▌', //'\u{258c}', // LEFT HALF BLOCK
  0xe2: '▄', //'\u{2584}', // LOWER HALF BLOCK
  0xe3: '▔', //'\u{2594}', // UPPER ONE EIGHTH BLOCK
  0xe4: '▁', //'\u{2581}', // LOWER ONE EIGHTH BLOCK
  0xe5: '▏', //'\u{258f}', // LEFT ONE EIGHTH BLOCK
  0xe6: '▒', //'\u{2592}', // MEDIUM SHADE
  0xe7: '▕', //'\u{2595}', // RIGHT ONE EIGHTH BLOCK
  0xe8: '🮏', //'\u{1fb8f}', // LOWER HALF MEDIUM SHADE
  0xe9: '◤', //'\u{25e4}', // BLACK UPPER LEFT TRIANGLE
  0xea: '🮇', //'\u{1fb87}', // RIGHT ONE QUARTER BLOCK
  0xeb: '├', //'\u{251c}', // BOX DRAWINGS LIGHT VERTICAL AND RIGHT
  0xec: '▗', //'\u{2597}', // QUADRANT LOWER RIGHT
  0xed: '└', //'\u{2514}', // BOX DRAWINGS LIGHT UP AND RIGHT
  0xee: '┐', //'\u{2510}', // BOX DRAWINGS LIGHT DOWN AND LEFT
  0xef: '▂', //'\u{2582}', // LOWER ONE QUARTER BLOCK
  0xf0: '┌', //'\u{250c}', // BOX DRAWINGS LIGHT DOWN AND RIGHT
  0xf1: '┴', //'\u{2534}', // BOX DRAWINGS LIGHT UP AND HORIZONTAL
  0xf2: '┬', //'\u{252c}', // BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
  0xf3: '┤', //'\u{2524}', // BOX DRAWINGS LIGHT VERTICAL AND LEFT
  0xf4: '▎', //'\u{258e}', // LEFT ONE QUARTER BLOCK
  0xf5: '▍', //'\u{258d}', // LEFT THREE EIGHTHS BLOCK
  0xf6: '🮈', //'\u{1fb88}', // RIGHT THREE EIGHTHS BLOCK
  0xf7: '🮂', //'\u{1fb82}', // UPPER ONE QUARTER BLOCK
  0xf8: '🮃', //'\u{1fb83}', // UPPER THREE EIGHTHS BLOCK
  0xf9: '▃', //'\u{2583}', // LOWER THREE EIGHTHS BLOCK
  0xfa: '🭿', //'\u{1fb7f}', // RIGHT AND LOWER ONE EIGHTH BLOCK
  0xfb: '▖', //'\u{2596}', // QUADRANT LOWER LEFT
  0xfc: '▝', //'\u{259d}', // QUADRANT UPPER RIGHT
  0xfd: '┘', //'\u{2518}', // BOX DRAWINGS LIGHT UP AND LEFT
  0xfe: '▘', //'\u{2598}', // QUADRANT UPPER LEFT
  0xff: 'π', //'\u{3c0}', // GREEK SMALL LETTER PI
};

const readFileAsArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });

export const parseSid = async (blob: Blob): Promise<{ voices: Command[][]; text: number[] }> => {
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
    if (cmd) {
      voice1.push(cmd);
    } else {
      console.error(`unknown command, voiceindex 0, index ${voice1.length}, byte1 ${byte1}, byte2 ${byte2}`);
    }
  }

  const voice2: Command[] = [];
  for (let i = voice2Index; i < voice3Index; i += 2) {
    const byte1 = buffer.getUint8(i);
    const byte2 = buffer.getUint8(i + 1);
    const cmd = getCommand(byte1, byte2);
    if (cmd) {
      voice2.push(cmd);
    } else {
      console.error(`unknown command, voiceindex 1, index ${voice2.length}, byte1 ${byte1}, byte2 ${byte2}`);
    }
  }

  const voice3: Command[] = [];
  for (let i = voice3Index; i < textIndex; i += 2) {
    const byte1 = buffer.getUint8(i);
    const byte2 = buffer.getUint8(i + 1);
    const cmd = getCommand(byte1, byte2);
    if (cmd) {
      voice3.push(cmd);
    } else {
      console.error(`unknown command, voiceindex 2, index ${voice3.length}, byte1 ${byte1}, byte2 ${byte2}`);
    }
  }

  const text: number[] = [];
  for (let i = textIndex; i < buffer.byteLength; i++) {
    const byte = buffer.getUint8(i);
    text.push(byte);
  }

  return { voices: [voice1, voice2, voice3], text };
};
