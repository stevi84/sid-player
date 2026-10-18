import { colorTable } from './C64CharMap';
import { audioContext, Channel, connectMono, connectStereo, Flag, loadFile, NoteViz, reloadVoices } from './SidLoad';
import { Command, readFileAsArrayBuffer, trans, transWds } from './SidParse';

const keyDivs: HTMLDivElement[] = [];
for (let i = 0; i < 96; i++) keyDivs[i] = document.getElementById(`k${i}`) as HTMLDivElement;
const text: HTMLDivElement = document.getElementById('text') as HTMLDivElement;
const textLines: HTMLParagraphElement[] = [];
for (let i = 0; i < 5; i++) textLines[i] = document.getElementById(`line${i}`) as HTMLParagraphElement;
const fileSelect = document.getElementById('fileSelect') as HTMLSelectElement;
const openFileLabel = document.getElementById('openFileLabel') as HTMLLabelElement;
const openFileInput = document.getElementById('openFile') as HTMLInputElement;
const clearButton = document.getElementById('clear') as HTMLButtonElement;
const playPauseButton = document.getElementById('playPause') as HTMLButtonElement;
const currentSpan = document.getElementById('current') as HTMLSpanElement;
const timeSlider = document.getElementById('timeslider') as HTMLInputElement;
const durationSpan = document.getElementById('duration') as HTMLSpanElement;

type State = {
  isLoading: boolean;
  isPlaying: boolean;
  durationLeft: number;
  voicesDataLeft: Command[][];
  durationRight: number;
  voicesDataRight: Command[][];
  fileSelectValue: string;
  openFileValue: string;
  notes: NoteViz[][];
  currentNotes: number[];
  text: number[];
  flags: Flag[];
  currentFlag: number;
  singAlongTitle: number[];
  singAlongText: number[][];
  startTime: number;
  currentTime: number;
  audioContextStartTime: number;
};
const internalState: State = {
  isLoading: false,
  isPlaying: false,
  durationLeft: 0,
  voicesDataLeft: [],
  durationRight: 0,
  voicesDataRight: [],
  fileSelectValue: '',
  openFileValue: '',
  notes: [[], [], [], [], [], []],
  currentNotes: [-1, -1, -1, -1, -1, -1],
  text: [],
  flags: [],
  currentFlag: -1,
  singAlongTitle: [],
  singAlongText: [],
  startTime: 0,
  currentTime: 0,
  audioContextStartTime: audioContext.currentTime,
};
const handler: ProxyHandler<State> = {
  set(target: State, property: keyof State, value: any) {
    if (['notes', 'currentNotes'].includes(property)) {
      for (let i = 0; i < 6; i++) {
        clearKeyColor(
          target.currentNotes[i] >= 0 && target.notes[i].length > 0 ? target.notes[i][target.currentNotes[i]].index : -1
        );
      }
    }

    (target as any)[property] = value;

    if (['notes', 'currentNotes', 'currentTime'].includes(property)) {
      updateUiKeyboard();
    }
    if (['text', 'flags', 'singAlongTitle', 'singAlongText', 'currentTime'].includes(property)) {
      updateUiText();
    }
    if (['fileSelectValue', 'openFileValue'].includes(property)) {
      updateUiFileSelects();
    }
    if (
      ['isLoading', 'isPlaying', 'durationLeft', 'voicesDataLeft', 'durationRight', 'currentTime'].includes(property)
    ) {
      updateUiPlayArea();
    }

    if (['notes'].includes(property)) {
      if (
        (target.notes[0].length > 0 || target.notes[1].length > 0 || target.notes[2].length > 0) &&
        (target.notes[3].length > 0 || target.notes[4].length > 0 || target.notes[5].length > 0)
      ) {
        connectStereo();
      } else {
        connectMono();
      }
    }

    return true;
  },
};
export const state: State = new Proxy(internalState, handler);

const getDuration = (): number => Math.max(state.durationLeft, state.durationRight);

