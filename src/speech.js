// Reading aloud with the browser's voices: the Voice and Reading speed
// settings, with Readium Speech finding, rating and ranking the voices.

import { WebSpeechVoiceManager } from '@readium/speech';
import { speechProblem } from './audio.js';
import { canvasLanguage } from './canvas.js';
import { settings, SWITCHES } from './settings.js';

// Only English voices so far.
const LANGUAGE = 'en';
const QUALITY_LABELS = {
  veryLow: 'Very low quality',
  low: 'Low quality',
  normal: 'Normal quality',
  high: 'High quality',
  veryHigh: 'Very high quality',
};

// A choice's value, e.g. Reading speed's rate.
const chosen = (key) =>
  SWITCHES.find((item) => item.key === key).options.find(([value]) => value === settings[key])?.[2] ?? 1;
export const volume = () => chosen('volume');

// Whether Readium's been asked to find the voices, and what it found, once
// it has: the voices, best first, the one it picks for your region among
// them all and among those on this device, and its sample sentence. Until
// then, the browser picks.
let asked = false;
let loading = null;
let manager = null;
let ranked = [];
let automatics = { all: null, onDevice: null };
let sample = 'Hello, my name is {name} and I am an English voice.';

// Readium reads the browser's voices once, as soon as it has some, which
// Chrome only gives after the page loads.
export function loadVoices() {
  asked = true;
  loading ??= WebSpeechVoiceManager.initialize({ languages: [LANGUAGE] })
    .then(async (found) => {
      // Readium gives up waiting after 10 seconds with no voices, and keeps
      // that, so it's made to start afresh next time.
      if (!found.browserVoices.length) {
        WebSpeechVoiceManager.instance = null;
        WebSpeechVoiceManager.initializationPromise = null;
        throw new Error('No voices yet');
      }
      const voices = found.getVoices({
        languages: LANGUAGE,
        excludeNovelty: true,
        excludeVeryLowQuality: true,
        removeDuplicates: true,
      });
      ranked = await found.sortVoicesByQuality(voices);
      const region = /^en-/i.test(window.navigator.language) ? window.navigator.language : 'en-US';
      const pick = (voices) => found.getDefaultVoice([region, LANGUAGE], voices);
      automatics = { all: await pick(ranked), onDevice: await pick(ranked.filter(onDevice)) };
      sample = found.getTestUtterance(LANGUAGE) || sample;
      manager = found;
    })
    // Try again next time, e.g. as the settings page opens.
    .catch(() => {
      loading = null;
    });
  return loading;
}

// Voices the browser finds after Readium gave up waiting for them: Readium
// reads them, once it's been asked to, and then onFound runs. Returns what
// stops watching.
export function watchVoices(onFound) {
  const synth = window.speechSynthesis;
  const changed = () => {
    if (!asked || manager || !synth.getVoices().length) return;
    loadVoices().then(() => manager && onFound());
  };
  synth?.addEventListener?.('voiceschanged', changed);
  return () => synth?.removeEventListener?.('voiceschanged', changed);
}

// Online voices send what they read to Google or Microsoft, which Keep voice
// on this device leaves out. Readium's voices and the browser's own say so
// differently, and as a browser may not say so at all, voices named as
// Microsoft's online ones, with network ids, or Google's but those with a
// local id, as Android's on-device ones have, count as online too.
export const isOnline = (voice) => {
  const name = voice.originalName ?? voice.name ?? '';
  const id = voice.voiceURI ?? '';
  return (
    voice.offlineAvailability === false ||
    voice.localService === false ||
    /\bOnline\b/.test(name) ||
    /[-_]network$/i.test(id) ||
    (/^Google\b/.test(name) && !/[-_]local$/i.test(id))
  );
};
const onDevice = (voice) => !isOnline(voice);
const usable = () => (settings.onDeviceOnly ? ranked.filter(onDevice) : ranked);
const automatic = () => automatics[settings.onDeviceOnly ? 'onDevice' : 'all'];

// The browser's own voice for one of Readium's, by its name there.
const nameOf = (voice) => voice.originalName ?? voice.name;
const browserVoice = (name) =>
  (window.speechSynthesis?.getVoices?.() ?? []).find((voice) => voice.name === name) ?? null;

const regionName = (language) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' }).of(
      language,
    );
  } catch {
    return language;
  }
};

