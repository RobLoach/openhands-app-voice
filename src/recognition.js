// On-device voices only, for Canvas's mic: what you say is recognised on this
// device too, or not at all. Without a Voice input server, Canvas's mic uses
// the browser's own speech recognition, which sends what you say to Google
// unless asked to process it locally, as Chrome 139 and later can.

import { settings } from './settings.js';

// The browser's speech recognition, by both its names, which Canvas looks up
// each time its mic starts.
const NAMES = ['SpeechRecognition', 'webkitSpeechRecognition'];

// Canvas's Voice input settings, which send what you say to your own server
// instead of the browser's speech recognition when they have a URL.
const VOICE_INPUT_KEY = 'openhands-transcription-endpoint';

export function voiceInputServer() {
  try {
    return !!JSON.parse(localStorage.getItem(VOICE_INPUT_KEY))?.baseUrl?.trim();
  } catch {
    return false;
  }
}

// The language Canvas's mic listens for, which the browser takes from the
// page unless told: your region's, when it's the same language.
export function recognitionLanguage() {
  const page = document.documentElement.lang || 'en';
  const yours = window.navigator.language ?? '';
  return yours.split('-')[0] === page.split('-')[0] && yours.includes('-') ? yours : page;
}

// The originals the wrapped ones replace, by name, while they do.
const originals = new Map();
const recognition = () => {
  const name = NAMES.find((key) => originals.has(key) || window[key]);
  return name ? (originals.get(name) ?? window[name]) : null;
};

// The browser's speech recognition, made to start only on this device.
function onDeviceOnly(Recognition) {
  return class extends Recognition {
    start(...args) {
      if (!('processLocally' in this)) {
        throw new Error("This browser can't recognise speech on this device.");
      }
      this.processLocally = true;
      if (!this.lang) this.lang = recognitionLanguage();
      return super.start(...args);
    }
  };
}

export function onDeviceRecognition() {
  function apply(on) {
    for (const name of NAMES) {
      if (on && !originals.has(name) && window[name]) {
        originals.set(name, window[name]);
        window[name] = onDeviceOnly(window[name]);
      } else if (!on && originals.has(name)) {
        window[name] = originals.get(name);
        originals.delete(name);
      }
    }
  }
  return {
    refresh: () => apply(settings.onDeviceOnly),
    dispose: () => apply(false),
  };
}

const languageName = (language) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(language);
  } catch {
    return language;
  }
};

const VOICE_INPUT = "A Voice input server, under Canvas's Settings, keeps it on your network.";

// What happens to what you say to Canvas's mic, for the settings page, and
// how to have it recognised on this device, when the browser can once it
// downloads the language.
export async function recognitionStatus() {
  if (voiceInputServer()) {
    return { text: "Canvas's mic sends what you say to your Voice input server, under Canvas's Settings." };
  }
  const Recognition = recognition();
  if (!Recognition) {
    return {
      text: `Your browser has no speech recognition of its own, so Canvas's mic needs a Voice input server. ${VOICE_INPUT}`,
    };
  }
  if (!('processLocally' in Recognition.prototype) || !Recognition.available) {
    return {
      text: `Your browser can only recognise speech online, so Canvas's mic is blocked. ${VOICE_INPUT}`,
    };
  }
  const language = recognitionLanguage();
  const options = { langs: [language], processLocally: true };
  const state = await Promise.resolve(Recognition.available(options)).catch(() => 'unavailable');
  if (state === 'available') {
    return { text: "Canvas's mic recognises what you say on this device." };
  }
  if (state === 'downloadable' || state === 'downloading') {
    return {
      text: `Canvas's mic is blocked until your browser downloads ${languageName(language)} speech recognition, to recognise what you say on this device.`,
      install: () => Recognition.install(options),
    };
  }
  return {
    text: `Your browser can't recognise ${languageName(language)} on this device, so Canvas's mic is blocked. ${VOICE_INPUT}`,
  };
}
