import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, activateExtension, flush, openSettings, setupPage, start } from './helpers.js';

// Canvas's message box with its mic, which toggles as Canvas's does, and its
// send button, which sends your message and starts a run.
const CHAT = `
  <article data-testid="agent-message">
    <div class="absolute hidden"><button type="button" aria-label="Copy">Copy</button></div>
    <div><h2>Done</h2><p>Fixed the bug. All tests pass</p><pre><code>npm test</code></pre><ul><li>One file</li></ul></div>
  </article>
  <div>
    <button type="button" data-testid="stop-button">Stop</button>
    <div data-testid="chat-input" contenteditable="true"></div>
    <div>
      <button type="button" data-testid="chat-dictation-button" aria-pressed="false" aria-busy="false"></button>
      <button type="button" data-testid="submit-button">Send</button>
    </div>
  </div>`;

const mic = (page) => page.document.querySelector('[data-testid="chat-dictation-button"]');
const listening = (page) => mic(page).getAttribute('aria-pressed') === 'true';

// A voice on this device to read with.
const ON_DEVICE = [
  { name: 'English (America)', lang: 'en-US', voiceURI: 'en-us', localService: true, default: true },
];

async function voiceChat(t, settings = { voiceChat: true }, voices = ON_DEVICE) {
  const { page, host } = await start(t, {
    path: `/conversations/${A}`,
    body: CHAT,
    settings,
    statuses: { [A]: 'finished' },
    turns: { [A]: { user: 'm1', leaf: 'e1' } },
    finalResponse: 'Done. All **tests** pass.',
    before: (page) => {
      page.voices = voices;
    },
  });
  page.sent = [];
  mic(page).addEventListener('click', () => {
    mic(page).setAttribute('aria-pressed', String(!listening(page)));
  });
  page.document.querySelector('[data-testid="submit-button"]').addEventListener('click', () => {
    const composer = page.document.querySelector('[data-testid="chat-input"]');
    page.sent.push(composer.textContent);
    composer.textContent = '';
    host.turns[A] = { user: 'm2', leaf: 'm2' };
    host.statuses[A] = 'running';
  });
  return { page, host };
}

// You press the mic, say something, and press it again, as Canvas puts what
// you said in the message box.
async function say(page, text) {
  mic(page).click();
  await flush();
  page.document.querySelector('[data-testid="chat-input"]').textContent = text;
  mic(page).click();
  await flush();
  await page.wait(100);
}

// Time passing for Hands-free, which checks the mic's level every 50ms.
async function elapse(page, ms) {
  for (let passed = 0; passed < ms; passed += 50) await page.wait(50);
}

async function reply(page, host, status = 'finished') {
  await page.wait(2000);
  host.statuses[A] = status;
  host.turns[A].leaf = 'e2';
  await page.wait(2000);
}

test('sends what you said, reads the reply aloud, then listens again', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  assert.deepEqual(page.sent, ['Run the tests']);

  await reply(page, host);
  assert.deepEqual(page.utterances, ['Done.', 'All tests pass.']);
  assert.equal(listening(page), false);

  await page.finishSpeaking();
  assert.equal(listening(page), true);
});

test("doesn't read the last reply before the run for your message starts", async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  host.statuses[A] = 'finished';
  await page.wait(4000);
  assert.deepEqual(page.utterances, []);

  host.turns[A].leaf = 'e2';
  await page.wait(2000);
  assert.deepEqual(page.utterances, ['Done.', 'All tests pass.']);
});

test('reads a reply a sentence at a time, leaving code on screen', async (t) => {
  const { page, host } = await voiceChat(t);
  host.finalResponse = 'Fixed it, e.g. the tests. Run `npm test`!\n\n```js\nrun();\n```';
  await say(page, 'Explain');
  await reply(page, host);

  assert.deepEqual(page.utterances, [
    'Fixed it, e.g. the tests.',
    'Run npm test!',
    'The code is in the chat.',
  ]);
  assert.equal(listening(page), false);
  await page.finishSpeaking();
  assert.equal(listening(page), true);
});

test('says when the agent needs your confirmation, without listening again', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Delete the branch');
  await page.wait(2000);
  host.statuses[A] = 'waiting_for_confirmation';
  await page.wait(2000);

  assert.deepEqual(page.utterances, ['The agent needs your confirmation.']);
  await page.finishSpeaking();
  assert.equal(listening(page), false);
});

test('stops reading when you press a key', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  await reply(page, host);
  page.window.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'a' }));
  await flush();

  assert.equal(page.window.speechSynthesis.queue.length, 0);
  await page.wait(10000);
  assert.equal(listening(page), false);
});

