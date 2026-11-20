import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeHost, flush, mountPage, openSettings, setupPage, start } from './helpers.js';

// The browser's voices, as getVoices() gives them.
const voice = (name, lang, { voiceURI = name, localService = true } = {}) => ({
  name,
  lang,
  voiceURI,
  localService,
  default: false,
});
const EMMA = voice('Microsoft Emma Online (Natural) - English (United States)', 'en-US', {
  localService: false,
});
const SAMANTHA = voice('Samantha (Enhanced)', 'en-US', {
  voiceURI: 'com.apple.voice.enhanced.en-US.Samantha',
});
const DANIEL = voice('Daniel', 'en-GB');
const ZIRA = voice('Microsoft Zira - English (United States)', 'en-US');
const ESPEAK = voice('English (America)', 'en-US');
const NOVELTY = voice('Bad News', 'en-US');
const FRENCH = voice('Thomas', 'fr-FR');
const VOICES = [ESPEAK, DANIEL, NOVELTY, FRENCH, SAMANTHA, EMMA];

const MESSAGE = `
  <article data-testid="agent-message">
    <div class="absolute hidden"></div>
    <div><p>All tests pass.</p></div>
  </article>`;

// Reads the agent's message aloud with a Read aloud button.
async function readMessage(t, settings, voices = VOICES) {
  const { page } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true, ...settings },
    before: (page) => {
      page.voices = voices;
    },
  });
  page.document.querySelector('[data-voice-read-aloud]').click();
  return page.spoken[0];
}

// Online voices, like Emma and Google's, are only listed and used with On-device
// voices only off.
const ONLINE = { onDeviceOnly: false };

const settingsPage = async (t, settings) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
    settings,
  });
  page.voices = VOICES;
  await openSettings(page);
  return page;
};

// The Voice list: each choice as [label, details], under its region.
const choice = (row) => [...row.querySelectorAll('span > span')].map((span) => span.textContent);
const voiceChoices = (page) =>
  [...page.document.querySelector('[data-testid="voice-voice-list"] > div').children].map((child) =>
    child.tagName === 'FIELDSET'
      ? [child.querySelector('legend').textContent, [...child.querySelectorAll('label')].map(choice)]
      : choice(child),
  );
const pick = (page, name) =>
  page.document.querySelector(`[data-testid="voice-voice-list"] input[value="${name}"]`).click();
const AUTOMATIC = ['Automatic', 'Finding voices…'];

test("lists the browser's English voices, the rated ones by region, best first, with their quality, without novelty ones", async (t) => {
  const page = await settingsPage(t, ONLINE);

  assert.deepEqual(voiceChoices(page), [
    ['Automatic', 'Best for your region: Emma'],
    [
      'English (United States)',
      [
        ['Emma', 'Very high quality · Online'],
        ['Samantha', 'Normal quality'],
      ],
    ],
    ['English (United Kingdom)', [['Daniel', 'Low quality']]],
    ['Other voices', [['English (America)', 'Not rated']]],
  ]);
});

test('lists voices the browser finds after the page loads', async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
  });
  await openSettings(page);
  assert.deepEqual(voiceChoices(page), [AUTOMATIC]);
  await page.setVoices([ZIRA, DANIEL]);

  assert.deepEqual(voiceChoices(page), [
    ['Automatic', 'Best for your region: Zira'],
    ['English (United States)', [['Zira', 'Normal quality']]],
    ['English (United Kingdom)', [['Daniel', 'Low quality']]],
  ]);
});

test('keeps a voice this device does not have', async (t) => {
  const page = await settingsPage(t, { voice: 'Karen' });

  assert.deepEqual(voiceChoices(page)[1], ['Karen', 'Not on this device']);
  assert.equal(
    page.document.querySelector('[data-testid="voice-voice-list"] input:checked').value,
    'Karen',
  );
});

test('saves the voice as soon as it is picked, and previews it once it settles', async (t) => {
  const page = await settingsPage(t);
  pick(page, 'Daniel');
  assert.deepEqual(page.utterances, []);
  await page.wait(400);
  const highlighted = [
    ...page.document.querySelectorAll('[data-testid="voice-voice-option"].bg-tertiary'),
  ];
  assert.deepEqual(highlighted.map(choice), [['Daniel', 'Low quality']]);

  assert.equal(
    JSON.parse(page.window.localStorage.getItem('openhands-voice:settings')).voice,
    'Daniel',
  );
  assert.deepEqual(page.utterances, ['Hello, my name is Daniel and I am an English voice.']);
  assert.equal(page.spoken[0].voice, DANIEL);
});

