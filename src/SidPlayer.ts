import { colorTable } from './C64CharMap';
import { audioContext, Channel, connectMono, connectStereo, loadFile, NoteViz, reloadVoices } from './SidLoad';
import { Command, trans } from './SidParse';

const keyDivs: HTMLDivElement[] = [];
for (let i = 0; i < 96; i++) keyDivs[i] = document.getElementById(`k${i}`) as HTMLDivElement;
const textLines: HTMLParagraphElement[] = [];
for (let i = 0; i < 5; i++) textLines[i] = document.getElementById(`line${i}`) as HTMLParagraphElement;
const channelSelect = document.getElementById('channelSelect') as HTMLSelectElement;
const leftFileSelect = document.getElementById('leftFileSelect') as HTMLSelectElement;
const leftOpenFileInput = document.getElementById('leftOpenFile') as HTMLInputElement;
const leftClearButton = document.getElementById('leftClear') as HTMLButtonElement;
const rightFileSelect = document.getElementById('rightFileSelect') as HTMLSelectElement;
const rightOpenFileInput = document.getElementById('rightOpenFile') as HTMLInputElement;
const rightClearButton = document.getElementById('rightClear') as HTMLButtonElement;
const playPauseButton = document.getElementById('playPause') as HTMLButtonElement;
const currentSpan = document.getElementById('current') as HTMLSpanElement;
const timeSlider = document.getElementById('timeslider') as HTMLInputElement;
const durationSpan = document.getElementById('duration') as HTMLSpanElement;

