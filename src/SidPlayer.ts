import { audioContext, loadFile, reloadVoices } from './SidLoad';

const keyDivs: HTMLDivElement[] = [];
for (let i = 0; i < 96; i++) keyDivs[i] = document.getElementById(`k${i}`) as HTMLDivElement;
const textLines: HTMLParagraphElement[] = [];
for (let i = 0; i < 5; i++) textLines[i] = document.getElementById(`line${i}`) as HTMLParagraphElement;
const fileSelect = document.getElementById('fileSelect') as HTMLSelectElement;
const openFileInput = document.getElementById('openFile') as HTMLInputElement;
const playPauseButton = document.getElementById('playPause') as HTMLButtonElement;
const currentSpan = document.getElementById('current') as HTMLSpanElement;
const timeSlider = document.getElementById('timeslider') as HTMLInputElement;
const durationSpan = document.getElementById('duration') as HTMLSpanElement;

export const notes: { start: number; stop: number; index: number }[][] = [[], [], []];
export const currentNotes: number[] = [-1, -1, -1];
export const lastNotes: number[] = [-1, -1, -1];

let duration = 0;
let startTime = 0;
let audioContextStartTime = audioContext.currentTime;

const getTimeString = (value: number): string => {
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value - 60 * mins);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const loadSidFile = async (file: Blob) => {
  playPauseButton.disabled = true;
  timeSlider.disabled = true;
  startTime = 0;
  audioContextStartTime = audioContext.currentTime;
  const { duration: loadedDuration, text } = await loadFile(file);
  duration = loadedDuration;
  currentSpan.textContent = getTimeString(0);
  durationSpan.textContent = getTimeString(duration);
  timeSlider.max = String(duration);
  timeSlider.value = String(startTime);
  playPauseButton.disabled = false;
  timeSlider.disabled = false;
  for (let i = 0; i < text.length; i++) textLines[i].textContent = text[i];
  for (let i = text.length; i < 5; i++) textLines[i].textContent = '';
};

openFileInput.onchange = (e: Event) => {
  stop();
  statePlaying = false;
  playPauseButton.classList.remove('paused');

  // @ts-ignore
  const file: File = e.target.files[0];
  if (!file) return;
  loadSidFile(file);
};
fileSelect.onchange = async (e: Event) => {
  stop();
  statePlaying = false;
  playPauseButton.classList.remove('paused');

  // @ts-ignore
  const value: string = e.target.value;
  if (value) {
    const response = await fetch(`sids/${value}.MUS.prg`);
    const file = await response.blob();
    loadSidFile(file);
  } else {
    // Reset
    playPauseButton.disabled = true;
    timeSlider.disabled = true;
    startTime = 0;
    audioContextStartTime = audioContext.currentTime;
    duration = 0;
    currentSpan.textContent = '';
    durationSpan.textContent = '';
    timeSlider.max = String(1);
    timeSlider.value = String(0);
    for (let i = 0; i < 5; i++) textLines[i].textContent = '';
  }
};

const clearKeyColor = (index: number) => {
  const color = [0, 2, 4, 5, 7, 9, 11].includes(index % 12)
    ? 'linear-gradient(to bottom, #fff, #e0e0e0)'
    : 'linear-gradient(to bottom, #222, #000)';
  keyDivs[index].style.background = color;
};
const colorMap: { [key: number]: string } = { 0: '#EEEE77', 1: '#664400', 2: '#CC44CC' };
const setKeyColor = (index: number, voice: number) => {
  keyDivs[index].style.background = colorMap[voice];
};

let statePlaying = false;
const playPause = () => {
  if (statePlaying) {
    pause();
    statePlaying = false;
    playPauseButton.classList.remove('paused');
  } else {
    play();
    statePlaying = true;
    playPauseButton.classList.add('paused');
  }
};
const play = () => {
  // @ts-ignore
  if (!updateKeyboardInterval) updateKeyboardInterval = setInterval(updateKeyboard, 100);
  audioContext.resume();
};
const pause = () => {
  if (updateKeyboardInterval) {
    clearInterval(updateKeyboardInterval);
    updateKeyboardInterval = undefined;
  }
  audioContext.suspend();
};
const stop = () => {
  pause();
  for (let i = 0; i < 3; i++) {
    if (lastNotes[i] >= 0) {
      clearKeyColor(notes[i][lastNotes[i]].index);
      lastNotes[i] = -1;
    }
  }
};
const move = (e: MouseEvent | TouchEvent) => {
  playPauseButton.disabled = true;
  timeSlider.disabled = true;
  // @ts-ignore
  startTime = Number(e.target.value);
  audioContextStartTime = audioContext.currentTime;
  reloadVoices(startTime);
  if (statePlaying) play();
  playPauseButton.disabled = false;
  timeSlider.disabled = false;
}

playPauseButton.onclick = playPause;
timeSlider.oninput = (e: Event) => {
  stop();
  // @ts-ignore
  currentSpan.textContent = getTimeString(e.target.value);
};
timeSlider.onmouseup = (e: MouseEvent) => move(e);
timeSlider.ontouchend = (e: TouchEvent) => move(e);

let updateKeyboardInterval: number | undefined;
const updateKeyboard = () => {
  const currentTime = audioContext.currentTime;
  for (let i = 0; i < 3; i++) {
    if (notes[i].length === 0) continue;
    if (lastNotes[i] >= 0 && currentTime > notes[i][lastNotes[i]].stop) {
      clearKeyColor(notes[i][lastNotes[i]].index);
      lastNotes[i] = -1;
    }
    if (currentNotes[i] < notes[i].length - 1 && currentTime >= notes[i][currentNotes[i] + 1].start) {
      while (currentNotes[i] < notes[i].length - 1 && notes[i][currentNotes[i] + 1].start <= currentTime)
        currentNotes[i]++;
      setKeyColor(notes[i][currentNotes[i]].index, i);
      lastNotes[i] = currentNotes[i];
    }
  }
  timeSlider.value = String(currentTime - audioContextStartTime + startTime);
  currentSpan.textContent = getTimeString(Math.min(currentTime - audioContextStartTime + startTime, duration));
  if (currentTime - audioContextStartTime + startTime > duration) {
    stop();
    statePlaying = false;
    playPauseButton.classList.remove('paused');
  }
};