const getTimeString = (value: number): string => {
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value - 60 * mins);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const backgroundColor: string = 'rgb(0, 0, 0)';
const getColoredText = (text: string, textColor: string, reverse: boolean) => {
  const span = document.createElement('span') as HTMLSpanElement;
  span.style.color = reverse ? backgroundColor : textColor;
  span.style.backgroundColor = reverse ? textColor : backgroundColor;
  span.innerText = text;
  return span;
};

const getFilenameFromString = (path: string): string => path.replace(/^.*[\\/]/, '');

const getTextLine = (
  bytes: number[],
  color: string,
  trans: { [key: number]: string },
  lineLength: number = 32
): { line: HTMLSpanElement[]; color: string } => {
  let line: HTMLSpanElement[] = [];
  let pos: number = 0;
  let reverse: boolean = false;

  textLoop: for (const byte of bytes) {
    switch (byte) {
      case 0x0:
        // end of text
        break textLoop;
      case 0x1:
      case 0x2:
      case 0x3:
      case 0x4:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x5:
        // wht
        color = colorTable['wht'].rgba();
        break;
      case 0x6:
      case 0x7:
      case 0x8:
      case 0x9:
      case 0xa:
      case 0xb:
      case 0xc:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0xd:
        // new line
        break textLoop;
      case 0xe:
      case 0xf:
      case 0x10:
      case 0x11:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x12:
        // rvsOn
        reverse = true;
        break;
      case 0x13:
        // ignored control character
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x14:
        // del
        if (pos > 0) {
          line.splice(pos - 1, 1);
          pos--;
        } else {
          console.warn('Cannot delete');
        }
        break;
      case 0x15:
      case 0x16:
      case 0x17:
      case 0x18:
      case 0x19:
      case 0x1a:
      case 0x1b:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x1c:
        // red
        color = colorTable['red'].rgba();
        break;
      case 0x1d:
        // ignored control character
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x1e:
        // grn
        color = colorTable['grn'].rgba();
        break;
      case 0x1f:
        // blu
        color = colorTable['blu'].rgba();
        break;
      case 0x80:
        // ignored control character
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x81:
        // orng
        color = colorTable['orng'].rgba();
        break;
      case 0x82:
      case 0x83:
      case 0x84:
      case 0x85:
      case 0x86:
      case 0x87:
      case 0x88:
      case 0x89:
      case 0x8a:
      case 0x8b:
      case 0x8c:
      case 0x8d:
      case 0x8e:
      case 0x8f:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x90:
        // blk
        color = colorTable['blk'].rgba();
        break;
      case 0x91:
        // ignored control character
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x92:
        // rvsOff
        reverse = false;
        break;
      case 0x93:
      case 0x94:
        // ignored control characters
        console.warn(`Ignored control character: ${byte}`);
        break;
      case 0x95:
        // brn
        color = colorTable['brn'].rgba();
        break;
      case 0x96:
        // lred
        color = colorTable['lred'].rgba();
        break;
      case 0x97:
        // dgry
        color = colorTable['dgry'].rgba();
        break;
      case 0x98:
        // mgry
        color = colorTable['mgry'].rgba();
        break;
      case 0x99:
        // lgrn
        color = colorTable['lgrn'].rgba();
        break;
      case 0x9a:
        // lblu
        color = colorTable['lblu'].rgba();
        break;
      case 0x9b:
        // lgry
        color = colorTable['lgry'].rgba();
        break;
      case 0x9c:
        // pur
        color = colorTable['pur'].rgba();
        break;
      case 0x9d:
        // left
        if (pos > 0) {
          pos--;
        } else {
          console.warn('Cannot move left');
        }
        break;
      case 0x9e:
        // yel
        color = colorTable['yel'].rgba();
        break;
      case 0x9f:
        // cyn
        color = colorTable['cyn'].rgba();
        break;
      default:
        if (pos === line.length) {
          line.push(getColoredText(trans[byte] || '?', color, reverse));
          pos++;
        } else {
          line.splice(pos, 1, getColoredText(trans[byte] || '?', color, reverse));
          pos++;
        }
        break;
    }
  }

  line.length < lineLength &&
    line.push(
      ...Array(lineLength - line.length)
        .fill(' ')
        .map((e) => getColoredText(e, color, false))
    );

  return { line, color };
};

