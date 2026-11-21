// Reading aloud with a speech server of your own, one with OpenAI's API such
// as Kokoro-FastAPI: its voices from GET /v1/audio/voices, and each sentence
// from POST /v1/audio/speech, played in turn through an AudioContext.

import { settings } from './settings.js';

// The server's API key, kept for this tab only, out of localStorage, as
// Canvas keeps its Voice input key.
const KEY_STORAGE = 'openhands-voice:speech-server-key';
export function serverKey() {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}
export function setServerKey(key) {
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // Then it's not kept.
  }
}

// Whether Speech server is picked, with an address.
export const usingServer = () => settings.readWith === 'server' && !!settings.speechServer.trim();

// The server's address for a path, e.g. http://localhost:8880 or
// http://localhost:8880/v1 for /v1/audio/speech.
const endpoint = (path) =>
  `${settings.speechServer.trim().replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/audio/${path}`;

async function request(path, init = {}) {
  const key = serverKey();
  const headers = { ...init.headers, ...(key ? { Authorization: `Bearer ${key}` } : {}) };
  let response;
  try {
    response = await window.fetch(endpoint(path), { ...init, headers });
  } catch {
    throw new Error(`Couldn't reach ${settings.speechServer.trim()}`);
  }
  if (!response.ok) throw new Error(`The speech server answered ${response.status}`);
  return response;
}

// The server's voices, by name, for the address they're from, and why it
// last failed, if it did, which the settings page says, and whoever watches
// hears of.
let voices = [];
let voicesFor = null;
let loading = null;
let problem = null;
let onChange = () => {};

export const serverVoices = () => (voicesFor === settings.speechServer ? voices : []);
export const serverProblem = () => (usingServer() ? problem : null);
export function watchServer(callback) {
  onChange = callback;
  return () => {
    onChange = () => {};
  };
}

function setProblem(next) {
  if (next === problem) return;
  problem = next;
  onChange();
}
const failed = (error) =>
  setProblem(`${error.message}, so your browser's voices read aloud instead.`);

// Kokoro-FastAPI lists {"voices": ["af_heart", …]}; others list voices as
// objects, or by themselves.
const voiceNames = (body) =>
  (Array.isArray(body) ? body : (body?.voices ?? body?.data ?? []))
    .map((voice) => (typeof voice === 'string' ? voice : (voice?.id ?? voice?.voice_id ?? voice?.name)))
    .filter((name) => typeof name === 'string' && name);

// Asks the server for its voices, once per address, or again with force,
// e.g. as the settings page opens.
export function loadServerVoices({ force = false } = {}) {
  if (!usingServer()) return Promise.resolve();
  const address = settings.speechServer;
  if (!force && (voicesFor === address || loading?.address === address)) return loading?.promise ?? Promise.resolve();
  const promise = request('voices')
    .then((response) => response.json())
    .then(
      (body) => {
        voices = voiceNames(body);
        voicesFor = address;
        setProblem(null);
      },
      (error) => {
        voices = [];
        voicesFor = address;
        failed(error);
      },
    )
    .finally(() => {
      if (loading?.promise === promise) loading = null;
    });
  loading = { address, promise };
  return promise;
}

// The voice to read with: the one named, or picked, or the server's first.
// OpenAI's own voice names are understood by Kokoro-FastAPI too.
const voiceFor = (name) => name || settings.serverVoice || serverVoices()[0] || 'alloy';

// The AudioContext replies play through, made, or woken, as you click, as
// browsers only let a page play sound after one.
let context = null;
export function wakeServerAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return null;
  context ??= new Context();
  context.resume?.();
  return context;
}
export function closeServerAudio() {
  Promise.resolve(context?.close?.()).catch(() => {});
  context = null;
}

// Plays the sentences in the voice, speed and volume given, fetching each
// one while the one before plays. onDone runs once the last has played;
// onFailed with the sentences not yet played, if the server fails first.
// Returns what stops it.
export function playOnServer(sentences, { name, rate, volume, onDone, onFailed }) {
  const audio = wakeServerAudio();
  let stopped = false;
  let source = null;
  if (!audio) {
    onFailed(sentences);
    return () => {};
  }
  const fetched = new Map();
  const fetchSentence = (index) => {
    if (!fetched.has(index)) {
      const body = {
        model: 'tts-1',
        input: sentences[index],
        voice: voiceFor(name),
        speed: rate,
        response_format: 'mp3',
      };
      fetched.set(
        index,
        request('speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data)),
      );
      // Unplayed ones don't fail on their own.
      fetched.get(index).catch(() => {});
    }
    return fetched.get(index);
  };
  const play = async (index) => {
    if (index >= sentences.length) {
      onDone();
      return;
    }
    let buffer;
    try {
      buffer = await fetchSentence(index);
    } catch (error) {
      if (stopped) return;
      failed(error);
      onFailed(sentences.slice(index));
      return;
    }
    if (stopped) return;
    setProblem(null);
    if (index + 1 < sentences.length) fetchSentence(index + 1);
    source = audio.createBufferSource();
    source.buffer = buffer;
    const gain = audio.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(audio.destination);
    source.onended = () => {
      if (!stopped) play(index + 1);
    };
    source.start();
  };
  play(0);
  return () => {
    stopped = true;
    try {
      source?.stop();
    } catch {
      // It had ended.
    }
  };
}