// A voice as the Voice setting lists it: Readium's label for a voice it
// rates, or else the browser's name, which Readium shortens, e.g. espeak's
// "English (America)" to "English", and its quality and whether it's online.
const describe = (voice) => ({
  name: nameOf(voice),
  label: voice.quality ? voice.label : nameOf(voice),
  details: [
    QUALITY_LABELS[voice.quality] ?? 'Not rated',
    isOnline(voice) && 'Online',
  ]
    .filter(Boolean)
    .join(' · '),
});

// The Voice setting's choices: rated voices by region, the best region
// first, then the rest.
export function voiceGroups() {
  const groups = new Map();
  for (const voice of usable()) {
    const group = voice.quality ? regionName(voice.language) : 'Other voices';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(describe(voice));
  }
  const other = groups.get('Other voices');
  groups.delete('Other voices');
  if (other) groups.set('Other voices', other);
  return [...groups];
}

// What Automatic reads with, as the Voice setting describes it.
export function automaticDetails() {
  if (automatic()) return `Best for your region: ${describe(automatic()).label}`;
  if (!manager) return 'Finding voices…';
  return settings.onDeviceOnly ? 'No voices on this device' : 'Your browser picks';
}

// A saved voice the Voice setting doesn't list: one this device has, but
// online while Keep voice on this device is on, or one it doesn't have.
export function unlistedVoice(name) {
  const known = ranked.find((voice) => nameOf(voice) === name);
  return browserVoice(name)
    ? {
        label: known ? describe(known).label : name,
        details: 'Online · Skipped to keep voice on this device',
      }
    : { label: name, details: 'Not on this device' };
}

// An English voice the browser has on this device, to read with until
// Readium has picked one while Keep voice on this device is on: its default
// if it's one.
const onDeviceFallback = () =>
  (window.speechSynthesis?.getVoices?.() ?? [])
    .filter((voice) => onDevice(voice) && /^en\b/i.test(voice.lang.replace('_', '-')))
    .sort((a, b) => Number(b.default) - Number(a.default))[0] ?? null;

// The Voice setting's voice, but an online one while Keep voice on this
// device is on, or else the one Readium picks. Without one, the browser chooses,
// but to keep voice on this device, as it can't be trusted not to pick an
// online one: then there's one from this device, or none at all.
export function chosenVoice(name = settings.voice) {
  const saved = name && browserVoice(name);
  return (
    (saved && (onDevice(saved) || !settings.onDeviceOnly) && saved) ||
    (automatic() && manager?.convertToSpeechSynthesisVoice(automatic())) ||
    (settings.onDeviceOnly && !manager && onDeviceFallback()) ||
    null
  );
}

// What's queued to be read, and what to tell whoever asked for it if it's
// stopped first. Chrome forgets to say an utterance ended once nothing
// refers to it, so they're kept until the next read.
let queued = [];
let reader = null;

// Stops what's being read, telling whoever asked for it.
export function stopSpeaking() {
  const stopped = reader;
  reader = null;
  queued = [];
  const synth = window.speechSynthesis;
  if (synth?.speaking || synth?.pending) synth.cancel();
  stopped?.onStopped?.();
}

// Queues the sentences to be read with the chosen voice, or the one named,
// and speed, after stopping what's being read. onDone runs once the last is
// read or fails, at once for none; onStopped if it's stopped first, e.g. by
// another read.
export function read(sentences, { onDone, onStopped, name } = {}) {
  stopSpeaking();
  const voice = speechProblem() ? null : chosenVoice(name);
  // Nothing on this device can read it, and the browser's choice may not be.
  if (speechProblem() || (!voice && settings.onDeviceOnly) || !sentences.length) {
    onDone?.();
    return;
  }
  queued = sentences.map((sentence) => {
    const utterance = new window.SpeechSynthesisUtterance(sentence);
    utterance.lang = voice?.lang ?? canvasLanguage();
    if (voice) utterance.voice = voice;
    utterance.rate = chosen('readingSpeed');
    utterance.volume = volume();
    return utterance;
  });
  const mine = { onStopped };
  reader = mine;
  const done = () => {
    if (reader !== mine) return;
    reader = null;
    onDone?.();
  };
  const last = queued.at(-1);
  last.onend = done;
  last.onerror = (event) => {
    if (event?.error !== 'canceled' && event?.error !== 'interrupted') done();
  };
  for (const utterance of queued) window.speechSynthesis.speak(utterance);
}

// Readium's sample sentence in a voice, by its name, or the chosen one.
export function previewVoice(name) {
  const voice = chosenVoice(name);
  const label = voice
    ? (ranked.find((item) => nameOf(item) === voice.name)?.label ?? voice.name)
    : 'your browser';
  read([sample.replace('{name}', label)], { name });
}