test('gives up on the reply when you open another conversation', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  page.navigate(`/conversations/${B}`);
  page.mutate();
  await flush();
  await reply(page, host);

  assert.deepEqual(page.utterances, []);
});

test("doesn't send when you said nothing", async (t) => {
  const { page } = await voiceChat(t);
  await say(page, '');
  await page.wait(5000);

  assert.deepEqual(page.sent, []);
});

test('leaves the mic alone when Voice chat is off', async (t) => {
  const { page } = await voiceChat(t, { wideChat: true });
  await say(page, 'Run the tests');
  await page.wait(5000);

  assert.deepEqual(page.sent, []);
  assert.equal(page.micStreams, 0);
});

test('Hands-free stops the mic once you stop talking', async (t) => {
  const { page } = await voiceChat(t, { handsFree: true });
  mic(page).click();
  await flush();
  assert.equal(page.micStreams, 1);

  page.micLevel = 0.2;
  await elapse(page, 1000);
  page.micLevel = 0;
  await elapse(page, 1000);
  assert.equal(listening(page), true);
  await elapse(page, 600);
  assert.equal(listening(page), false);
  assert.equal(page.micStreams, 0);
});

test('Hands-free stops the mic when you say nothing', async (t) => {
  const { page } = await voiceChat(t, { handsFree: true });
  mic(page).click();
  await flush();
  await elapse(page, 9000);
  assert.equal(listening(page), true);
  await elapse(page, 1100);

  assert.equal(listening(page), false);
  assert.equal(page.micStreams, 0);
});

test('Hands-free lets go of the mic when you stop it yourself', async (t) => {
  const { page } = await voiceChat(t, { handsFree: true });
  mic(page).click();
  await flush();
  mic(page).click();
  await flush();

  assert.equal(page.micStreams, 0);
});

test("Hands-free stays off when the mic's blocked", async (t) => {
  const page = setupPage(t, { url: 'https://canvas.test/extensions/openhands-app-voice/settings' });
  page.micAnswer = false;
  await openSettings(page);
  const toggle = page.document.querySelector('[data-testid="voice-handsFree-switch"]');
  toggle.click();
  await flush();

  assert.equal(toggle.checked, false);
  assert.match(
    page.document.getElementById('voice-handsFree-hint').textContent,
    /mic is blocked/,
  );
});

test("reads the reply in one go when Canvas's language isn't one the browser knows", async (t) => {
  const { page, host } = await voiceChat(t);
  page.document.documentElement.lang = 'not a language';
  await say(page, 'Run the tests');
  await reply(page, host);

  assert.deepEqual(page.utterances, ['Done. All tests pass.']);
});

test('"Never mind" clears what you said instead of sending it', async (t) => {
  const { page } = await voiceChat(t);
  await say(page, 'Never mind.');
  await page.wait(5000);

  assert.deepEqual(page.sent, []);
  assert.equal(page.document.querySelector('[data-testid="chat-input"]').textContent, '');
  assert.deepEqual(page.utterances, []);
});

test('"Stop" presses Canvas\'s Stop', async (t) => {
  const { page } = await voiceChat(t);
  let stopped = 0;
  page.document
    .querySelector('[data-testid="stop-button"]')
    .addEventListener('click', () => (stopped += 1));
  await say(page, 'Stop!');

  assert.equal(stopped, 1);
  assert.deepEqual(page.sent, []);
  assert.deepEqual(page.utterances, ['Stopped.']);
  await page.finishSpeaking();
  assert.equal(listening(page), false);
});

test('"Repeat that" reads the last reply again, then listens', async (t) => {
  const { page } = await voiceChat(t);
  await say(page, 'Repeat that');

  assert.deepEqual(page.sent, []);
  assert.deepEqual(page.utterances, ['Done.', 'All tests pass.']);
  await page.finishSpeaking();
  assert.equal(listening(page), true);
});

test('"New chat" opens one', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'New chat');

  assert.deepEqual(host.navigations, ['/conversations']);
  assert.deepEqual(page.utterances, ['New chat.']);
});

test('keeps the screen awake while a turn goes', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  assert.equal(page.wakeLocks, 1);

  await reply(page, host);
  page.window.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Escape' }));
  await flush();
  assert.equal(page.wakeLocks, 0);
});