test('previews only the last voice when the pick changes quickly, as with arrow keys', async (t) => {
  const page = await settingsPage(t, ONLINE);
  for (const { name } of [EMMA, SAMANTHA, DANIEL]) {
    pick(page, name);
    await page.wait(100);
  }
  assert.equal(
    JSON.parse(page.window.localStorage.getItem('openhands-voice:settings')).voice,
    'Daniel',
  );
  await page.wait(400);

  assert.deepEqual(page.utterances, ['Hello, my name is Daniel and I am an English voice.']);
});

test('keeps focus on a voice when the page redraws', async (t) => {
  const page = await settingsPage(t);
  const radio = () =>
    page.document.querySelector('[data-testid="voice-voice-radio"][value="Daniel"]');
  radio().focus();
  await page.changeSettings({ voiceChat: true });

  assert.equal(page.document.activeElement, radio());
  assert.ok(radio().isConnected);
});

test('Preview reads the picked voice again', async (t) => {
  const page = await settingsPage(t, { voice: 'Daniel' });
  page.document.querySelector('[data-testid="voice-preview"]').click();

  assert.deepEqual(page.utterances, ['Hello, my name is Daniel and I am an English voice.']);
});

test('reads with the best rated voice', async (t) => {
  const utterance = await readMessage(t, ONLINE);

  assert.equal(utterance.voice, EMMA);
  assert.equal(utterance.rate, 1);
  assert.equal(utterance.volume, 1);
});

test("picks the best voice Chrome preloads, over the system's", async (t) => {
  const google = voice('Google US English', 'en-US', { localService: false });
  const utterance = await readMessage(t, ONLINE, [ESPEAK, DANIEL, google]);

  assert.equal(utterance.voice, google);
});

test('reads with the chosen voice and speed', async (t) => {
  const utterance = await readMessage(t, { voice: 'Daniel', readingSpeed: '1.5' });

  assert.equal(utterance.voice, DANIEL);
  assert.equal(utterance.lang, 'en-GB');
  assert.equal(utterance.rate, 1.5);
});

test('reads at the chosen volume', async (t) => {
  const utterance = await readMessage(t, { volume: '0.5' });

  assert.equal(utterance.volume, 0.5);
});

test('falls back to the best rated voice when the chosen one is missing', async (t) => {
  const utterance = await readMessage(t, { ...ONLINE, voice: 'Karen' });

  assert.equal(utterance.voice, EMMA);
});

test('picks a voice even when none of them is rated', async (t) => {
  const utterance = await readMessage(t, {}, [ESPEAK]);

  assert.equal(utterance.voice, ESPEAK);
  assert.equal(utterance.lang, 'en-US');
});

test('leaves the voice to the browser until it has some, with online voices allowed', async (t) => {
  const utterance = await readMessage(t, ONLINE, []);

  assert.equal(utterance.voice, undefined);
  assert.equal(utterance.lang, 'en');
});

test('lists Reading speed under Reading aloud', async (t) => {
  const page = await settingsPage(t);
  const select = page.document.querySelector('[data-testid="voice-readingSpeed-select"]');
  await flush();

  assert.equal(select.value, '1');
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    ['0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×'],
  );
});

test("offers no voices when the browser can't read aloud", async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
  });
  delete page.window.speechSynthesis;
  await openSettings(page);
  const list = page.document.querySelector('[data-testid="voice-voice-list"]');

  assert.equal(list.disabled, true);
  assert.equal(
    page.document.getElementById('voice-voice-hint').textContent,
    "Your browser can't read text aloud.",
  );
});

test('finds the voices again after failing to', async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
  });
  // A voice Readium can't read at first, once it has started finding them.
  let fail = true;
  const flaky = {
    ...DANIEL,
    get name() {
      if (fail) throw new Error('Not ready');
      return DANIEL.name;
    },
  };
  page.voices = [flaky];
  const host = fakeHost();
  await openSettings(page, host);
  assert.deepEqual(voiceChoices(page), [AUTOMATIC]);

  fail = false;
  page.document.querySelector('[data-voice-own]').remove();
  await mountPage(page, host, 'settings');
  assert.deepEqual(voiceChoices(page), [
    ['Automatic', 'Best for your region: Daniel'],
    ['English (United Kingdom)', [['Daniel', 'Low quality']]],
  ]);
});