const updateUiKeyboard = () => {
  for (let i = 0; i < 6; i++) {
    if (state.notes[i].length !== 0) {
      const currentTime = state.currentTime;
      const note: NoteViz | undefined = state.currentNotes[i] >= 0 ? state.notes[i][state.currentNotes[i]] : undefined;
      if (!note || currentTime < note.start || currentTime >= note.stop) {
        clearKeyColor((note && note.index) || -1);
        let index: number = -1;
        for (let j = 0; j < state.notes[i].length; j++) {
          if (currentTime >= state.notes[i][j].start && currentTime < state.notes[i][j].stop) {
            index = j;
            break;
          }
        }
        internalState.currentNotes[i] = index;
        if (index > 0) setKeyColor(state.notes[i][index].index, i);
      }
    }
  }
};
const updateUiText = () => {
  if (state.currentTime === 0 || state.singAlongText.length === 0) {
    // text from sid file
    // when there is a wds file this is shown only in the very beginning
    for (let i = 0; i < 5; i++) textLines[i].textContent = '';
    text.classList.remove('singAlongText');
    text.classList.add('text');
    internalState.currentFlag = -1;

    let line: number[] = [];
    const lines: number[][] = [];
    for (let i = 0; i < state.text.length; i++) {
      const byte = state.text[i];
      switch (byte) {
        case 0xd:
          // new line
          lines.push(line);
          line = [];
          break;
        default:
          line.push(byte);
          break;
      }
    }

    let color: string = colorTable['wht'].rgba();
    for (let i = 0; i < 5; i++) {
      const { line: textLine, color: returnColor } = getTextLine(lines[i] || [], color, trans);
      textLines[i].append(...textLine);
      color = returnColor;
    }
  } else {
    // text from wds file
    const currentTime = state.currentTime;
    const flag: Flag | undefined = state.currentFlag >= 0 ? state.flags[state.currentFlag] : undefined;
    if (!flag || currentTime < flag.start || currentTime >= flag.stop) {
      for (let i = 0; i < 5; i++) textLines[i].textContent = '';
      text.classList.remove('text');
      text.classList.add('singAlongText');
      
      let index: number = -1;
      for (let i = 0; i < state.flags.length; i++) {
        if (currentTime >= state.flags[i].start && currentTime < state.flags[i].stop) {
          index = i;
          break;
        }
      }
      internalState.currentFlag = index;

      if (index >= 0) {
        // after the first flg, the text lines are shown
        for (let i = 0; i < 5; i++) {
          let line: HTMLSpanElement[];
          switch (i) {
            case 1:
              ({ line } = getTextLine(state.singAlongText[index] || [], colorTable['lblu'].rgba(), transWds, 38));
              break;
            case 3:
              if (index < state.flags.length) {
                ({ line } = getTextLine(state.singAlongText[index + 1] || [], colorTable['blu'].rgba(), transWds, 38));
              } else {
                ({ line } = getTextLine([], colorTable['wht'].rgba(), transWds, 38));
              }
              break;
            default:
              ({ line } = getTextLine([], colorTable['wht'].rgba(), transWds, 38));
              break;
          }
          textLines[i].append(...line);
        }
      } else {
        // before the first flag the title is shown
        for (let i = 0; i < 5; i++) {
          let textLine: HTMLSpanElement[];
          switch (i) {
            case 1:
              // red frame top
              const topLine = new Array(state.singAlongTitle.length + 2).fill(0xa4 /*bottomline*/);
              // spaces to center title
              topLine.unshift(...new Array(Math.floor((38 - state.singAlongTitle.length)/2)).fill(0x20 /*space*/));
              ({ line: textLine } = getTextLine(topLine, colorTable['red'].rgba(), transWds, 38));
              break;
            case 2:
              let title: number[] = [];
              if (state.singAlongTitle) {
                title = state.singAlongTitle.slice();
                // red frame left
                title.unshift(0x12 /*reverse on*/, 0x1c /*red*/, 0x20 /*space*/, 0x81 /*orange*/);
                // red frame right
                title.push(0x1c /*red*/, 0x20 /*space*/);
                // spaces to center title
                title.unshift(...new Array(Math.floor((38 - state.singAlongTitle.length)/2)).fill(0x20));
              }
              ({ line: textLine } = getTextLine(title, colorTable['orng'].rgba(), transWds, 38));
              break;
            case 3:
              // red frame bottom
              const bottomLine = new Array(state.singAlongTitle.length + 2).fill(0xa3 /*topline*/);
              // spaces to center title
              bottomLine.unshift(...new Array(Math.floor((38 - state.singAlongTitle.length)/2)).fill(0x20 /*space*/));
              ({ line: textLine } = getTextLine(bottomLine, colorTable['red'].rgba(), transWds, 38));
              break;
            default:
              ({ line: textLine } = getTextLine([], colorTable['wht'].rgba(), transWds, 38));
              break;
          }
          textLines[i].append(...textLine);
        }
      }
    }
  }
};
const updateUiFileSelects = () => {
  fileSelect.value = state.fileSelectValue;
  openFileLabel.textContent = state.openFileValue ? getFilenameFromString(state.openFileValue) : '--OPEN--';
  !state.openFileValue && (openFileInput.value = state.openFileValue);
};
const updateUiPlayArea = () => {
  playPauseButton.disabled = state.voicesDataLeft.length === 0 || state.isLoading;
  state.isPlaying ? playPauseButton.classList.add('paused') : playPauseButton.classList.remove('paused');
  currentSpan.textContent = getTimeString(state.currentTime);
  timeSlider.disabled = state.voicesDataLeft.length === 0 || state.isLoading;
  timeSlider.max = String(getDuration());
  timeSlider.value = String(state.currentTime);
  durationSpan.textContent = getTimeString(getDuration());
};