type State = {
  selectedChannel: Channel;
  isLoading: boolean;
  isPlaying: boolean;
  fileSelectValueLeft: string;
  openFileValueLeft: string;
  durationLeft: number;
  voicesDataLeft: Command[][];
  durationRight: number;
  voicesDataRight: Command[][];
  fileSelectValueRight: string;
  openFileValueRight: string;
  notes: NoteViz[][];
  currentNotes: number[];
  text: number[];
  startTime: number;
  currentTime: number;
  audioContextStartTime: number;
};
const internalState: State = {
  selectedChannel: 'left',
  isLoading: false,
  isPlaying: false,
  durationLeft: 0,
  voicesDataLeft: [],
  fileSelectValueLeft: '',
  openFileValueLeft: '',
  durationRight: 0,
  voicesDataRight: [],
  fileSelectValueRight: '',
  openFileValueRight: '',
  notes: [[], [], [], [], [], []],
  currentNotes: [-1, -1, -1, -1, -1, -1],
  text: [],
  startTime: 0,
  currentTime: 0,
  audioContextStartTime: audioContext.currentTime,
};
const handler: ProxyHandler<State> = {
  set(target: State, property: keyof State, value: any) {
    if (property === 'currentNotes') {
      for (let i = 0; i < 6; i++) {
        clearKeyColor(
          target.currentNotes[i] >= 0 && target.notes[i].length > 0 ? target.notes[i][target.currentNotes[i]].index : -1
        );
      }
    }
    if (property === 'notes') {
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
    if (['text'].includes(property)) {
      updateUiText();
    }
    if (
      [
        'selectedChannel',
        'fileSelectValueLeft',
        'openFileValueLeft',
        'fileSelectValueRight',
        'openFileValueRight',
      ].includes(property)
    ) {
      updateUiFileSelects();
    }
    if (
      ['isLoading', 'isPlaying', 'durationLeft', 'voicesDataLeft', 'durationRight', 'currentTime'].includes(property)
    ) {
      updateUiPlayArea();
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

const getColoredText = (text: string, color: string, reverse: boolean) => {
  const span = document.createElement('span') as HTMLSpanElement;
  span.style.color = reverse ? 'rgb(255,255,255)' : color;
  span.style.backgroundColor = reverse ? color : 'rgb(255,255,255)';
  span.innerText = text;
  return span;
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
  for (let i = 0; i < 5; i++) textLines[i].textContent = '';

  let count: number = 0;
  let text: string = '';
  let color: string = colorTable['blk'].rgba();
  let reverse: boolean = false;

  textLoop: for (const byte of state.text) {
    switch (byte) {
      case 0x0:
        // end of text
        if (text) textLines[count].append(getColoredText(text, color, reverse));
        break textLoop;
      case 0xd:
        // new line
        textLines[count].append(getColoredText(text, color, reverse));
        count++;
        text = '';
        break;
      case 0x5:
        // wht
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['wht'].rgba();
        break;
      case 0x12:
        // rvsOn
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        reverse = true;
        break;
      case 0x1c:
        // red
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['red'].rgba();
        break;
      case 0x1e:
        // grn
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['grn'].rgba();
        break;
      case 0x1f:
        // blu
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['blu'].rgba();
        break;
      case 0x81:
        // orng
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['orng'].rgba();
        break;
      case 0x90:
        // blk
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['blk'].rgba();
        break;
      case 0x92:
        // rvsOff
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        reverse = false;
        break;
      case 0x95:
        // brn
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['brn'].rgba();
        break;
      case 0x96:
        // lred
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['lred'].rgba();
        break;
      case 0x97:
        // dgry
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['dgry'].rgba();
        break;
      case 0x98:
        // mgry
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['mgry'].rgba();
        break;
      case 0x99:
        // lgrn
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['lgrn'].rgba();
        break;
      case 0x9a:
        // lblu
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['lblu'].rgba();
        break;
      case 0x9b:
        // lgry
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['lgry'].rgba();
        break;
      case 0x9c:
        // pur
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['pur'].rgba();
        break;
      case 0x9e:
        // yel
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['yel'].rgba();
        break;
      case 0x9f:
        // cyn
        textLines[count].append(getColoredText(text, color, reverse));
        text = '';
        color = colorTable['cyn'].rgba();
        break;
      default:
        text += trans[byte] || '?';
        break;
    }
  }
};
const updateUiFileSelects = () => {
  leftFileSelect.style.display = state.selectedChannel === 'right' ? 'none' : 'revert';
  leftFileSelect.value = state.fileSelectValueLeft;
  leftOpenFileInput.style.display = state.selectedChannel === 'right' ? 'none' : 'revert';
  !state.openFileValueLeft && (leftOpenFileInput.value = state.openFileValueLeft);
  leftClearButton.style.display = state.selectedChannel === 'right' ? 'none' : 'revert';
  rightFileSelect.style.display = state.selectedChannel === 'right' ? 'revert' : 'none';
  rightFileSelect.value = state.fileSelectValueRight;
  rightOpenFileInput.style.display = state.selectedChannel === 'right' ? 'revert' : 'none';
  !state.openFileValueRight && (rightOpenFileInput.value = state.openFileValueRight);
  rightClearButton.style.display = state.selectedChannel === 'right' ? 'revert' : 'none';
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
  const { voicesData, duration, text, notes } = await loadFile(channel, file);
  if (channel === 'right') {
    state.durationRight = duration;
    state.voicesDataRight = voicesData;
    state.notes = [state.notes[0], state.notes[1], state.notes[2], notes[0], notes[1], notes[2]];
    state.currentNotes = [state.currentNotes[0], state.currentNotes[1], state.currentNotes[2], -1, -1, -1];
    connectStereo();
  } else {
    state.durationLeft = duration;
    state.voicesDataLeft = voicesData;
    state.notes = [notes[0], notes[1], notes[2], state.notes[3], state.notes[4], state.notes[5]];
    state.currentNotes = [-1, -1, -1, state.currentNotes[3], state.currentNotes[4], state.currentNotes[5]];
    state.text = text;
  }
  state.startTime = 0;
  state.currentTime = 0;
  state.audioContextStartTime = audioContext.currentTime;
  state.isLoading = false;
};

const clear = (channel: Channel) => {
  pause();
  state.isLoading = false;
  state.isPlaying = false;
  if (channel === 'right') {
    state.durationRight = 0;
    state.voicesDataRight = [];
    state.fileSelectValueRight = '';
    state.openFileValueRight = '';
    state.notes = [state.notes[0], state.notes[1], state.notes[2], [], [], []];
    state.currentNotes = [state.currentNotes[0], state.currentNotes[1], state.currentNotes[2], -1, -1, -1];
  } else {
    state.durationLeft = 0;
    state.voicesDataLeft = [];
    state.fileSelectValueLeft = '';
    state.openFileValueLeft = '';
    state.notes = [[], [], [], state.notes[3], state.notes[4], state.notes[5]];
    state.currentNotes = [-1, -1, -1, state.currentNotes[3], state.currentNotes[4], state.currentNotes[5]];
    // SELECT A SID FILE
    state.text = [
      0x53, 0x45, 0x4c, 0x45, 0x43, 0x54, 0x20, 0x41, 0x20, 0x53, 0x49, 0x44, 0x20, 0x46, 0x49, 0x4c, 0x45, 0x0,
    ];
  }
  state.startTime = 0;
  state.currentTime = 0;
  state.audioContextStartTime = audioContext.currentTime;
};

channelSelect.onchange = (e: Event) => {
  state.selectedChannel = (e.target as HTMLSelectElement).value as Channel;
};

leftOpenFileInput.onchange = (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.openFileValueLeft = value;
    // @ts-ignore
    const file: File = e.target.files[0];
    file && loadSidFile('left', file);
  } else {
    clear('left');
  }
};
rightOpenFileInput.onchange = (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.openFileValueRight = value;
    // @ts-ignore
    const file: File = e.target.files[0];
    file && loadSidFile('right', file);
  } else {
    clear('right');
  }
};
leftFileSelect.onchange = async (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.fileSelectValueLeft = value;
    const response = await fetch(`sids/${value}.MUS.prg`);
    const file = await response.blob();
    loadSidFile('left', file);
  } else {
    clear('left');
  }
};
rightFileSelect.onchange = async (e: Event) => {
  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    state.fileSelectValueRight = value;
    const response = await fetch(`sids/${value}.MUS.prg`);
    const file = await response.blob();
    loadSidFile('right', file);
  } else {
    clear('right');
    connectMono();
  }
};
leftClearButton.onclick = () => {
  clear('left');
};
rightClearButton.onclick = () => {
  clear('right');
  connectMono();
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