test('lists only on-device voices by default', async (t) => {
  const page = await settingsPage(t);

  assert.deepEqual(voiceChoices(page), [
    ['Automatic', 'Best for your region: Samantha'],
    ['English (United States)', [['Samantha', 'Normal quality']]],
    ['English (United Kingdom)', [['Daniel', 'Low quality']]],
    ['Other voices', [['English (America)', 'Not rated']]],
  ]);
});

test('reads with the best on-device voice by default', async (t) => {
  const utterance = await readMessage(t, {});

  assert.equal(utterance.voice, SAMANTHA);
});

test('skips a chosen online voice while keeping voice on this device', async (t) => {
  const utterance = await readMessage(t, { voice: EMMA.name });

  assert.equal(utterance.voice, SAMANTHA);
});

test("doesn't pick Chrome's online voice by default", async (t) => {
  const google = voice('Google US English', 'en-US', { localService: false });
  const utterance = await readMessage(t, {}, [ESPEAK, google]);

  assert.equal(utterance.voice, ESPEAK);
});

test('lists online voices as soon as Keep voice on this device is turned off', async (t) => {
  const page = await settingsPage(t);
  const toggle = page.document.querySelector('[data-testid="voice-onDeviceOnly-switch"]');
  assert.equal(toggle.checked, true);
  toggle.focus();
  toggle.click();
  await flush();

  assert.deepEqual(voiceChoices(page)[0], ['Automatic', 'Best for your region: Emma']);
  assert.equal(
    page.document.activeElement.dataset.testid,
    'voice-onDeviceOnly-switch',
  );
});

test('shows a saved online voice as skipped, rather than missing', async (t) => {
  const page = await settingsPage(t, { voice: EMMA.name });

  assert.deepEqual(voiceChoices(page)[1], [
    'Emma',
    'Online · Skipped to keep voice on this device',
  ]);
  assert.equal(
    page.document.querySelector('[data-testid="voice-voice-list"] input:checked').value,
    EMMA.name,
  );
});

test('reads with a voice on this device before Readium has found them', async (t) => {
  const { page } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true },
    // Readium asks first, before the browser has any, and waits for more.
    before: (page) => {
      let asked = false;
      page.window.speechSynthesis.getVoices = () => {
        const voices = asked ? [EMMA, ESPEAK] : [];
        asked = true;
        return voices;
      };
    },
  });
  page.document.querySelector('[data-voice-read-aloud]').click();

  assert.equal(page.spoken[0].voice, ESPEAK);
});

test('reads nothing when only online voices could, while keeping voice on this device', async (t) => {
  const { page } = await start(t, {
    path: '/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: MESSAGE,
    settings: { readAloud: true },
    before: (page) => {
      page.voices = [EMMA];
    },
  });
  const button = page.document.querySelector('[data-voice-read-aloud]');
  button.click();

  assert.deepEqual(page.utterances, []);
  assert.equal(button.getAttribute('aria-label'), 'Read aloud');
});

test('says when there are no voices on this device', async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
  });
  page.voices = [EMMA];
  await openSettings(page);

  assert.deepEqual(voiceChoices(page), [['Automatic', 'No voices on this device']]);
});

test("counts voices as online by their names and ids too, not only by what the browser says", async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/extensions/openhands-app-voice/settings',
  });
  // Each on this device, as far as the browser says.
  page.voices = [
    voice('Microsoft Ava Online (Natural) - English (United States)', 'en-US'),
    voice('English United States', 'en-US', { voiceURI: 'en-us-x-iol-network' }),
    voice('Google US English', 'en-US'),
    voice('Google US English 5 (Natural)', 'en-US', { voiceURI: 'en-us-x-tpc-local' }),
    ESPEAK,
  ];
  await openSettings(page);

  const listed = voiceChoices(page).slice(1).flatMap(([, voices]) => voices.map(([label]) => label));
  assert.equal(listed.length, 2, listed.join());
  assert.ok(listed.includes('English (America)'), listed.join());
});