const loadSidFile = async (channel: Channel, file: Blob) => {
  pause();
  state.isLoading = true;
  state.isPlaying = false;
  const { voicesData, duration, text, notes, flags } = await loadFile(channel, file);
  if (channel === 'right') {
    state.durationRight = duration;
    state.voicesDataRight = voicesData;
    state.notes = [state.notes[0], state.notes[1], state.notes[2], notes[0], notes[1], notes[2]];
    state.currentNotes = [state.currentNotes[0], state.currentNotes[1], state.currentNotes[2], -1, -1, -1];
  } else {
    state.durationLeft = duration;
    state.voicesDataLeft = voicesData;
    state.notes = [notes[0], notes[1], notes[2], state.notes[3], state.notes[4], state.notes[5]];
    state.currentNotes = [-1, -1, -1, state.currentNotes[3], state.currentNotes[4], state.currentNotes[5]];
    state.text = text;
    state.flags = flags;
  }
  state.startTime = 0;
  state.currentTime = 0;
  state.audioContextStartTime = audioContext.currentTime;
  state.isLoading = false;
};

const loadWdsFile = async (file: Blob) => {
  const buffer = new DataView(await readFileAsArrayBuffer(file));
  let line: number[] = [];
  const lines: number[][] = [];
  for (let i = 0; i < buffer.byteLength; i++) {
    const byte = buffer.getUint8(i);
    switch (byte) {
      case 0xd:
        // new line
        lines.push(line);
        line = [];
        break;
      default:
        line.push(byte);
        break;
    }
  }
  // remove apostrophes from beginning and end
  state.singAlongTitle = lines[0].slice(1, -1);
  state.singAlongText = lines.slice(1);
};

const clear = () => {
  pause();
  state.isLoading = false;
  state.isPlaying = false;
  state.durationLeft = 0;
  state.voicesDataLeft = [];
  state.durationRight = 0;
  state.voicesDataRight = [];
  state.fileSelectValue = '';
  state.openFileValue = '';
  state.notes = [[], [], [], [], [], []];
  state.currentNotes = [-1, -1, -1, -1, -1, -1];
  //                                 \n
  //                                 \n
  //         SELECT A SID FILE       \n
  //                                 \n
  //                                 \0
  state.text = [
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0xd, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0xd, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x53, 0x45,
    0x4c, 0x45, 0x43, 0x54, 0x20, 0x41, 0x20, 0x53, 0x49, 0x44, 0x20, 0x46, 0x49, 0x4c, 0x45, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0xd, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0xd, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
    0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x0,
  ];
  state.flags = [];
  state.currentFlag = -1;
  state.singAlongTitle = [];
  state.singAlongText = [];
  state.startTime = 0;
  state.currentTime = 0;
  state.audioContextStartTime = audioContext.currentTime;
};

