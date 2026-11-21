import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flush, mountPage, openSettings, setupPage, start } from './helpers.js';

const SETTINGS_URL = 'https://canvas.test/extensions/openhands-app-voice/settings';
const SERVER = { readWith: 'server', speechServer: 'http://tts.test:8880/v1' };
const MESSAGE = `
  <article data-testid="agent-message">
    <div class="absolute hidden"></div>
    <div><p>All tests pass.</p></div>
  </article>`;
const ON_DEVICE = [
  { name: 'English (America)', lang: 'en-US', voiceURI: 'en-us', localService: true, default: true },
];

const testid = (page, id) => page.document.querySelector(`[data-testid="${id}"]`);
const choices = (page, key) =>
  [...page.document.querySelectorAll(`[data-testid="voice-${key}-list"] label`)].map((row) =>
    [...row.querySelectorAll('span > span')].map((span) => span.textContent),
  );

async function settingsPage(t, settings, before) {
  const page = setupPage(t, { url: SETTINGS_URL, settings });
  page.voices = ON_DEVICE;
  before?.(page);
  await openSettings(page);
  return page;
}

test("lists the speech server's voices while Speech server is picked, asking with its API key", async (t) => {
  const page = await settingsPage(t, SERVER, (page) => {
    page.window.sessionStorage.setItem('openhands-voice:speech-server-key', 'secret');
  });

  assert.equal(testid(page, 'voice-voice-list'), null);
  assert.deepEqual(choices(page, 'serverVoice'), [
    ['Automatic', "The server's first voice: af_heart"],
    ['af_heart', ''],
    ['bf_emma', ''],
  ]);
  const [request] = page.server.requests;
  assert.equal(request.url, 'http://tts.test:8880/v1/audio/voices');
  assert.equal(request.headers.Authorization, 'Bearer secret');
  assert.equal(testid(page, 'voice-speechServer-key').value, 'secret');
  assert.equal(page.window.localStorage.getItem('openhands-voice:settings').includes('secret'), false);
  assert.equal(testid(page, 'voice-speechServer-status').hidden, true);
});

test("accepts voices listed as objects, or by themselves", async (t) => {
  const page = await settingsPage(t, SERVER, (page) => {
    page.server.voices = [{ id: 'nova', name: 'Nova' }, 'echo'];
  });

  assert.deepEqual(choices(page, 'serverVoice').slice(1), [
    ['nova', ''],
    ['echo', ''],
  ]);
});

test('shows the server fields once Speech server is picked, and saves them', async (t) => {
  const page = await settingsPage(t, {});
  assert.equal(testid(page, 'voice-speechServer'), null);
  const readWith = testid(page, 'voice-readWith-select');
  readWith.value = 'server';
  readWith.dispatchEvent(new page.window.Event('change'));
  await flush();

  const address = testid(page, 'voice-speechServer');
  address.value = 'http://tts.test:8880 ';
  address.dispatchEvent(new page.window.Event('change'));
  await flush();
  const key = testid(page, 'voice-speechServer-key');
  key.value = 'secret';
  key.dispatchEvent(new page.window.Event('change'));
  await flush();

  const stored = JSON.parse(page.window.localStorage.getItem('openhands-voice:settings'));
  assert.equal(stored.readWith, 'server');
  assert.equal(stored.speechServer, 'http://tts.test:8880');
  assert.equal(page.window.sessionStorage.getItem('openhands-voice:speech-server-key'), 'secret');
  assert.equal(page.server.requests.at(-1).url, 'http://tts.test:8880/v1/audio/voices');
  assert.equal(page.server.requests.at(-1).headers.Authorization, 'Bearer secret');
  assert.equal(choices(page, 'serverVoice').length, 3);
});

test('previews a server voice as you pick it', async (t) => {
  const page = await settingsPage(t, SERVER);
  testid(page, 'voice-serverVoice-list').querySelector('input[value="bf_emma"]').click();
  await page.wait(400);

  assert.equal(page.played.length, 1);
  assert.equal(page.played[0].voice, 'bf_emma');
  assert.deepEqual(page.utterances, []);
});

test('Read aloud buttons read through the speech server, at the chosen speed and volume', async (t) => {
  const { page } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true, ...SERVER, readingSpeed: '1.5', volume: '0.25' },
  });
  const button = page.document.querySelector('[data-voice-read-aloud]');
  button.click();
  await flush();

  assert.deepEqual(page.played, [
    { model: 'tts-1', input: 'All tests pass.', voice: 'af_heart', speed: 1.5, response_format: 'mp3', volume: 0.25 },
  ]);
  assert.deepEqual(page.utterances, []);
  assert.equal(button.getAttribute('aria-pressed'), 'true');

  button.click();
  assert.equal(page.playing, null);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test("falls back to the browser's voices when the server fails, and the settings page says why", async (t) => {
  const { page, host } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true, ...SERVER },
    before: (page) => {
      page.voices = ON_DEVICE;
      page.server.status = 500;
    },
  });
  await page.setVoices(ON_DEVICE);
  page.document.querySelector('[data-voice-read-aloud]').click();
  await flush();
  assert.deepEqual(page.played, []);
  assert.deepEqual(page.utterances, ['All tests pass.']);

  await mountPage(page, host, 'settings');
  const status = testid(page, 'voice-speechServer-status');
  assert.equal(status.hidden, false);
  assert.equal(
    status.textContent,
    "The speech server answered 500, so your browser's voices read aloud instead.",
  );
});

test("says the server can't be reached on the settings page", async (t) => {
  const page = await settingsPage(t, SERVER, (page) => {
    page.server.down = true;
  });

  assert.equal(
    testid(page, 'voice-speechServer-status').textContent,
    "Couldn't reach http://tts.test:8880/v1, so your browser's voices read aloud instead.",
  );
  assert.deepEqual(choices(page, 'serverVoice'), [
    ['Automatic', "Your browser's voices, until the server answers"],
  ]);
});