test('Alt+V presses the mic, from the message box too', async (t) => {
  const { page } = await voiceChat(t, { keyboardShortcut: true });
  const composer = page.document.querySelector('[data-testid="chat-input"]');
  const event = new page.window.KeyboardEvent('keydown', {
    key: '√',
    code: 'KeyV',
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  composer.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(listening(page), true);
});

const readAloud = (page) => page.document.querySelector('[data-voice-read-aloud]');

test("Read aloud buttons read the agent's messages, leaving code on screen", async (t) => {
  const { page } = await voiceChat(t, { readAloud: true });
  const button = readAloud(page);
  assert.equal(button.getAttribute('aria-label'), 'Read aloud');
  assert.equal(button.parentElement, page.document.querySelector('article > div.absolute'));

  button.click();
  assert.deepEqual(page.utterances, [
    'Done',
    'Fixed the bug.',
    'All tests pass',
    'The code is in the chat.',
    'One file',
  ]);
  assert.equal(button.getAttribute('aria-label'), 'Stop reading');

  button.click();
  assert.equal(page.window.speechSynthesis.queue.length, 0);
  assert.equal(button.getAttribute('aria-label'), 'Read aloud');
});

test('Read aloud buttons go when turned off', async (t) => {
  const { page } = await voiceChat(t, { readAloud: true });
  assert.ok(readAloud(page));
  await page.changeSettings({ readAloud: false });

  assert.equal(readAloud(page), null);
});

test('listens again when the last sentence fails to be read', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  await reply(page, host);
  const last = page.window.speechSynthesis.queue.at(-1);
  page.window.speechSynthesis.queue = [];
  last.onerror({ error: 'synthesis-failed' });
  await flush();

  assert.equal(listening(page), true);
});

test('Read aloud buttons reset for a message with nothing to read', async (t) => {
  const { page } = await voiceChat(t, { readAloud: true });
  page.document.querySelector('article > div:not(.absolute)').replaceChildren();
  const button = page.document.querySelector('[data-voice-read-aloud]');
  button.click();

  assert.deepEqual(page.utterances, []);
  assert.equal(button.getAttribute('aria-label'), 'Read aloud');
});

test("waits to send until it knows your last message, so it knows the reply", async (t) => {
  const { page, host } = await voiceChat(t);
  const request = host.agentServer.request;
  let release;
  const slow = new Promise((resolve) => (release = resolve));
  host.agentServer.request = async (options) => {
    if (options.path.startsWith('/api/conversations?')) await slow;
    return request(options);
  };
  await say(page, 'Run the tests');
  assert.deepEqual(page.sent, []);

  release();
  await flush();
  await page.wait(100);
  assert.deepEqual(page.sent, ['Run the tests']);
  host.agentServer.request = request;
  await reply(page, host);
  assert.deepEqual(page.utterances, ['Done.', 'All tests pass.']);
});

test('Read aloud buttons go with the app, and come back working', async (t) => {
  const { page, host } = await voiceChat(t, { readAloud: true });
  page.document.querySelector('[data-voice-read-aloud]').click();
  page.dispose();
  assert.equal(page.document.querySelector('[data-voice-read-aloud]'), null);
  assert.equal(page.window.speechSynthesis.queue.length, 0);

  await activateExtension(page, host);
  page.document.querySelector('[data-voice-read-aloud]').click();
  assert.equal(
    page.document.querySelector('[data-voice-read-aloud]').getAttribute('aria-label'),
    'Stop reading',
  );
});

test('plays the listening chime, then listens again', async (t) => {
  const { page, host } = await voiceChat(t, { voiceChat: true, listeningChime: true, volume: '0.5' });
  await say(page, 'Run the tests');
  await reply(page, host);
  await page.finishSpeaking();

  assert.deepEqual(page.tones, [
    [660, 0.075],
    [880, 0.075],
  ]);
  assert.equal(listening(page), false);
  await page.wait(350);
  assert.equal(listening(page), true);
});

test('listens again without a chime while the Listening chime is off', async (t) => {
  const { page, host } = await voiceChat(t);
  await say(page, 'Run the tests');
  await reply(page, host);
  await page.finishSpeaking();

  assert.deepEqual(page.tones, []);
  assert.equal(listening(page), true);
});

// The first press of the mic, which lets Safari speak afterwards.
const pressMic = (page) =>
  mic(page).dispatchEvent(new page.window.MouseEvent('pointerdown', { bubbles: true }));

test('lets the browser speak on the first press of the mic, in a voice on this device', async (t) => {
  const { page } = await voiceChat(t);
  pressMic(page);

  assert.deepEqual(page.utterances, ['']);
  assert.equal(page.spoken[0].voice.name, 'English (America)');
});

test('says nothing on the first press of the mic when only online voices could', async (t) => {
  const { page } = await voiceChat(t, { voiceChat: true }, [
    { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false },
  ]);
  pressMic(page);

  assert.deepEqual(page.utterances, []);
});