openFileInput.onchange = (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.openFileValue = value;
    state.fileSelectValue = '';
    // @ts-ignore
    const files: File[] = e.target.files;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.mus')) {
        loadSidFile('left', file);
      } else if (file.name.toLowerCase().endsWith('.str')) {
        loadSidFile('right', file);
      } else if (file.name.toLowerCase().endsWith('.wds')) {
        loadWdsFile(file);
      }
    }
  }
};
fileSelect.onchange = async (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.fileSelectValue = value;
    state.openFileValue = '';
    const fileNames = value.split(',');
    for (const fileName of fileNames) {
      const response = await fetch(`sids/${fileName}`);
      const file = await response.blob();
      if (fileName.toLowerCase().endsWith('.mus')) {
        loadSidFile('left', file);
      } else if (fileName.toLowerCase().endsWith('.str')) {
        loadSidFile('right', file);
      } else if (fileName.toLowerCase().endsWith('.wds')) {
        loadWdsFile(file);
      }
    }
  }
};
clearButton.onclick = () => {
  clear();
};

const clearKeyColor = (index: number) => {
  if (index < 0 || index >= keyDivs.length) return;
  const color = [0, 2, 4, 5, 7, 9, 11].includes(index % 12)
    ? 'linear-gradient(to bottom, #fff, #e0e0e0)'
    : 'linear-gradient(to bottom, #222, #000)';
  keyDivs[index].style.background = color;
};
const colorMap: { [key: number]: string } = {
  0: '#eeee77ff',
  1: '#664400ff',
  2: '#cc44ccff',
  3: '#f8f8bfff',
  4: '#ae9158ff',
  5: '#df97dfff',
};
const setKeyColor = (index: number, voiceIndex: number) => {
  keyDivs[index].style.background = colorMap[voiceIndex];
};

const play = () => {
  // @ts-ignore
  if (!updateKeyboardInterval) updateKeyboardInterval = setInterval(updateKeyboard, 20);
  audioContext.resume();
};
const pause = () => {
  if (updateKeyboardInterval) {
    clearInterval(updateKeyboardInterval);
    updateKeyboardInterval = undefined;
  }
  audioContext.suspend();
};
playPauseButton.onclick = () => {
  if (state.isPlaying) {
    pause();
    state.isPlaying = false;
  } else {
    play();
    state.isPlaying = true;
  }
};

const reloadSidFiles = (e: MouseEvent | TouchEvent) => {
  state.isLoading = true;
  // @ts-ignore
  state.startTime = Number(e.target.value);
  // @ts-ignore
  state.currentTime = Number(e.target.value);
  state.audioContextStartTime = audioContext.currentTime;
  state.voicesDataLeft.length > 0 && reloadVoices('left', state.voicesDataLeft, state.startTime);
  state.voicesDataRight.length > 0 && reloadVoices('right', state.voicesDataRight, state.startTime);
  state.currentNotes = [-1, -1, -1, -1, -1, -1];
  state.isLoading = false;
};
timeSlider.onmousedown = (e: MouseEvent) => {
  pause();
};
timeSlider.ontouchstart = (e: TouchEvent) => {
  pause();
};
timeSlider.oninput = (e: Event) => {
  // @ts-ignore
  state.currentTime = Number(e.target.value);
};
timeSlider.onmouseup = (e: MouseEvent) => {
  reloadSidFiles(e);
  if (state.isPlaying) play();
};
timeSlider.ontouchend = (e: TouchEvent) => {
  reloadSidFiles(e);
  if (state.isPlaying) play();
};

let updateKeyboardInterval: number | undefined;
const updateKeyboard = () => {
  state.currentTime = state.startTime + audioContext.currentTime - state.audioContextStartTime;
  if (state.currentTime > getDuration()) {
    pause();
    state.isPlaying = false;
  }
};
