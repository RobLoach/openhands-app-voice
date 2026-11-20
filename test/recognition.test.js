import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, openSettings, setupPage } from './helpers.js';

const SETTINGS_URL = 'https://canvas.test/extensions/openhands-app-voice/settings';

// The browser's speech recognition, as Chrome 139 and later have it, which
// can process what you say locally once its language is downloaded, or as
// older browsers have it, which can't. It records how each one started.
function fakeRecognition(page, { local = true, language = 'available' } = {}) {
  page.recognitions = [];
  page.installs = 0;
  page.language = language;
  class Recognition {
    lang = '';
    start() {
      page.recognitions.push({ processLocally: this.processLocally, lang: this.lang });
    }
  }
  // As in Chrome, processLocally is on the prototype.
  class LocalRecognition extends Recognition {
    local = false;
    get processLocally() {
      return this.local;
    }
    set processLocally(value) {
      this.local = value;
    }
    static async available(options) {
      page.availableAsked = options;
      return page.language;
    }
    static async install(options) {
      page.installs += 1;
      page.installAsked = options;
      page.language = 'available';
      return true;
    }
  }
  const Fake = local ? LocalRecognition : Recognition;
  page.window.webkitSpeechRecognition = Fake;
  return Fake;
}

// Canvas's mic starting to listen, as it looks the recognition up each time.
const listen = (page) => new page.window.webkitSpeechRecognition().start();

test("recognises what you say to Canvas's mic on this device, by default", async (t) => {
  const page = setupPage(t);
  fakeRecognition(page);
  await activateExtension(page, fakeHost());
  listen(page);

  assert.deepEqual(page.recognitions, [{ processLocally: true, lang: 'en-US' }]);
});

test("blocks Canvas's mic where the browser can only recognise speech online", async (t) => {
  const page = setupPage(t);
  fakeRecognition(page, { local: false });
  await activateExtension(page, fakeHost());

  assert.throws(() => listen(page), /can't recognise speech on this device/);
  assert.deepEqual(page.recognitions, []);
});

test("leaves Canvas's mic alone with On-device voices only off, and once the app's gone", async (t) => {
  const page = setupPage(t, { settings: { onDeviceOnly: false } });
  const Fake = fakeRecognition(page, { local: false });
  const dispose = await activateExtension(page, fakeHost());
  listen(page);
  assert.equal(page.recognitions.length, 1);

  await page.changeSettings({ onDeviceOnly: true });
  assert.notEqual(page.window.webkitSpeechRecognition, Fake);
  dispose();
  assert.equal(page.window.webkitSpeechRecognition, Fake);
});

const status = (page) =>
  page.document.querySelector('[data-testid="voice-recognition-status"]')?.textContent;

test("says Canvas's mic recognises what you say on this device", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  fakeRecognition(page);
  await openSettings(page);

  assert.equal(status(page), "Canvas's mic recognises what you say on this device.");
  assert.deepEqual(page.availableAsked, { langs: ['en-US'], processLocally: true });
});

test("downloads the language for Canvas's mic when the browser needs it", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  fakeRecognition(page, { language: 'downloadable' });
  await openSettings(page);
  assert.match(status(page), /blocked until your browser downloads American English speech recognition/);

  page.document.querySelector('[data-testid="voice-recognition-install"]').click();
  await flush();
  assert.equal(page.installs, 1);
  assert.equal(status(page), "Canvas's mic recognises what you say on this device.");
  assert.equal(page.document.querySelector('[data-testid="voice-recognition-install"]'), null);
});

test("says Canvas's mic is blocked where the browser can only recognise speech online", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  fakeRecognition(page, { local: false });
  await openSettings(page);

  assert.match(status(page), /can only recognise speech online, so Canvas's mic is blocked/);
});

test("says Canvas's mic uses your Voice input server when it has one", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  fakeRecognition(page, { local: false });
  page.window.localStorage.setItem(
    'openhands-transcription-endpoint',
    JSON.stringify({ baseUrl: 'https://whisper.test/v1', model: '' }),
  );
  await openSettings(page);

  assert.match(status(page), /your Voice input server/);
});

test('shows no mic status with On-device voices only off', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL, settings: { onDeviceOnly: false } });
  fakeRecognition(page);
  await openSettings(page);

  assert.equal(status(page), undefined);
});
